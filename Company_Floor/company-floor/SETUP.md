# Setup guide: connect an OpenAI-compatible API

## 1. What you need
- Node.js 18 or newer.
- A modern browser with WebGL and internet access for the 3D libraries.
- An API key from OpenRouter or another OpenAI-compatible provider.

## 2. Install from the private GitHub repository on Linux
Install GitHub CLI and sign in first if needed (`gh auth login`). Then run:

```bash
gh api -H 'Accept: application/vnd.github.raw' \
  'repos/toxicme1/3D-Company/contents/install.sh?ref=main' \
  | GH_TOKEN="$(gh auth token)" bash
```

This fetches the installer and source archive using your GitHub CLI login. It installs under `~/.local/share/3d-company` and creates `~/.local/bin/3DCOMPANY`. It requires `gh`, `curl`, `tar`, and Node.js 18 or newer; it does not require `git` or `sudo`.

If the repo is public, this simpler command works without GitHub CLI:

```bash
curl -fsSL https://raw.githubusercontent.com/toxicme1/3D-Company/main/install.sh | bash
```

If prompted to add `~/.local/bin` to your PATH, run:

    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
    source ~/.bashrc

Then run `3DCOMPANY`.

If you already cloned the repository, you can instead install the command with `npm link` from its root:

    npm link

This registers the command on npm's global executable path. Then `3DCOMPANY` can be run from any terminal folder.

## 3. First run and provider setup
Run:

    3DCOMPANY

The first run asks for your API Base URL and API key, then fetches the provider's `/models` endpoint and lets you select an available model. The API key is entered without echoing it and the settings are saved in the Git-ignored `setting.json` beside the app. Next runs reuse the saved settings. To change them later, run `3DCOMPANY --setup`. Run `3DCOMPANY --test-api` at any time to fetch and display the configured provider's available models without starting the app.

If model fetching fails, setup displays the provider's error and defaults to cancelling. You can explicitly continue and enter a model manually if your provider doesn't implement the OpenAI-compatible `/models` endpoint. A successful models response confirms that the endpoint is reachable; providers that allow public model listings may not validate the API key until a chat request is made.

Defaults are OpenRouter-compatible:

```json
{
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKey": "YOUR_API_KEY",
  "model": "openai/gpt-4o-mini",
  "timeoutMs": 120000
}
```

For OmniRoute or another provider, enter its OpenAI-compatible API base URL and model identifier. The bridge appends `/chat/completions`. Remote URLs must use HTTPS; HTTP is allowed only for a local endpoint. Keep `setting.json` private: it contains your API key and is excluded from Git.

The launcher starts the API bridge and opens the page with its local connection prefilled. Keep the terminal open while using the app; press Ctrl+C to stop the bridge.

The bridge sends chat prompts and role-profile text to the configured provider. The API model cannot run commands or edit files. The 3D meetings and office work are simulations; approval controls that simulation, not API requests already sent from chat.

## 4. Optional: Social Media Co.
1. Copy `social-proxy.env.example` to `.env` next to `social-proxy.js` and fill in credentials for the platforms you use.
2. Set `SOCIAL_PROXY_KEY` in the environment where you start `api-bridge.js`, using the same value as in `.env`.
3. Start the proxy with `node social-proxy.js`.

YouTube posting waits for in-app approval and defaults to private. Instagram and TikTok posting are not implemented. Reports only use public fields the proxy can fetch; the model cannot watch videos.

## 5. Troubleshooting
- **Missing API key/config:** check `setting.json` has non-empty `baseUrl`, `apiKey`, and `model`.
- **401/403:** verify the key and model access with your provider.
- **404:** check the provider's base URL; the bridge appends `/chat/completions`.
- **Timeout:** increase `timeoutMs` (maximum 600000).
- **Port busy:** start with `node api-bridge.js --port 8788` and connect to the printed URL.
