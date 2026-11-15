# Video Studio - Quick Start

## Get Your Video Studio Watching Videos in 3 Steps

### Step 1: Install Required Tools (5 minutes)

```bash
# Install ffmpeg (to extract video frames)
sudo apt-get update && sudo apt-get install -y ffmpeg

# Optional: Install yt-dlp for YouTube videos
pip3 install yt-dlp

# Verify installation
ffmpeg -version
yt-dlp --version
```

### Step 2: Create setting.json (1 minute)

Create `setting.json` in this directory with your API key:

```json
{
  "baseUrl": "https://api.anthropic.com/v1",
  "apiKey": "sk-ant-...",
  "model": "claude-3-5-sonnet-20241022",
  "timeoutMs": 120000
}
```

**Get Claude API key:** https://console.anthropic.com/settings/keys

**Or use OpenRouter** (supports multiple providers):
```json
{
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKey": "sk-or-v1-...",
  "model": "anthropic/claude-3.5-sonnet",
  "timeoutMs": 120000
}
```

**Get OpenRouter key:** https://openrouter.ai/keys

### Step 3: Test It (1 minute)

```bash
# Test with a local video file
node video-analyzer.js /path/to/your/video.mp4

# Or test with YouTube
node video-analyzer.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

You should see:
```
✓ Video analyzed successfully
Duration: 3:32
Frames extracted: 8

Frames at timestamps:
  0:00 - /path/to/frame_0s.jpg
  0:15 - /path/to/frame_15s.jpg
  ...
```

## That's It! 🎉

Your Video Studio can now:
- ✅ Watch YouTube videos
- ✅ Analyze local video files (MP4, MOV, WebM)
- ✅ Answer questions about video content
- ✅ Find specific moments with timestamps
- ✅ Extract key information

## Example Usage

Ask your video-researcher agent:

```
"Watch this video and tell me what it's about:
https://www.youtube.com/watch?v=xxxxx"
```

```
"Where do they explain the pricing model?"
```

```
"What are the main points covered in this video?"
```

```
"Find all mentions of [product name] and give me timestamps"
```

## Minimal Setup (Just Local Videos)

If you only want to analyze local video files (no YouTube):

1. Install only ffmpeg: `sudo apt-get install ffmpeg`
2. Create setting.json with your API key
3. Done!

Skip yt-dlp if you don't need YouTube support.

## Need Help?

See full documentation: `VIDEO_SETUP.md`

## Current Status (2026-11-15)

- ✅ Video analyzer created (`video-analyzer.js`)
- ✅ video-researcher agent updated with vision capabilities
- ⏳ Waiting for: ffmpeg installation
- ⏳ Waiting for: setting.json with API key
