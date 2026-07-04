# Configuration

termcoder reads config by layering, later sources overriding earlier ones:

```
schema defaults  <  global file  <  project file  <  environment
```

- **Global:** `~/.config/termcoder/config.json` (or `$XDG_CONFIG_HOME/termcoder`).
- **Project:** the nearest `.termcoder/config.json` walking up from the working directory.
- **Environment:** `TERMCODER_MODEL`, `TERMCODER_THEME`, and provider keys.

Everything is validated against a Zod schema, so a malformed value fails loudly instead
of silently breaking later. The desktop **Settings** panel writes the same global file.

## Full example

```jsonc
{
  "model": "termcoder/auto",
  "theme": "default",
  "providers": {
    "anthropic": { "apiKey": "sk-ant-…" },
    "openai": { "baseURL": "https://api.groq.com/openai/v1", "apiKey": "gsk_…" }
  },
  "permission": { "edit": "ask", "bash": "ask", "write": "ask", "mcp": "ask" },
  "formatter": true,
  "keybinds": { "commandPalette": "mod+p" },
  "github": { "token": "ghp_…" }
}
```

## Models & providers

- `model` — a provider-qualified id, `"provider/model"`, e.g. `"anthropic/claude-sonnet-4-6"`,
  `"google/gemini-2.0-flash"`, `"ollama/llama3.1"`.
- **Works free with no API key.** Out of the box `termcoder/auto` and `termexplorer/auto`
  use `pollinations/openai` — a free, keyless, community-hosted model (GPT-OSS 20B) that
  supports chat *and* tool-calling. Nothing to install, no account. It's rate-limited at
  peak and prompts go to that public service, so for heavy or private work connect a key
  or a local model (below).
- `"termcoder/auto"` — a virtual model that routes to the best **available** provider:
  a configured key (google → anthropic → openai), then a locally-configured Ollama, then
  the free keyless service as the universal fallback. Override with
  `termcoder.route: ["ollama/qwen2.5", "anthropic/claude-sonnet-4-6"]`.
- `providers.<name>.apiKey` — falls back to the usual env vars (`ANTHROPIC_API_KEY`,
  `OPENAI_API_KEY`, `GEMINI_API_KEY`, …).
- `providers.<name>.baseURL` — point an OpenAI-compatible provider (Groq, OpenRouter, a
  local server) at its endpoint.
