# Company Floor

A 3D office floor with 16 main-company offices, 80 agents, a CEO, Social Media Co., and Video Studio Co.

## Run it
Open `index.html` in a modern browser with WebGL and internet access for the 3D libraries. Keep the files together.

To launch with a setup wizard, install the global command once with `npm link` from the repository root, then run `3DCOMPANY` in a terminal. It saves provider settings on first run, starts the local API bridge, and opens the page. See [SETUP.md](SETUP.md). Without the bridge, the browser uses simulated agents.

## API bridge
`api-bridge.js` connects the page to OpenRouter or another OpenAI-compatible chat-completions API. The provider URL, API key, model, and timeout are configured in `setting.json` (copy `setting.example.json`). The API key remains on the local bridge and is not sent to the browser. The bridge binds to `127.0.0.1` and uses a token in its WebSocket URL.

Ordinary chat sends the latest message and selected role profile to the configured provider, but does not expose project files or run commands. The `/workflow` path below is different: it uses bounded workspace tools, so it is enabled only for an OpenAI-compatible provider on localhost or loopback. The bridge blocks provider redirects; a local proxy may still independently forward requests, so configure it accordingly.

## How a task flows
1. Give the CEO a task in chat or the task box. The browser selects relevant offices; Product & Planning, Cost & Budget, QA & Testing, and Review & Approvals are always included.
2. The 3D scene animates a meeting. Heads use preset proposal lines, and the browser builds one plan.
3. You can approve or revise the simulated plan. The scene animates teams working, then reports simulated completion.

The office meeting and work animations are still a visual simulation. For a real, bounded model workflow, connect the API bridge and send `/workflow <task>` in the CEO chat. The Orchestrator creates a plan with up to three specialist handoffs, QA checks the handoffs against the plan, and Review & Approvals summarizes the result. Progress and the final report appear in the CEO chat; the run is also recorded in Tools > History.

The workflow uses local role profiles and restricted tools: it can list/read eligible text files, propose a one-file patch, and ask QA to run the fixed test or Company Floor build check. File edits and every check wait for approval in Tools > Approvals; the project progress card reports the active stage, agent, approval wait, completion, or failure. Only approved patches are applied and they are rejected if the target file changed while approval was pending. Status is saved in `Workspace/.os/workflows.json` and restored when the page reconnects; interrupted workflows are marked failed rather than resumed.

The workspace defaults to the app's repository directory; when starting `api-bridge.js` directly, use `--workspace <path>` to select another root. File tools reject traversal, symlinks, binary/oversized files, and credential-like paths. Checks use fixed Node commands, no shell, and a reduced environment, but approved test/build code still executes with the current user's local permissions. Review the requested check before approving it. Providers must support OpenAI-compatible tool calls; unsupported providers fail visibly rather than falling back to simulated or model-only success. The 3D meeting remains a separate simulation.

## Video Studio Co.
Video Studio Co. is a separate building north of the main floor, with Research, Script & Story, and Editing & Review rooms. Use the **Go to → Video Studio Co.** control to view it, or open **Tools → Video** to analyze a local MP4, MOV, or WebM upload or a YouTube URL. The bridge extracts up to six frames and sends them with your question to the configured vision-capable provider. It does not continuously process the video or transcribe audio, so events between sampled frames and spoken dialogue are not analyzed. Answers are instructed to cite sampled-frame timestamps.

Install `ffmpeg` for frame extraction. YouTube analysis also requires `yt-dlp` and explicit confirmation that you have permission to download/process the video. Local uploads are limited to 150 MB and videos to three hours. Recent results are stored in browser local storage. See [QUICK_START.md](QUICK_START.md) and [VIDEO_SETUP.md](VIDEO_SETUP.md).

## CEO staff directory and office visits
The CEO chat receives the live staff directory, including names, roles, and offices, so it can answer questions such as “What does Amina do?” or “List all employees and their roles.” To bring one person to the CEO office, ask “Call Amina to your office” or “Summon the Head of Security.” The person walks over for a brief visual visit, then returns to their desk. Only one person can visit at a time; the CEO will explain if they are away or another meeting is in progress. This is a scene simulation, not a real conversation with an employee.

## Files
- `index.html`: 3D scene, chat UI, and simulation.
- `agent-brain.js`: keyword-based message routing, role reasoning, and plan formatting.
- `agent-workflow.js`: validates and runs the Orchestrator → specialist handoffs → QA → Review workflow.
- `agent-workflow.test.js`: focused tests for workflow ordering and validation.
- `workspace-tools.js`: workspace-confined file access, patch validation, and fixed project checks.
- `workspace-tools.test.js`: tests for workspace boundaries, approvals' patch preconditions, and checks.
- `workflow-approvals.js`: pending workflow approval lifecycle, timeouts, and explicit resolution.
- `workflow-approvals.test.js`: approval, decline, timeout, and setup-failure tests.
- `workflow-tool-loop.js`: bounded provider tool-call loop and handoff collection.
- `workflow-tool-loop.test.js`: tool-call validation, message handoffs, and execution-limit tests.
- `workflow-store.js`: persisted live workflow status and interrupted-run recovery.
- `workflow-store.test.js`: workflow state persistence and restart recovery tests.
- `company-brain.json`: offices, roles, keywords, people, plan stages, and rules.
- `company-brain.js`: generated from the JSON.
- `agent-map.json`: maps office roles to prompt profiles under `Workspace/agents/`.
- `build.js`: regenerates the generated JavaScript files.
- `api-bridge.js`: local WebSocket server and API client.
- `video-analyzer.js`: extracts bounded video frames for local analysis and the Video Studio API.
- `video-analyzer.test.js`: tests YouTube URL validation, timestamps, and permission gating.
- `setting.example.json`: safe template for the private `setting.json`.
- `social-proxy.js`: optional social-account proxy.

## Main company offices (16)
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
Install reviews a link for an agent profile or skill and asks for approval before saving under `Workspace/agents/` or `Workspace/skills/`. Approvals also gate social uploads. History is kept locally in `Workspace/.os/jobs.jsonl`. The Video tab keeps recent analyses in browser local storage; the Social tab shows proxy account status. Scene controls sound and day/night lighting.

## Social proxy
The optional `social-proxy.js` binds to `127.0.0.1`, requires `SOCIAL_PROXY_KEY`, uses random OAuth state, encrypts OAuth tokens, and defaults uploads to private. Copy `social-proxy.env.example` to `.env` and set `TOKEN_ENCRYPTION_KEY` (64 hex characters) and `SOCIAL_PROXY_KEY`.

## Layout
The main floor is at z -20..20. Video Studio Co. is north of it, and Social Media Co. is south. Both separate buildings have dedicated view controls.
