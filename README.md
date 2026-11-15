# 3D-Company

## Run Company Floor

The repository is private, so first install and authenticate GitHub CLI if needed (`gh auth login`). Then install directly from GitHub on Linux:

```bash
gh api -H 'Accept: application/vnd.github.raw' \
  'repos/toxicme1/3D-Company/contents/install.sh?ref=main' \
  | GH_TOKEN="$(gh auth token)" bash
```

This keeps the repo private and installs the latest version without cloning it. After confirming `~/.local/bin` is on your PATH, run `3DCOMPANY` from any terminal. On first run it asks for your OpenRouter/OmniRoute-compatible Base URL and API key, fetches the provider's model list, and lets you choose a model. Later runs reuse the saved settings. Use `3DCOMPANY --setup` to change provider settings or `3DCOMPANY --test-api` to fetch and display the configured provider's models.

To update an existing installation with the Video Studio feature branch, run:

```bash
gh api -H 'Accept: application/vnd.github.raw' \
  'repos/toxicme1/3D-Company/contents/install.sh?ref=feature/agent-workflow-and-tools' \
  | GH_TOKEN="$(gh auth token)" bash -s -- --update --ref feature/agent-workflow-and-tools
```

The updater refreshes app files while preserving your API settings and workspace. Then launch `3DCOMPANY` and select **Video Studio Co.** in the floor controls, or open **Tools → Video** to analyze a video. You need `ffmpeg`; analyzing a YouTube URL also needs `yt-dlp` and confirmation that you have permission to download/process it.

If the repository is made public later, the shorter unauthenticated command also works:

```bash
curl -fsSL https://raw.githubusercontent.com/toxicme1/3D-Company/main/install.sh | bash
```

Alternatively, if you already cloned the repository, run `npm link` from its root.

See [Company Floor setup](./Company_Floor/company-floor/SETUP.md) for details.