# Changelog

New releases and improvements to TermCoder.

## 0.11.4
2026-07-23

### Desktop
- **Fixed: the app would not open.** On 0.11.3 the desktop app could fail to start with no window and no error — a regression from the new local database. Its native module was bundled incorrectly, so it could not load at launch and startup aborted before the window appeared. The module is now loaded correctly, and if startup ever fails again the app opens and shows the error instead of doing nothing. Update to 0.11.4 if 0.11.3 would not launch.

## 0.11.3
2026-07-23

### Desktop
- **A calmer, redesigned app.** The desktop app was rebuilt around a quieter, monochrome look — the orange accent is gone. An empty session now opens on a spacious Home with the TermCoder wordmark, the title bar is a slim seamless strip with a left-aligned tab row, and the composer, model browser and settings were all restyled to match.
- **Your project and branch, in the composer.** The prompt box now shows the current project and its git branch as small pills, so you always know where a run will land.
- **A quieter way to move around a session.** The stamped centre tabs were replaced by an unobtrusive view switcher, so jumping between chat, terminals and the canvas no longer dominates the header.
- **The Agent Canvas, explored deeper.** The Canvas tab gained a zoomable, pannable viewport with fit-to-view, per-node metrics (tokens and time), collapsible sub-agent branches, and a richer inspector — so a large delegated run stays navigable instead of overflowing the screen.

### Core
- **Sessions are now stored in a local database.** History moved from loose JSON files to a single SQLite store with full-text search over your past sessions. Existing sessions migrate themselves once, automatically, the first time you open the new version.
- **CodeMode — one program instead of many round-trips.** A new opt-in `run_code` tool lets the agent write a single, confined JavaScript program that calls your read and analysis tools together in one pass, instead of a long back-and-forth of separate tool calls. It runs behind a permission prompt, exactly like a shell command, and is never handed to read-only agents.
- **A bigger plugin system.** Plugins can now register slash commands and react to session events as they stream, carry a name, version and description, and be auto-discovered from `~/.termcoder/plugins/` — all on top of the existing ability to add tools. Plugin-added tools go through the same permission checks as the built-ins.

## 0.11.2
2026-07-20

### Desktop
- **Agent canvas.** A new Canvas tab visualizes a run as it happens: the main agent and every sub-agent it spawns appear as connected nodes, each pulsing while it works. Click a node to open its brain — the sub-agent's own live reasoning and the tools it is running — so you can watch delegated work instead of only seeing a final summary.
- **Resizable terminal grid.** The terminal grid's dividers are now draggable on both axes — widen the pane you are working in and shrink the others — with a double-click to reset and the sizes remembered per number of terminals. Tabs view is unchanged.
- **Live rooms, rebuilt.** The room panel is now a call-first screen: the video stage is the focus, and the camera and screen-share controls are visible up front (they enable once you join) instead of hidden until you were already in the call. Invite, participants, and chat move into a tidier side rail with a one-click Share.

### Core
- Sub-agents now stream their events to the app while they work, so tools and views can follow a delegated task live. The main chat transcript is unaffected — the forwarded events feed only the canvas.

## 0.11.1
2026-07-19

### Security
- **The file-search tools could reach outside your project.** `glob` and `grep` accepted a search pattern that could point above the folder you opened, letting them list and read files elsewhere on your machine. They are now confined to the project: a pattern pointing outside is refused, and every match is re-checked against the project root before the file is read.
- **Fetching a URL and searching the web now ask for permission.** Both tools run under a new `network` permission, which you can set per project or per agent. This is a visible change: the first web search or fetch in a session now prompts, and you can allow it for the rest of the session. The prompt shows the address being contacted.
- Both web tools now refuse addresses on your own machine or local network, and re-check after each redirect.
- **A tool that declares a permission is now always checked.** Read-only tools previously skipped the permission check entirely — which is why the two changes above needed this fix to take effect at all.
- **Auto-approve no longer covers network access.** Turning on "auto-approve" still runs file and command actions without asking, but a URL fetch or web search always asks and shows its destination — including during autonomous runs, where it matters most.
- Read-only agents now deny network access along with writing, editing and shell commands.

Updating is recommended if you open projects you did not write yourself, or run agents over untrusted input such as fetched web pages or issue text.

## 0.11.0
2026-07-19

### Security
- **Fixed a critical local-network exposure.** The built-in server listened on every network interface with no authentication, so anyone on the same network — a café, an office, shared Wi-Fi — could list your sessions, connect as the host and drive your agent: run prompts, approve permission requests, stop work. Your memory was readable the same way. The server now listens on localhost only. **Versions 0.10.0 and earlier are affected; update if you ever run TermCoder on a network you do not control.**
- Hosting a Live Room now opens a separate, room-only listener on the network. It serves the room and nothing else — every other route is unreachable from it, and joining requires a room invite token. Your sessions, memory and configuration are never reachable from the network at all.
- Guests in a Live Room are observers, enforced on the server: they can watch and chat, but cannot prompt the agent, approve permissions, or stop a run.
- Room invites now carry a rotatable join token instead of the session id, so an invite no longer leaks the session it points at.
- The `termcoder serve` command keeps a `HOST` override for headless use, and now warns plainly when it exposes an unauthenticated server on the network.

