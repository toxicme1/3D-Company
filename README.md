# 3D-Company

## Run Company Floor

The repository is private, so first install and authenticate GitHub CLI if needed (`gh auth login`). Then install directly from GitHub on Linux:

```bash
gh api -H 'Accept: application/vnd.github.raw' \
  'repos/toxicme1/3D-Company/contents/install.sh?ref=main' \
  | GH_TOKEN="$(gh auth token)" bash
```

This keeps the repo private and installs the latest version without cloning it. After confirming `~/.local/bin` is on your PATH, run `3DCOMPANY` from any terminal. On first run it asks for your OpenRouter/OmniRoute-compatible Base URL, API key, and model, saves them locally, starts the bridge, and opens the app. Later runs reuse the saved settings. Use `3DCOMPANY --setup` to change provider settings.

If the repository is made public later, the shorter unauthenticated command also works:

```bash
curl -fsSL https://raw.githubusercontent.com/toxicme1/3D-Company/main/install.sh | bash
```

Alternatively, if you already cloned the repository, run `npm link` from its root.

See [Company Floor setup](./Company_Floor/company-floor/SETUP.md) for details.