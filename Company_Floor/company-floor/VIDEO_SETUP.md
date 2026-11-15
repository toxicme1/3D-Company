# Video Studio Setup Guide

Your Video Studio Co. can now **actually watch and analyze videos** visually!

## What Your Video Studio Can Do

✅ **Watch videos** - Extract and analyze video frames to see what's happening
✅ **YouTube videos** - Analyze YouTube content by URL
✅ **Local videos** - Upload and analyze MP4, MOV, WebM files
✅ **Find moments** - Get timestamps for specific events or mentions
✅ **Summarize content** - Explain what happens in the video
✅ **Answer questions** - "What do they say about pricing?" → timestamp + answer
✅ **Extract info** - Pull names, products, dates, quotes, key points

## Required Software

To enable video watching, you need these tools installed:

### 1. **ffmpeg** (Extract frames from videos)
```bash
# Linux (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install -y ffmpeg

# macOS
brew install ffmpeg

# Check if installed
ffmpeg -version
```

### 2. **yt-dlp** (For YouTube videos only)
```bash
# Using pip
pip install yt-dlp

# Or using pip3
pip3 install yt-dlp

# Check if installed
yt-dlp --version
```

**Note:** yt-dlp is only needed for YouTube. Local video files work with just ffmpeg.

## Required API Configuration

Create `setting.json` in this directory:

```json
{
  "baseUrl": "https://api.anthropic.com/v1",
  "apiKey": "YOUR_CLAUDE_API_KEY_HERE",
  "model": "claude-3-5-sonnet-20241022",
  "timeoutMs": 120000
}
```

**Or use OpenRouter:**
```json
{
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKey": "YOUR_OPENROUTER_API_KEY_HERE",
  "model": "anthropic/claude-3.5-sonnet",
  "timeoutMs": 120000
}
```

**Important:** The model MUST support vision (image analysis). Vision-capable models:
- `claude-3-5-sonnet-20241022` (Claude, recommended)
- `claude-3-opus-20240229` (Claude)
- `gpt-4-vision-preview` (OpenAI via OpenRouter)
- `gpt-4o` (OpenAI via OpenRouter)
- `gemini-pro-vision` (Google via OpenRouter)

## How It Works

### 1. **Frame Extraction**
The video-analyzer extracts frames at key timestamps:
- Start (0:00)
- Hook/Opening (0:15 if video > 30s)
- Evenly spaced throughout
- End (last 5 seconds)

### 2. **Visual Analysis**
Frames are sent to a vision-capable AI model that can:
- See what's on screen
- Read text overlays
- Identify people, objects, settings
- Understand visual context

### 3. **Intelligent Responses**
The video-researcher agent combines:
- What it sees in the frames
- Temporal context (timestamps)
- Your specific question
- → Accurate, timestamped answers

## Usage Examples

### Ask video-researcher to analyze a YouTube video:
```
"Watch this YouTube video and tell me what it's about: https://youtube.com/watch?v=..."
```

### Ask specific questions:
```
"Where do they explain the pricing model?"
→ Response: "At 3:45, they show a pricing slide..."

"What products are mentioned?"
→ Response: "Product X at 1:20, Product Y at 4:35..."

"Summarize the first 2 minutes"
→ Response with visual description + key points
```

### Analyze local video:
```
"Analyze this video file: /path/to/video.mp4"
```

## Test the Setup

```bash
# Test 1: Check ffmpeg
ffmpeg -version

# Test 2: Check yt-dlp (optional, for YouTube)
yt-dlp --version

# Test 3: Test video analyzer with a local file
node video-analyzer.js /path/to/test-video.mp4

# Test 4: Test with YouTube (if yt-dlp installed)
node video-analyzer.js "https://youtube.com/watch?v=dQw4w9WgXcQ"
```

## Quick Start (Without Setup)

If you don't want to install ffmpeg/yt-dlp yet, you can:

1. **Provide video frames manually** - Take screenshots at different timestamps and upload them
2. **Use transcripts** - For YouTube videos, the system can still analyze transcripts without visual analysis
3. **Use video URLs** - Some platforms provide thumbnail previews

## What You DON'T Need

❌ YouTube Data API key - Not required for video watching
❌ Python/Streamlit - Your 3D Company already has the UI
❌ SQLite database - Your company already has conversation history
❌ Google Gemini API - Claude/GPT vision models work fine

## File Locations

- Video analyzer: `./video-analyzer.js`
- Agent profile: `../Workspace/agents/video-researcher.md`
- Extracted frames: `./.preview/video-frames/` (auto-cleaned)
- Downloaded videos: `./.preview/video-frames/downloads/` (temporary)

## Troubleshooting

### "ffmpeg is not installed"
→ Install ffmpeg (see Required Software above)

### "yt-dlp is not installed"
→ Only needed for YouTube. Install with `pip install yt-dlp` or use local videos instead

### "The API returned invalid JSON"
→ Check your setting.json has valid baseUrl and apiKey

### "Model does not support vision"
→ Make sure you're using a vision-capable model (see Required API Configuration)

## Privacy & Safety

- YouTube videos are temporarily downloaded for frame extraction (respects fair use)
- Downloaded videos are stored in `.preview/` and can be auto-deleted
- No data is sent to external services except your configured AI provider
- Local videos never leave your machine except for AI analysis

## Next Steps

Once setup is complete, your Video Studio agents can:
1. **video-researcher** → Watch and analyze videos
2. **script-writer** → Turn insights into scripts
3. **video-editor** → Plan editing based on analysis

All working together in your 3D Company! 🎬
