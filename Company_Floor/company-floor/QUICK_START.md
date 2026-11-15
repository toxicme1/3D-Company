# Video Studio - Quick Start

## Install the feature branch

For an existing private-repository installation, update from the feature branch:

```bash
gh api -H 'Accept: application/vnd.github.raw' \
  'repos/toxicme1/3D-Company/contents/install.sh?ref=feature/agent-workflow-and-tools' \
  | GH_TOKEN="$(gh auth token)" bash -s -- --update --ref feature/agent-workflow-and-tools
```

The updater preserves your API settings and workspace. Run `3DCOMPANY` again after it completes.

## Install video tools

Video frame extraction requires `ffmpeg`:

```bash
sudo apt-get update && sudo apt-get install -y ffmpeg
```

YouTube URL analysis also requires `yt-dlp` and confirmation that you have permission to download/process that video:

```bash
python3 -m pip install --user yt-dlp
```

The bridge uses the API settings you configured for Company Floor. Choose a vision-capable model.

## Analyze a video

1. Start `3DCOMPANY` and keep its terminal open.
2. Select **Video Studio Co.** in the floor's **Go to** controls to see the studio.
3. Open **Tools → Video**.
4. Choose an MP4, MOV, or WebM file, or enter a YouTube URL. Add a question and select **Analyze video**.
5. To analyze a YouTube URL, check the permission confirmation first.

The app samples up to six frames and sends those images and your question to the configured AI provider. Answers are required to cite sampled-frame timestamps. It does not transcribe audio, and it may miss events between sampled frames. Recent results are stored in browser local storage.

## Troubleshooting

- **ffmpeg not found:** install it and restart `3DCOMPANY`.
- **Model cannot analyze images:** choose a vision-capable provider/model in `3DCOMPANY --setup`.
- **YouTube analysis fails:** install `yt-dlp`, check the URL, and confirm permission to process/download the video.
- **Bridge offline:** keep the `3DCOMPANY` terminal open and reconnect the bridge in the chat panel.

The `video-analyzer.js` CLI can also extract frames for inspection:

```bash
node video-analyzer.js /path/to/video.mp4
node video-analyzer.js 'https://www.youtube.com/watch?v=VIDEO_ID' --i-have-permission
```