### Core
- The model's reasoning is now emitted as it streams, behind a reasoning toggle.
- Added a settings store that merges key by key, so syncing settings from another device no longer clobbers unrelated keys.
- Synced MCP connector references resolve against the local catalogue only, so a synced setting can never point your machine at an unvetted server.

### CLI
- The model's reasoning renders as it streams, in a dimmed collapsible thinking panel.
- The status bar shows the active model and agent, and stays on one line at 80 columns.

### Desktop
- Terminals now tile side by side in a grid, with a toggle to switch back to tabs.
- Live Rooms were rebuilt as a real call UI: a video stage instead of a modal, an explicit Join so opening a room no longer grabs your microphone, and an in-call indicator.
- You can join a room from an invite link alone, without a local session.
- Opening a new session from the navbar returns you to the chat instead of stranding you on the terminal.

### Website
- Rebuilt the site: new landing, pricing, features, study, docs, install and download pages, a session viewer, and a changelog generated from this file.
- The dashboard gained a real settings panel — theme, model and reasoning — that syncs to your desktop, plus favourite models and a licence panel.
- You can enable a vetted MCP connector from the dashboard.
- **Get Pro** is wired to checkout, and a completed purchase issues a signed licence key.

## 0.10.0
2026-07-14

### Core
- Added offline licence verification with Ed25519 signed keys, checked against an embedded public key — no account, no server.
- Gated hosting behind a licence: rooms with more than one participant, and creating, assigning or grading a classroom, now return `402` when unlicensed. Joining any room or class stays free.
- Added `gradeSubmission` and `listGrades` for classroom marking over gist comments.
- Added `pushSessions` / `pullSessions` and `resolveSyncGistId`, so a fresh device can find its own sync gist by description.
- `SessionStore.import` now preserves `updatedAt` instead of stamping the import time.

### Desktop
- Added a classrooms panel: create or join a class, browse assignments, see the roster, review submissions, and give a grade with feedback.
- Added a **termcoder Pro** settings tab to activate a key, and routed every `402` to it.
- Added a recipes panel to browse, run and create saved workflows.
- Added a "Sync sessions" action for licensed users.
- Messages now glide into the thread on send, the terminal shows a blinking caret while a reply streams, and a live token count ticks as it works.
- MCP servers that drop now reconnect on their own instead of dying.

### Website
- Added a pricing page.
- The dashboard now reads your real synced study data instead of dressing sample rows up as live ones.

## 0.9.0
2026-07-13

### Core
- Added live rooms: one shared room per session on the server, broadcasting every agent event, presence and chat to all sockets. A solo client is simply a room of one, so nothing changed for single users.
- Any participant can answer a permission request — it is broadcast, and the first decision wins.
- Added a WebRTC signalling relay, `room-welcome` / `room-presence` / `peer-left` events, and `GET /room/addresses` for LAN invite links.
- Added a curated MCP connector catalogue — ten one-click connectors with a declarative input model — and taught the HTTP transport to send auth headers, so hosted token servers work at all.
- Added recipes: saved multi-step workflows as markdown in `.termcoder/recipes`, with a `recipe` tool.
- Routed Anthropic to `claude-sonnet-5`, replacing the superseded `claude-sonnet-4-6` across the router, defaults, catalogue and picker.
- Made the keyless tier resilient: three retries with escalating backoff, transient-error detection, and fail-fast on auth errors instead of burning retries.

### Desktop
- Added a live room panel: invite links, participants, room chat, and a call with voice, camera and screen share — peer-to-peer over STUN, with no media server.
- Added multiple terminals: session-scoped shells with a tab strip, each surviving a tab switch.
- Added the connector picker to Settings → Integrations.

### CLI
- Added `/connectors`, `/mcp`, `/mcp add`, `/recipe` and `/recipes`.

### Website
- Added sign-in with GitHub or Google, and a logged-in dashboard. The token exchange runs in a Cloudflare Worker, so the client secrets never reach the browser.

## 0.8.2
2026-07-10

### Core
- Fixed the keyless model naming a tool `bash<|channel|>commentary` — a stray token from its own format leaking into the name, so the call matched nothing and the model gave up with the job half done. A new eval measured it: a one-line bug-fix task that failed every time now passes every time.

### CLI
- Added a nudge, once per session and only while you are on the free tier, at the moment the limit bites — after a rate-limit or a slow turn.
- `/upgrade` and `/connect` stopped calling subscription login "coming soon"; it shipped in 0.8.0.

## 0.8.1
2026-07-10

### Core
- Fixed the keyless model never being able to use a tool. On every follow-up request the upstream endpoint sent a tool-call continuation with a bumped `index` and no `id`, and the AI SDK rejected the stream — so it could chat, but never edit a file or run a command. If you tried TermCoder without a key before this, that is why it did nothing.

