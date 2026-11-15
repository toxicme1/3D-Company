// social-proxy.js
// Simple Express proxy that forwards social‑media publishing requests to real APIs.
// Runs on localhost:4000 and is intended for development only.
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import { google } from 'googleapis';

dotenv.config();

// CHANGED (hardening, see README): startup checks, API key, random OAuth state, bind to localhost.
if (!/^[0-9a-fA-F]{64}$/.test(process.env.TOKEN_ENCRYPTION_KEY || '')) { console.error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes).'); process.exit(1); }
if (!process.env.SOCIAL_PROXY_KEY || process.env.SOCIAL_PROXY_KEY.length < 16) { console.error('Set SOCIAL_PROXY_KEY (16+ characters) in .env. The API bridge sends it as x-proxy-key.'); process.exit(1); }
function keyOk(req) { const a = Buffer.from(String(req.headers['x-proxy-key'] || '')), b = Buffer.from(process.env.SOCIAL_PROXY_KEY); return a.length === b.length && crypto.timingSafeEqual(a, b); }
const states = new Map();
function newState() { const s = crypto.randomBytes(16).toString('hex'); states.set(s, Date.now() + 10 * 60 * 1000); return s; }
function takeState(s) { const t = states.get(String(s)); states.delete(String(s)); return !!t && t > Date.now(); }

// Encryption utilities – AES‑256‑GCM
function encryptToken(tokenObj) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.from(JSON.stringify(tokenObj));
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptToken(encStr) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
  const buf = Buffer.from(encStr, 'base64');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const encrypted = buf.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString());
}

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/', limits: { fileSize: 2 * 1024 * 1024 * 1024 } });
// CHANGED: every route except the browser OAuth ones needs the key.
app.use((req, res, next) => { if (/\/(auth|callback)$/.test(req.path) || keyOk(req)) return next(); res.status(401).json({ success: false, error: 'Missing or wrong x-proxy-key' }); });

// Helper: load token & refresh if needed
async function getYouTubeAuth() {
  const tokenPath = 'youtube-token.json';
  if (!fs.existsSync(tokenPath)) throw new Error('YouTube not connected');
  const encrypted = fs.readFileSync(tokenPath, 'utf8');
  const tokens = decryptToken(encrypted);
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      'http://localhost:4000/youtube/callback'
    );
    oauth2Client.setCredentials(tokens);
    const newTokens = await oauth2Client.refreshAccessToken();
    const merged = { ...tokens, ...newTokens.credentials };
    fs.writeFileSync(tokenPath, encryptToken(merged));
    return merged.access_token;
  }
  return tokens.access_token;
}

async function getInstagramAuth() {
  const tokenPath = 'instagram-token.json';
  if (!fs.existsSync(tokenPath)) throw new Error('Instagram not connected');
  const encrypted = fs.readFileSync(tokenPath, 'utf8');
  const tokenObj = decryptToken(encrypted);
  if (tokenObj.expires_at && tokenObj.expires_at < Date.now()) {
    if (!tokenObj.refresh_token) throw new Error('No Instagram refresh token');
    const resp = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.INSTAGRAM_CLIENT_ID,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
        fb_exchange_token: tokenObj.refresh_token
      }
    });
    const newAccess = resp.data.access_token;
    const expiresIn = resp.data.expires_in * 1000;
    const newTokenObj = {
      access_token: newAccess,
      refresh_token: tokenObj.refresh_token,
      expires_at: Date.now() + expiresIn
    };
    fs.writeFileSync(tokenPath, encryptToken(newTokenObj));
    return newAccess;
  }
  return tokenObj.access_token;
}

async function getTikTokAuth() {
  const tokenPath = 'tiktok-token.json';
  if (!fs.existsSync(tokenPath)) throw new Error('TikTok not connected');
  const encrypted = fs.readFileSync(tokenPath, 'utf8');
  const tokenObj = decryptToken(encrypted);
  if (tokenObj.expires_at && tokenObj.expires_at < Date.now()) {
    if (!tokenObj.refresh_token) throw new Error('No TikTok refresh token');
    const resp = await axios.post('https://open.tiktok.com/oauth/refresh_token/', null, {
      params: {
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tokenObj.refresh_token
      }
    });
    const newAccess = resp.data.data.access_token;
    const expiresIn = resp.data.data.expires_in * 1000;
    const newTokenObj = {
      access_token: newAccess,
      refresh_token: tokenObj.refresh_token,
      expires_at: Date.now() + expiresIn
    };
    fs.writeFileSync(tokenPath, encryptToken(newTokenObj));
    return newAccess;
  }
  return tokenObj.access_token;
}

