# Server API

`@termcoder/server` exposes the engine over HTTP (session resources and settings) and
one WebSocket per session (the live turn stream + permission round-trip). All responses
are JSON unless noted, and CORS is open (`Access-Control-Allow-Origin: *`) so a local
web/desktop client can talk to it.

## Running it

```bash
# from the repo
pnpm --filter @termcoder/server dev      # listens on PORT (default 4096)

# or embed it (see the SDK guide)
```

```ts
import { createServer } from "@termcoder/server";
const server = createServer({ cwd: process.cwd() });
server.listen(4096);
```

`createServer(deps?)` accepts `{ config?, store?, registry?, runner?, cwd?, status? }` —
all optional; omitted pieces fall back to loaded config, the default session store, and
the built-in tools.

## HTTP endpoints

### Sessions

| Method & path | Purpose |
| --- | --- |
| `POST /sessions` | Create a session. Body: `{ cwd, title?, agent?, mode?, temperature?, maxSteps? }`. Returns the session record. |
| `GET /sessions` | List saved session records. |
| `GET /sessions/:id` | Fetch one session record. |
| `DELETE /sessions` | Delete all saved sessions. Returns `{ removed }`. |
| `DELETE /sessions/:id` | Delete one session. |
| `GET /sessions/:id/transcript` | Flattened, render-ready transcript segments. |
| `POST /sessions/:id/model` | Change the session's model. Body: `{ model }`. |
| `POST /sessions/:id/settings` | Update per-session settings (temperature, maxSteps, agent). |
| `POST /sessions/:id/title` | Rename. Body: `{ title }`. |
| `GET /sessions/:id/checkpoint` | Whether the last turn left a revertable checkpoint (`{ hasCheckpoint }`). |
| `POST /sessions/:id/revert` | Revert the files changed in the last turn (`{ restored }`). |
| `GET /sessions/:id/share` | Shareable transcript — HTML by default, `?format=md` for Markdown. |
| `POST /sessions/:id/gist` | Publish the transcript as a secret GitHub Gist (needs a token — see config). Returns `{ url }`. |

### Engine & catalog

| Method & path | Purpose |
| --- | --- |
| `GET /status` | Active model, provider key status, and MCP/LSP/plugin connection state. |
| `GET /agents` | Available agents (built-in + custom), each with `{ name, description, readOnly, builtin }`. |
| `POST /agents` | Create a custom agent `.md`. Body: `{ name, description?, model?, prompt?, mode?, readOnly?, editPaths? }`. |
| `DELETE /agents/:name` | Delete a custom agent. |
| `GET /commands` | Custom slash-commands discovered from `.termcoder/commands`. |
| `POST /commands/expand` | Expand a command template (`$ARGUMENTS`, shell, `@file`) for preview. Body: `{ name, args }`. |
| `GET /models` | Model catalog (Models.dev + local Ollama + fallback), each flagged `configured`. |
| `POST /complete` | Inline code completion (the desktop "Copilot" ghost text). Body: `{ prefix, suffix, language }`. |
| `POST /transcribe` | Speech-to-text for voice dictation. Body: `{ audio, mediaType }` (base64). |

### Config & integrations

| Method & path | Purpose |
| --- | --- |
| `GET /config` | The current config with secrets redacted (API keys → `hasKey`, GitHub token → `hasToken`). |
| `POST /config` | Merge a partial config into the global file and hot-reload. Returns `{ ok, needsRestart }`. |
| `POST /mcp` | Add/update an MCP server. |
| `DELETE /mcp/:name` | Remove an MCP server. |
| `POST /mcp/:name/toggle` | Enable/disable an MCP server. |

> Adding/removing MCP servers rewrites config immediately but only **connects** on the
> next server start (`needsRestart: true`).

## WebSocket: `WS /sessions/:id/stream`

Open one socket per session. Messages are JSON objects with a `type`.

**Client → server**

```jsonc
{ "type": "prompt", "text": "add a test for parseFrontmatter",
  "images": [{ "dataUrl": "data:image/png;base64,…", "mediaType": "image/png" }] }  // images optional
{ "type": "stop" }                                            // abort the running turn
{ "type": "permission-decision", "id": "…", "decision": "allow" }  // answer a prompt
```

`decision` is `"allow" | "deny" | "allow-always"`.

**Server → client** — the turn's event stream, one JSON object per message:

| Event | Shape |
| --- | --- |
| `text-delta` | `{ type, text }` — a chunk of assistant text. |
| `tool-call` | `{ type, id, name, args, title?, detail? }` — the agent wants to run a tool. |
| `tool-result` | `{ type, id, name, output, isError }` — the tool's result. |
| `usage` | `{ type, inputTokens, outputTokens }` — token counts for the turn. |
| `permission-request` | `{ type, id, request }` — approve before a mutating tool runs; answer with `permission-decision`. |
| `done` | `{ type }` — the turn finished normally. |
| `stopped` | `{ type }` — the turn was aborted via `stop`. |
| `error` | `{ type, error }` — a fatal error for the turn. |

### Minimal client

```ts
const ws = new WebSocket(`ws://localhost:4096/sessions/${id}/stream`);
ws.onopen = () => ws.send(JSON.stringify({ type: "prompt", text: "hello" }));
ws.onmessage = (e) => {
  const ev = JSON.parse(e.data);
  if (ev.type === "text-delta") process.stdout.write(ev.text);
  if (ev.type === "permission-request") {
    ws.send(JSON.stringify({ type: "permission-decision", id: ev.id, decision: "allow" }));
  }
};
```
