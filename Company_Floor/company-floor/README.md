# Company Floor

A 3D office floor with 16 offices, 80 agents and a CEO.

## Run it
Open `index.html` in a modern browser with WebGL and internet access for the 3D libraries. Keep the files together.

To launch with a setup wizard, install the global command once with `npm link` from the repository root, then run `3DCOMPANY` in a terminal. It saves provider settings on first run, starts the local API bridge, and opens the page. See [SETUP.md](SETUP.md). Without the bridge, the browser uses simulated agents.

## API bridge
`api-bridge.js` connects the page to OpenRouter or another OpenAI-compatible chat-completions API. The provider URL, API key, model, and timeout are configured in `setting.json` (copy `setting.example.json`). The API key remains on the local bridge and is not sent to the browser. The bridge binds to `127.0.0.1` and uses a token in its WebSocket URL.

The bridge sends the latest chat message and the selected role profile to the model. It does not expose local files, run commands, or modify code. The animated meetings and office work are simulations; the plan approval only gates the simulation, not API requests already sent from chat.

## How a task flows
1. Give the CEO a task in chat or the task box. The browser selects relevant offices; Product & Planning, Cost & Budget, QA & Testing, and Review & Approvals are always included.
2. The 3D scene animates a meeting. Heads use preset proposal lines, and the browser builds one plan.
3. You can approve or revise the simulated plan. The scene animates teams working, then reports simulated completion.

This project flow is a visual simulation, not a workflow engine that dispatches coding work to each office. API chat is separate and calls the configured model for a response.

## CEO staff directory and office visits
The CEO chat receives the live staff directory, including names, roles, and offices, so it can answer questions such as “What does Amina do?” or “List all employees and their roles.” To bring one person to the CEO office, ask “Call Amina to your office” or “Summon the Head of Security.” The person walks over for a brief visual visit, then returns to their desk. Only one person can visit at a time; the CEO will explain if they are away or another meeting is in progress. This is a scene simulation, not a real conversation with an employee.

## Files
- `index.html`: 3D scene, chat UI, and simulation.
- `agent-brain.js`: keyword-based message routing, role reasoning, and plan formatting.
- `company-brain.json`: offices, roles, keywords, people, plan stages, and rules.
- `company-brain.js`: generated from the JSON.
- `agent-map.json`: maps office roles to prompt profiles under `Workspace/agents/`.
- `build.js`: regenerates the generated JavaScript files.
- `api-bridge.js`: local WebSocket server and API client.
- `setting.example.json`: safe template for the private `setting.json`.
- `social-proxy.js`: optional social-account proxy.

## Offices (16)
Front End Dev, Back End Dev, Skill Management, MCP Management, Research Agents, Memory & Context, QA & Testing, DevOps, Security, Orchestrator, Design & UX, Data & Analytics, Product & Planning, Docs & Knowledge, Cost & Budget, and Review & Approvals.

## Adding an office
Add it to `company-brain.json` (office, 5 roles, 5 people, and a stage), then add its name, 5 names, and 5 roles to the arrays in `index.html` (`OFFICE_NAMES`, `NAMES`, `ROLES`, `FAVOUR`, `HEAD_LINE`). Each new pair of offices needs one more annex on the east side.

## Office screens and previews
Each office has a screen. Simulated projects show labelled mockups. A real preview can be displayed when an HTML file is placed in `Workspace/.preview/`; the bridge forwards recent files to the page and stores preview metadata for restart. Since the API model cannot write files, create previews yourself or through a separate tool. The preview viewer uses a sandboxed iframe with network access blocked.

## Social Media Co.
A separate company in its own building south of the main one, with Instagram, TikTok, and YouTube offices. Ask in chat:
- `ask YouTube to look at https://youtu.be/ID and report to Product & Planning`
- `post social/outbox/clip.mp4 to youtube titled My clip` (include `public` for a public upload; private is the default)

Reports are limited to public fields the proxy can fetch: YouTube and TikTok oEmbed data, plus YouTube views, likes, and description if `YOUTUBE_API_KEY` is configured. The model cannot watch videos. Instagram has no public post data without an approved app token. YouTube uploads wait for approval; Instagram and TikTok posting are not implemented.

## Tools panel
Install reviews a link for an agent profile or skill and asks for approval before saving under `Workspace/agents/` or `Workspace/skills/`. Approvals also gate social uploads. History is kept locally in `Workspace/.os/jobs.jsonl`. The Social tab shows proxy account status. Scene controls sound and day/night lighting.

## Social proxy
The optional `social-proxy.js` binds to `127.0.0.1`, requires `SOCIAL_PROXY_KEY`, uses random OAuth state, encrypts OAuth tokens, and defaults uploads to private. Copy `social-proxy.env.example` to `.env` and set `TOKEN_ENCRYPTION_KEY` (64 hex characters) and `SOCIAL_PROXY_KEY`.

## Layout
The two buildings are 14 m apart (main building z -20..20, Social Media Co. z 36..56), connected by a paved path. Courier robots carry requests and reports between offices and buildings.
