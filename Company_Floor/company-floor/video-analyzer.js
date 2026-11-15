#!/usr/bin/env node
/**
 * Video Analysis Module
 * Extracts frames from videos and analyzes them using vision-capable AI models
 * Works with YouTube URLs and local video files (MP4, MOV, WebM)
 */

const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');

/**
 * Extract video ID from YouTube URL
 */
function extractYouTubeId(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1, 12);
    }
    if (urlObj.searchParams.get('v')) {
      return urlObj.searchParams.get('v').slice(0, 11);
    }
    const match = urlObj.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/);
    return match ? match[2] : null;
  } catch (e) {
    return null;
  }
}

/**
 * Check if ffmpeg is available
 */
async function checkFFmpeg() {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Extract frames from a video file at specific timestamps
 * @param {string} videoPath - Path to video file
 * @param {number[]} timestamps - Array of timestamps in seconds to extract frames
 * @param {string} outputDir - Directory to save extracted frames
 * @returns {Promise<string[]>} Array of paths to extracted frame images
 */
async function extractFrames(videoPath, timestamps, outputDir) {
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    throw new Error('ffmpeg is not installed. Install it with: apt-get install ffmpeg (Linux) or brew install ffmpeg (Mac)');
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const framePaths = [];

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const outputPath = path.join(outputDir, `frame_${timestamp}s.jpg`);

    // Extract single frame at timestamp
    const cmd = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}" -y 2>&1`;

    try {
      await execAsync(cmd);
      if (fs.existsSync(outputPath)) {
        framePaths.push(outputPath);
      }
    } catch (e) {
      console.error(`Failed to extract frame at ${timestamp}s:`, e.message);
    }
  }

  return framePaths;
}

/**
 * Get video duration in seconds
 */
async function getVideoDuration(videoPath) {
  try {
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`);
    return parseFloat(stdout.trim());
  } catch (e) {
    throw new Error('Failed to get video duration: ' + e.message);
  }
}

/**
 * Generate smart timestamps for frame extraction
 * Extracts frames at key moments: start, end, and evenly spaced throughout
 */
function generateTimestamps(durationSeconds, frameCount = 10) {
  if (durationSeconds <= 0) return [0];

  const timestamps = [0]; // Always include start

  if (durationSeconds > 30) {
    timestamps.push(15); // Hook/opening
  }

  // Evenly spaced frames throughout the video
  const interval = durationSeconds / (frameCount - 2);
  for (let i = 1; i < frameCount - 1; i++) {
    const t = Math.floor(interval * i);
    if (t > 0 && t < durationSeconds - 5) {
      timestamps.push(t);
    }
  }

  // Add end frame (5 seconds before end)
  if (durationSeconds > 10) {
    timestamps.push(Math.floor(durationSeconds - 5));
  }

  return [...new Set(timestamps)].sort((a, b) => a - b);
}

/**
 * Format timestamp as MM:SS
 */
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Encode image to base64 for API
 */
function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

/**
 * Download YouTube video using yt-dlp (if available)
 * Falls back to explaining limitation if not installed
 */
async function downloadYouTubeVideo(videoId, outputDir) {
  // Check if yt-dlp is available
  try {
    await execAsync('yt-dlp --version');
  } catch (e) {
    throw new Error('yt-dlp is not installed. To analyze YouTube videos, install it with: pip install yt-dlp');
  }

  const outputPath = path.join(outputDir, `${videoId}.mp4`);
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Download video (limit to 720p to save bandwidth/storage)
  const cmd = `yt-dlp -f "best[height<=720]" -o "${outputPath}" "${url}"`;

  try {
    await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 });
    return outputPath;
  } catch (e) {
    throw new Error('Failed to download YouTube video: ' + e.message);
  }
}

/**
 * Analyze video frames (main entry point)
 */
async function analyzeVideo(videoSource, options = {}) {
  const {
    frameCount = 8,
    customTimestamps = null,
    outputDir = path.join(__dirname, '.preview', 'video-frames'),
    keepFrames = false
  } = options;

  let videoPath;
  let isYouTube = false;
  let videoId = null;

  // Determine if YouTube URL or local file
  if (typeof videoSource === 'string' && (videoSource.includes('youtube.com') || videoSource.includes('youtu.be'))) {
    videoId = extractYouTubeId(videoSource);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    isYouTube = true;

    // Download video
    const downloadDir = path.join(outputDir, 'downloads');
    fs.mkdirSync(downloadDir, { recursive: true });
    videoPath = await downloadYouTubeVideo(videoId, downloadDir);
  } else {
    // Local video file
    videoPath = videoSource;
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found: ' + videoPath);
    }
  }

  // Get video duration
  const duration = await getVideoDuration(videoPath);

  // Generate or use custom timestamps
  const timestamps = customTimestamps || generateTimestamps(duration, frameCount);

  // Extract frames
  const frameDir = path.join(outputDir, 'frames', Date.now().toString());
  const framePaths = await extractFrames(videoPath, timestamps, frameDir);

  // Prepare frame data with timestamps
  const frames = framePaths.map((framePath, index) => {
    const timestamp = timestamps[index];
    return {
      path: framePath,
      timestamp: timestamp,
      timestampFormatted: formatTimestamp(timestamp),
      base64: imageToBase64(framePath)
    };
  });

  // Cleanup
  if (!keepFrames) {
    // Keep frames for now, cleanup later
    // frames.forEach(f => fs.unlinkSync(f.path));
  }

  return {
    videoPath,
    isYouTube,
    youtubeId: videoId,
    duration,
    durationFormatted: formatTimestamp(duration),
    frames,
    frameCount: frames.length
  };
}

module.exports = {
  analyzeVideo,
  extractFrames,
  getVideoDuration,
  generateTimestamps,
  formatTimestamp,
  extractYouTubeId,
  checkFFmpeg
};

// CLI usage
if (require.main === module) {
  const videoSource = process.argv[2];

  if (!videoSource) {
    console.log('Usage: node video-analyzer.js <youtube-url-or-video-file>');
    console.log('Example: node video-analyzer.js https://youtube.com/watch?v=xxx');
    console.log('Example: node video-analyzer.js /path/to/video.mp4');
    process.exit(1);
  }

  analyzeVideo(videoSource, { frameCount: 10, keepFrames: true })
    .then(result => {
      console.log('\n✓ Video analyzed successfully');
      console.log(`Duration: ${result.durationFormatted}`);
      console.log(`Frames extracted: ${result.frameCount}`);
      console.log('\nFrames at timestamps:');
      result.frames.forEach(f => {
        console.log(`  ${f.timestampFormatted} - ${f.path}`);
      });
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
