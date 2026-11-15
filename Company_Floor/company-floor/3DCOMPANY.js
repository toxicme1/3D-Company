#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
let rl = readline.createInterface({ input: stdin, output: stdout });

const APP_DIR = __dirname;
const WORKSPACE = path.resolve(APP_DIR, '../Workspace');
const SETTINGS_FILE = path.join(APP_DIR, 'setting.json');
const PAGE = path.join(APP_DIR, 'index.html');
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

function readSettings() {
  try {
    const value = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    return value && typeof value === 'object' ? value : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error('Could not read setting.json: ' + error.message);
  }
}

function validSettings(settings) {
  if (typeof settings.baseUrl !== 'string' || typeof settings.apiKey !== 'string' ||
      typeof settings.model !== 'string' || !settings.baseUrl.trim() ||
      !settings.apiKey.trim() || !settings.model.trim()) return false;
  try {
    const url = new URL(settings.baseUrl);
    return (url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname))) &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch (error) {
    return false;
  }
}

async function ask(question, fallback) {
  const suffix = fallback ? ' [' + fallback + ']' : '';
  const answer = (await rl.question(question + suffix + ': ')).trim();
  return answer || fallback || '';
}

function askSecret(label, saved) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Run 3DCOMPANY from an interactive terminal to enter the API key.'));
  }
  rl.close();
  rl = null;
  stdout.write(label + (saved ? ' [press Enter to keep the saved key]' : '') + ': ');
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise((resolve, reject) => {
    let value = '';
    function finish(error) {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdout.write('\n');
      rl = readline.createInterface({ input: stdin, output: stdout });
      if (error) reject(error);
      else resolve(value || (saved ? saved : ''));
    }
    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\u0003') return finish(new Error('Setup cancelled.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') {
          if (value) { value = value.slice(0, -1); stdout.write('\b \b'); }
          continue;
        }
        if (char >= ' ' && char <= '~') { value += char; stdout.write('*'); }
      }
    }
    stdin.on('data', onData);
  });
}

function saveSettings(settings) {
  const tmp = SETTINGS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, SETTINGS_FILE);
  try { fs.chmodSync(SETTINGS_FILE, 0o600); } catch (error) {}
}

function waitForBridge(port, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function probe() {
      const req = http.get({ hostname: '127.0.0.1', port, timeout: 500 }, response => {
        response.resume();
        if (response.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.on('timeout', () => req.destroy());
    }
    function retry() {
      if (Date.now() - start > timeoutMs) return reject(new Error('API bridge did not start. Check the bridge output above.'));
      setTimeout(probe, 150);
    }
    probe();
  });
}

function availablePort(preferred) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', error => {
      if (preferred !== 0) return availablePort(0).then(resolve, reject);
      reject(error);
    });
    server.listen(preferred, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function openPage(url) {
  let command, args;
  if (process.platform === 'win32') {
    command = 'cmd'; args = ['/c', 'start', '', url];
  } else if (process.platform === 'darwin') {
    command = 'open'; args = [url];
  } else {
    command = 'xdg-open'; args = [url];
  }
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.on('error', error => console.error('Could not open the browser automatically: ' + error.message + '\nOpen this URL yourself:\n' + url));
  child.unref();
}

async function main() {
  let settings = readSettings();
  if (!validSettings(settings) || process.argv.includes('--setup')) {
    console.log('\nCompany Floor API setup');
    console.log('Use OpenRouter, OmniRoute, or another OpenAI-compatible chat-completions provider.');
    const baseUrl = await ask('API Base URL', settings.baseUrl || DEFAULT_BASE_URL);
    const apiKey = await askSecret('API key', settings.apiKey);
    const model = await ask('Model name', settings.model || DEFAULT_MODEL);
    settings = Object.assign({}, settings, {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      model,
      bridgeToken: settings.bridgeToken || crypto.randomBytes(24).toString('hex')
    });
    if (!validSettings(settings)) throw new Error('Invalid settings. Use an HTTPS API URL (or localhost), API key, and model name.');
    saveSettings(settings);
    console.log('Settings saved privately. Next time, 3DCOMPANY will use them without asking.');
  } else if (!settings.bridgeToken) {
    settings.bridgeToken = crypto.randomBytes(24).toString('hex');
    saveSettings(settings);
  }

  const port = await availablePort(Number(settings.bridgePort) || 8787);
  const token = settings.bridgeToken;
  const bridgeUrl = 'ws://127.0.0.1:' + port + '/?token=' + encodeURIComponent(token);
  const pageUrl = pathToFileURL(PAGE);
  pageUrl.searchParams.set('bridge', bridgeUrl);
  console.log('\nStarting the local API bridge. Press Ctrl+C to stop it.');

  const bridge = spawn(process.execPath, [
    path.join(APP_DIR, 'api-bridge.js'),
    '--dir', WORKSPACE,
    '--port', String(port),
    '--token', token
  ], { cwd: APP_DIR, stdio: 'inherit' });
  bridge.on('error', error => {
    console.error('Could not start API bridge: ' + error.message);
    process.exitCode = 1;
  });

  await Promise.race([
    waitForBridge(port, 8000).then(() => {
      console.log('Opening Company Floor with API connection configured.');
      openPage(pageUrl.href);
    }),
    new Promise((resolve, reject) => bridge.once('exit', code => reject(new Error('API bridge exited (' + code + '). Is port ' + port + ' already in use?'))))
  ]);
  bridge.on('exit', code => { process.exitCode = code || 0; });
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => rl.close());
