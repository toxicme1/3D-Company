# Setup guide: connect an OpenAI-compatible API

## 1. What you need
- Node.js 18 or newer.
- A modern browser with WebGL and internet access for the 3D libraries.
- An API key from OpenRouter or another OpenAI-compatible provider.

## 2. Install the `3DCOMPANY` command (once)
From the repository root, run:

    npm link

This registers the command on npm's global executable path. Then `3DCOMPANY` can be run from any terminal folder. If the command is not found, add npm's global bin directory to your PATH (on Windows, restart the terminal after changing PATH).

## 3. First run and provider setup
Run:

    3DCOMPANY

The first run asks for your API Base URL, API key, and model. The API key is entered without echoing it and the settings are saved in the Git-ignored `setting.json` beside the app. Next runs reuse the saved settings. To change them later, run `3DCOMPANY --setup`.

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
