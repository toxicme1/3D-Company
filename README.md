# 3D-Company

## Run Company Floor

On Linux, install the latest version from GitHub without cloning the repository:

```bash
curl -fsSL https://raw.githubusercontent.com/toxicme1/3D-Company/main/install.sh | bash
```

After confirming `~/.local/bin` is on your PATH, run `3DCOMPANY` from any terminal. On first run it asks for your OpenRouter/OmniRoute-compatible Base URL, API key, and model, saves them locally, starts the bridge, and opens the app. Later runs reuse the saved settings. Use `3DCOMPANY --setup` to change provider settings.

Alternatively, if you already cloned the repository, run `npm link` from its root.

See [Company Floor setup](./Company_Floor/company-floor/SETUP.md) for details.