### Desktop
- Added `Chat | Terminal` tabs (`Ctrl`+`` ` ``): your default shell in the project folder, with a one-click chip for each coding CLI found on `PATH` — Claude Code, Codex, Gemini CLI, termcoder. The shell keeps running while you are on the Chat tab.
- The real brand mark now appears in the rail, hero and welcome screen.

### Website
- Rebuilt on one stylesheet instead of four private copies, with a hero that replays a session genuinely recorded with the keyless model rather than a mockup of one.

## 0.8.0
2026-07-09

The biggest release of the roadmap: TermCoder now remembers you, finds the right files on its own, talks to every major provider without hanging, lets you sign in with a subscription instead of an API key, and the desktop app was rebuilt from the shell up.

### Core
- Added a provider registry covering twelve backends — Anthropic, OpenAI, Google, Groq, OpenRouter, Mistral, DeepSeek, xAI, Together, Cerebras, Ollama and Pollinations — all through one OpenAI-compatible path.
- A stream that stops producing tokens is now aborted after an idle timeout instead of hanging forever, and the router skips providers it has seen fail.
- `/key` now probes the key with a real one-token request, so the picker's `●` means "this works" rather than "a string is set". The old picker lied.
- Added memory: durable notes in `.termcoder/memory/*.md` shared through git, plus a private user store. Only names and descriptions enter the prompt; bodies load on demand. A secret guard refuses to store anything that looks like a credential.
- Added retrieval: lexical ranking over the project — no embeddings, no index server, no new dependency — injecting file and symbol *pointers* rather than file bodies.
- Added subscription login for **Claude Pro/Max** (PKCE) and **ChatGPT Plus/Pro** (device code). Tokens refresh automatically and live in the gitignored config, never synced. Both are experimental: they reuse the vendors' own client credentials the way their official CLIs do, which is a grey area in their terms — especially OpenAI's — so both fail gracefully back to the keyless model.
- Session token usage is now persisted and shown per session.

### Desktop
- Rebuilt around a 48px icon rail: sessions, files, study and agents are one click from anywhere.
- The chat is a centred column with a floating composer that absorbed the old status bar; tool calls are collapsible cards; files, study and agents slide over the chat instead of stealing a third of the window.
- Everything sits on a three-layer surface system that all nine colour themes derive from automatically. The light theme finally gets the brand's orange accent instead of a grey one.
- `target="_blank"` links now open in the system browser, not inside the app.

## 0.6.0
2026-07-04

### Core
- A transient stream error before any text now retries the same model once, then falls back to the best model you have a key for — announcing the switch — instead of surfacing an error. Retries no longer consume the step budget.
- Connect failures are now recognised and explained instead of reported as a generic error.

### CLI
- Added `/upgrade`: a guided path to a free Gemini key, short-circuited if you already have one.

### Desktop
- Added a dismissible upgrade card to the empty state for anyone still on the keyless model.

## 0.5.0
2026-07-03

### Core
- Added a GitHub backbone: a client for gists and repo reads, sync that mirrors favourites and drafts to one private gist, and packs that bundle `.termcoder/{agents,skills,commands}` into a gist or read them from `owner/repo`.
- Added study: SM-2 spaced repetition with a real scheduler, deck and progress stores, a daily streak, and flashcard generation from any topic.
- Added autonomous mode: a loop that drives a goal, runs your verify command, feeds the failure back, and repeats until it passes, is done, or hits the round cap.
- Added classrooms: a class is one secret gist with a manifest, while joins, submissions and the roster ride on gist comments — asynchronous, with nothing to host.
- A shared session can now be imported from a gist and re-opened as a session.

### CLI
- Added `/login`, `/logout`, `/sync`, `/publish`, `/import`, `/pack`, `/flashcards`, `/decks`, `/review`, `/background` and `/class`.
- Added review mode: front → reveal → grade 0–5.

### Desktop
- Added a study overlay with decks, due counts, streak, topic generation and a review flow.
- Added an autonomous toggle to the composer.

### Website
- Added a hosted session viewer: paste a gist link and read a shared transcript with no install.
- The desktop UI now runs in a browser, served by the local server over your LAN.

## 0.1.7
2026-07-03

### CLI
- Fixed a large empty gap under the reply: the composer was being pinned to the bottom of the terminal while chatting, not just on the home screen.
- The home screen now centres the hero and composer, with a minimal `folder … version` footer pinned to the bottom.
- Added an advanced model picker: grouped and searchable, with `●` ready / `○` needs-key states, badges, favourites, and `＋ Add model` for any `provider/model` id.
- Added `/setup` and `/key <provider> <key>`, so a model can be configured without leaving the CLI. The readiness dot flips green live.
- Added `/suggest`: one cheap call that proposes the next step and fills the composer with it — on demand only, never per turn.
- Added a trust prompt on first open. It asks before the interface appears, not after.