- **Unlimited & private:** install [Ollama](https://ollama.com), `ollama pull llama3.1`,
  then `/model ollama/llama3.1` — runs locally, no key, no quota, ever.
- **Better answers, still free:** the keyless tier is small. For much better replies connect a
  free Gemini key (`/key google …` or `/upgrade`); `termcoder/auto` then uses it automatically.
  The free tier also retries and falls back to your key on its own if it hiccups, so a flaky
  moment no longer kills a turn.

## Autonomous mode

Hand termcoder a goal and let it work unattended: it auto-approves its changes, then runs
the project's check (tests/build) and keeps fixing until the check passes or a round budget
(5) runs out. The check is detected from the project — an npm `test`/`typecheck`/`build`
script, `go build`, `cargo check`, or `pytest`.

- **CLI:** `/background <goal>` — e.g. `/background add input validation and make the tests pass`.
- **Desktop:** toggle the **🤖** button in the composer, then send your goal.

It stops on your interrupt (esc / Stop), on an error, or once the check is green. Because it
auto-approves, run it on work you can review afterward (checkpoints let you revert).

## Memory

termcoder remembers durable facts across sessions and recalls them automatically.

- **Project memory** lives in `.termcoder/memory/*.md` and is committed with your repo, so collaborators (and classmates) inherit what the agent learned about the project.
- **User memory** lives in your config dir and stays private — your global preferences.

The agent saves high-value facts on its own, and you can manage them with `/remember [project] <text>`, `/memories`, and `/forget <name>` (or the Memory tab in the desktop app). Only a compact index plus the most recent facts (up to `context.memoryChars`, default 4000) are sent to the model each turn; the rest load on demand. Secrets are never stored — a save that looks like an API key, token, or password is refused.

Like the rest of the local server's data (skills, agents, config), memory is readable through the API when you run `termcoder-server` on your LAN — keep the server on a network you trust.

## Web app (use it from a browser)

Prefer a browser to the desktop app? Run the server and open it — the full UI, served
locally, talking to the same origin (so it works over your LAN too, not just localhost).

```bash
pnpm --filter @termcoder/desktop build:web   # once — builds the web bundle
pnpm --filter @termcoder/server dev          # or: termcoder-server
# → 🌐 Web app: open http://localhost:4096 in your browser
```

The agent still runs on your machine (your keys stay local); the browser is just the UI.
Point `TERMCODER_WEB_DIR` at the built `dist-web` to serve it from anywhere. Native-only
touches (OS file picker, git buttons) quietly no-op in the browser; chat, tools, models,
study, and autonomous mode all work.

## Permissions

Each mutating class — `bash`, `write`, `edit`, `mcp` — is `"ask"` (default), `"allow"`, or
`"deny"`. A class can instead be a **glob map** for path-aware control. The map is scanned
in order and the **last matching pattern wins**, so list the broad default first:

```jsonc
{
  "permission": {
    "edit": { "**": "ask", "src/**": "allow", "**/*.env": "deny" },
    "bash": { "**": "ask", "rm *": "deny" }
  }
}
```

Globs match the file path (write/edit) or the command string (bash). Supported: `**`
(any depth), `*` (within a path segment), `?` (one char).

Agents can carry their own permission map that overrides the global config for the kinds
it names — see below.

## Agents

Named model/prompt/permission/tool profiles. Built-ins: `build`, `plan`, `general`,
`explore`, `scout`. Define your own via config `agent.<name>` or a markdown file in
`.termcoder/agents/<name>.md` (project) or `~/.config/termcoder/agents/<name>.md` (global):

```markdown
---
description: Edits docs only
mode: primary
model: anthropic/claude-sonnet-4-6
permission:
  edit: { "docs/**": allow, "**": deny }
  write: { "docs/**": allow, "**": deny }
tools: [read, ls, glob, grep, write, edit]
---
You maintain documentation. Keep prose tight and match the existing voice.
```

Frontmatter keys: `description`, `mode` (`primary`/`subagent`/`all`), `model`, `prompt`
(or the markdown body), `temperature`, `steps`, `permission`, `tools`, `color`. The body
becomes the agent's system prompt. In the desktop app the **Agents** settings tab has a
visual builder (including a "limit edits to paths" glob field).

## Commands

Custom slash-commands live in `.termcoder/commands/<name>.md` (or global). The body is a
template expanded before the prompt is sent:

```markdown
---
description: Summarize the current diff
agent: plan
---
Summarize these changes for a commit message:

!`git diff --staged`
```

- `$ARGUMENTS` / `$1`, `$2`, … — interpolate the command's arguments.
- `` !`shell` `` — run a shell command in the workspace and inject its output.
- `@path` — inject a file's contents.

Type `/` in the desktop composer to browse commands with a live preview of the expanded
prompt.

## Skills

Skills are reusable playbooks the agent pulls in **on demand**. Drop a markdown file
in `.termcoder/skills/<name>.md` (project) or `~/.config/termcoder/skills/<name>.md`
(global):

```markdown
---
name: pr-review
description: Review a pull request for correctness and style
---
1. Read the diff with `git diff main...HEAD`.
2. For each changed file, check error handling, edge cases, and naming.
3. Summarize findings grouped by severity; suggest concrete fixes.
```

Only the **name + description** of each skill are placed in the system prompt (cheap).
When a task matches, the agent calls the built-in `skill` tool to load the full body —
so a library of skills costs almost nothing until one is actually used (the same
progressive-disclosure idea behind the token-economy settings below). Manage them in the
desktop **Skills** settings tab, or list them with `/skills` in the TUI.

Ready-made skills to copy live in
[docs/examples/skills/](./examples/skills/) (commit-message, pr-review, add-tests).

## Token economy

Long sessions get expensive because every turn resends the history, including past tool
outputs. Two knobs (under `context`) bound that:

```jsonc
{ "context": { "maxToolOutputChars": 8000, "keepRecentToolResults": 6 } }
```

- `maxToolOutputChars` — caps how much of each tool result is sent to the model (the UI
  still shows the full output).
- `keepRecentToolResults` — keeps this many recent tool outputs in full; older ones are
  elided from the model's context so they stop being re-billed every turn.

Tune both in the desktop **Behavior** settings tab.

## Formatters

Auto-format files after a successful write/edit. `"formatter": true` enables the
built-ins (prettier, gofmt, rustfmt, ruff, shfmt, clang-format — each skipped if its
binary isn't installed). Configure per name, or add a custom one:

```jsonc
{
  "formatter": {
    "prettier": { "extensions": [".ts", ".tsx", ".css"] },
    "black": { "command": ["black", "$FILE"], "extensions": [".py"] }
  }
}
```

`$FILE` is replaced with the edited file's path. Set `"disabled": true` on a built-in to
turn it off.

## Keybinds

Override the desktop app's shortcuts. Keys are action ids; values are combos where `mod`
is Ctrl (⌘ on macOS):

```jsonc
{ "keybinds": { "commandPalette": "mod+p", "newSession": "mod+shift+n" } }
```

Actions: `commandPalette`, `newSession`, `toggleSessions`, `toggleFiles`, `openFolder`.
The **Shortcuts** settings tab records these interactively.

## MCP, LSP, plugins

- `mcp` — external [MCP](https://modelcontextprotocol.io) servers (`stdio` or `http`);
  their tools are namespaced `<server>_<tool>`.
- `lsp` — language servers keyed by the extensions they handle; enables a `diagnostics`
  tool.
- `plugins` — module specifiers (package names or file paths) that add tools.

Each is documented with examples in the root [README](../README.md). Tools dropped in
`.termcoder/tools/*.{js,mjs,cjs}` are auto-discovered too.

## GitHub

```jsonc
{ "github": { "token": "ghp_…" } }
```

Used to publish a session transcript as a secret Gist (`POST /sessions/:id/gist`). A
classic token with the `gist` scope is enough; it's stored locally and the server only
ever exposes whether a token exists, never its value. Falls back to `GITHUB_TOKEN`.

### GitHub as a backend — sync, share, and packs

With a token connected, termcoder uses GitHub (no server of ours) for three things:

- **Sync** — your favorites and unsent drafts mirror to one **private** gist, so they
  follow you across machines. Conflict policy is last-write-wins by timestamp; secrets
  (API keys in `config.json`) never sync.
  - CLI: `/sync` · Server: `POST /sync/push`, `POST /sync/pull`
- **Share & import sessions** — publish a session as a gist (Markdown + HTML + a raw
  `session.json`) and re-open it anywhere.
  - CLI: `/publish` then `/import <gist>` · Server: `POST /sessions/:id/gist`, `POST /sessions/import`
- **Packs** — bundle a project's `.termcoder/{agents,skills,commands}` into a gist so a
  classmate can install your whole setup in one step. Install from a gist or a public
  `owner/repo`.
  - CLI: `/pack publish`, `/pack install <ref> [--global]`, `/pack list` · Server: `POST /packs`

Connect a token with `/login <token>` (create one at
<https://github.com/settings/tokens/new> with the `gist` scope), check it with the
authenticated handle, and disconnect with `/logout`. In the desktop app, use
Settings → Integrations → GitHub (**Test connection** and **Packs**).

### Classrooms

A class is a shared space for a teacher and their students — GitHub-native and async, no
server. A class is one secret gist holding shared packs and assignments; students join,
submit, and appear on the roster through gist comments.

- `/class create <name>` — make a class; share the printed code.
- `/class join <code>` — join (installs the class's shared packs) and sign the roster.
- `/class assignments` — list assignments and their ids.
- `/class assign <title>` — post an assignment (creator only).
- `/class submit <assignment-id>` — publish your current session and submit its viewer link.
- `/class submissions` / `/class roster` — the creator reviews who submitted / joined.

Everything rides your GitHub token; nothing is public (secret gists open only with the link).
