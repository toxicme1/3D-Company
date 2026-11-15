# Video Studio Co.

Video Studio Co. is a separate, labeled building on the 3D floor. Its **Tools → Video** panel accepts local video uploads or YouTube URLs and sends sampled frames to the configured vision-capable AI provider.

## Requirements

- Node.js 18 or newer and a configured Company Floor API provider.
- `ffmpeg` for frame extraction.
- `yt-dlp` only for YouTube URLs.
- A vision-capable model configured through `3DCOMPANY --setup`.

On Ubuntu/Debian:

```bash
sudo apt-get update && sudo apt-get install -y ffmpeg
python3 -m pip install --user yt-dlp
```

Local uploads support MP4, MOV, and WebM files up to 150 MB and videos up to three hours. The app extracts at most six resized frames. It does not continuously watch the video or transcribe audio, so it may miss events between sampled frames and cannot verify spoken dialogue. Every video-content claim in the answer is instructed to cite a sampled timestamp.

YouTube processing uses `yt-dlp` to download the video temporarily for frame extraction. Only analyze a video if you have permission to download/process it; the UI requires an explicit confirmation. Temporary upload and frame files are removed after the request finishes. Sampled images and the question are sent to the configured AI provider.

## Use it

1. Update the installed app from the Video Studio feature branch using [QUICK_START.md](QUICK_START.md).
2. Run `3DCOMPANY` and keep its terminal open.
3. Use the **Go to → Video Studio Co.** control to view the building.
4. Open **Tools → Video**, choose a file or enter a YouTube URL, ask a question, and select **Analyze video**.

Recent analysis results are saved locally in the browser's storage. They are not stored in a server-side database or searchable across devices.

## CLI frame extraction

The CLI extracts frames for inspection; it does not call the AI provider or produce a summary:

```bash
node video-analyzer.js /path/to/video.mp4
node video-analyzer.js 'https://www.youtube.com/watch?v=VIDEO_ID' --i-have-permission
```