// ---------- YouTube upload ----------
app.post('/youtube/upload', upload.single('video'), async (req, res) => {
  try {
    const accessToken = await getYouTubeAuth();
    const { title, description, privacy = 'private' } = req.body; // CHANGED: private unless asked
    if (!req.file) return res.status(400).json({ success: false, error: 'No video file' });
    var videoPath = req.file.path;
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth });
    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: { snippet: { title, description }, status: { privacyStatus: privacy } },
      media: { body: fs.createReadStream(videoPath) }
    });
    fs.unlinkSync(videoPath);
    res.json({ success: true, url: `https://youtu.be/${response.data.id}` });
  } catch (e) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('YouTube upload error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---------- Instagram publish ----------
app.post('/instagram/publish', async (req, res) => {
  try {
    const accessToken = await getInstagramAuth();
    const { imageUrl, caption } = req.body;
    // CHANGED: this route does not publish anything yet, so it must not claim success.
    res.status(501).json({ success: false, error: 'Instagram publishing is not implemented in this proxy yet.' });
  } catch (e) {
    console.error('Instagram publish error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---------- TikTok upload ----------
app.post('/tiktok/upload', upload.single('video'), async (req, res) => {
  try {
    const accessToken = await getTikTokAuth();
    if (req.file) fs.unlink(req.file.path, () => {});
    // CHANGED: this route does not upload anything yet, so it must not claim success.
    res.status(501).json({ success: false, error: 'TikTok upload is not implemented in this proxy yet.' });
  } catch (e) {
    console.error('TikTok upload error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = process.env.SOCIAL_PROXY_PORT || 4000;

// ---------- OAuth routes ----------
app.get('/youtube/auth', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'http://localhost:4000/youtube/callback'
  );
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
    state: newState()
  });
  res.redirect(authUrl);
});

app.get('/youtube/callback', async (req, res) => {
  if (!takeState(req.query.state)) return res.status(400).send('Bad or expired state');
  const code = req.query.code;
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'http://localhost:4000/youtube/callback'
  );
  try {
    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync('youtube-token.json', encryptToken(tokens));
    res.send('YouTube connected! You can close this tab and return to Company Floor.');
  } catch (e) {
    console.error('YouTube OAuth error', e);
    res.status(500).send('OAuth failure');
  }
});

app.get('/instagram/auth', (req, res) => {
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const redirectUri = encodeURIComponent('http://localhost:4000/instagram/callback');
  const scope = encodeURIComponent('instagram_content_publish,instagram_basic,pages_show_list');
  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${newState()}`;
  res.redirect(authUrl);
});

app.get('/instagram/callback', async (req, res) => {
  if (!takeState(req.query.state)) return res.status(400).send('Bad or expired state');
  const code = req.query.code;
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  const redirectUri = 'http://localhost:4000/instagram/callback';
  try {
    const tokenResp = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
      params: { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }
    });
    const accessToken = tokenResp.data.access_token;
    const expiresIn = tokenResp.data.expires_in * 1000;
    const tokenObj = { access_token: accessToken, refresh_token: tokenResp.data.refresh_token, expires_at: Date.now() + expiresIn };
    fs.writeFileSync('instagram-token.json', encryptToken(tokenObj));
    res.send('Instagram connected! You can close this tab.');
  } catch (e) {
    console.error('Instagram OAuth error', e);
    res.status(500).send('OAuth failure');
  }
});

app.get('/tiktok/auth', (req, res) => {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = encodeURIComponent('http://localhost:4000/tiktok/callback');
  const authUrl = `https://open.tiktok.com/platform/oauth/connect/?client_key=${clientKey}&response_type=code&scope=user.info.basic,video.upload&redirect_uri=${redirectUri}&state=${newState()}`;
  res.redirect(authUrl);
});

app.get('/tiktok/callback', async (req, res) => {
  if (!takeState(req.query.state)) return res.status(400).send('Bad or expired state');
  const code = req.query.code;
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = 'http://localhost:4000/tiktok/callback';
  try {
    const tokenResp = await axios.post('https://open.tiktok.com/oauth/access_token/', null, {
      params: { client_key: clientKey, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }
    });
    const accessToken = tokenResp.data.data.access_token;
    const expiresIn = tokenResp.data.data.expires_in * 1000;
    const tokenObj = { access_token: accessToken, refresh_token: tokenResp.data.data.refresh_token, expires_at: Date.now() + expiresIn };
    fs.writeFileSync('tiktok-token.json', encryptToken(tokenObj));
    res.send('TikTok connected! You can close this tab.');
  } catch (e) {
    console.error('TikTok OAuth error', e);
    res.status(500).send('OAuth failure');
  }
});

app.get('/status', (req, res) => {
  res.json({
    youtube: fs.existsSync('youtube-token.json'),
    instagram: fs.existsSync('instagram-token.json'),
    tiktok: fs.existsSync('tiktok-token.json')
  });
});

app.listen(PORT, '127.0.0.1', () => { // CHANGED: the log line said 127.0.0.1 but it listened on every interface
  console.log(`🔌 Social proxy listening on http://127.0.0.1:${PORT}`);
});