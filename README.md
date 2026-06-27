# termcoder

An open-source AI coding agent for your terminal, with a focus on a clean, polished UX.
Inspired by [OpenCode](https://opencode.ai), built in TypeScript.

> Status: early MVP (sub-project 1 — headless core + Ink TUI).

## Architecture

A monorepo with a clean split between the engine and the interface:

- **`@termcoder/core`** — headless agent engine: agent loop, LLM providers (via the
  [Vercel AI SDK](https://sdk.vercel.ai)), tools, permissions, sessions, and config.
  Emits typed events; knows nothing about the terminal.
- **`@termcoder/tui`** — an [Ink](https://github.com/vadimdemedes/ink) (React) terminal
  client that consumes the core's event stream. Ships the `termcoder` binary.
- **`@termcoder/server`** — a headless HTTP + WebSocket server wrapping the same core.
  HTTP manages session resources; the WebSocket streams a turn's events and carries the
  permission round-trip. Ships the `termcoder-server` binary. This is the foundation for
  web/IDE clients.

This boundary lets the server (and future web/IDE clients) wrap the same core without a
rewrite.

### Server API

- `POST /sessions` — create a session (`{ "cwd": "..." }`) → session record
- `GET /sessions` — list sessions
- `GET /sessions/:id` — fetch one session
- `GET /sessions/:id/share` — a shareable transcript (HTML; `?format=md` for Markdown)
- `WS /sessions/:id/stream` — send `{ "type": "prompt", "text": "..." }`; receive the
  core's event stream. On `{ "type": "permission-request", "id", "request" }`, reply with
  `{ "type": "permission-decision", "id", "decision": "allow" | "deny" | "allow-always" }`.

In the TUI, `/share` writes the current session to a self-contained HTML file you can open
in a browser or send to someone.

## Free / no-cost setup

You don't need a paid API key. Pick a model with `model` in config (or `TERMCODER_MODEL`):

**Ollama (local, fully free, no key, no account):**

1. Install [Ollama](https://ollama.com) and pull a tool-capable model: `ollama pull llama3.1`
2. Configure termcoder:

   ```json
   { "model": "ollama/llama3.1" }
   ```

   That's it — it talks to Ollama on `http://localhost:11434`. Good models for tool use:
   `llama3.1`, `qwen2.5`, `mistral-nemo`.

**Google Gemini (free tier, cloud):** get a free key at
[aistudio.google.com](https://aistudio.google.com/apikey), then:

```bash
export GEMINI_API_KEY="..."
```
```json
{ "model": "google/gemini-2.0-flash" }
```

**Any OpenAI-compatible free endpoint (Groq, OpenRouter, …):** point the `openai` provider
at it:

```json
{
  "model": "openai/llama-3.3-70b-versatile",
  "providers": { "openai": { "baseURL": "https://api.groq.com/openai/v1", "apiKey": "gsk_..." } }
}
```

> Tool-calling quality varies by model — bigger/instruct models follow the tool protocol
> better. If a small local model struggles with tools, try `qwen2.5` or a larger variant.

## MCP servers

termcoder can connect to external [MCP](https://modelcontextprotocol.io) servers and
expose their tools to the agent alongside the built-ins. Configure them in
`.termcoder/config.json` (project) or `~/.config/termcoder/config.json` (global):

```json
{
  "mcp": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "remote": { "type": "http", "url": "https://example.com/mcp" }
  }
}
```

Tools are namespaced as `<server>_<tool>`. Servers connect at startup (the TUI and the
server both report connection status); a server that fails doesn't block the others.
Tools the server marks read-only run automatically; the rest are gated under the `mcp`
permission. A server that fails to connect is reported but never blocks startup.

## Language servers (LSP)

Configure language servers and termcoder exposes a `diagnostics` tool that runs the
right server for a file's extension and returns its errors/warnings to the agent:

```json
{
  "lsp": {
    "typescript": {
      "command": "typescript-language-server",
      "args": ["--stdio"],
      "extensions": [".ts", ".tsx", ".js", ".jsx"]
    }
  }
}
```

The agent can call `diagnostics` after editing a file to check its work. Servers launch
at startup; one that fails to start is reported but never blocks the others.

## Plugins

Extend termcoder with your own tools. A plugin is a module that default-exports a
`{ name, register }` object; `register` receives an API for adding tools:

```js
// my-plugin.mjs
import { definePlugin, defineTool } from "@termcoder/core";
import { z } from "zod";

export default definePlugin({
  name: "my-plugin",
  register(api) {
    api.addTool(
      defineTool({
        name: "now",
        description: "Return the current time",
        inputSchema: z.object({}),
        readOnly: true,
        run: async () => ({ output: new Date().toISOString() }),
      }),
    );
  },
});
```

Reference it in config (`plugins` accepts package names or file paths):

```json
{ "plugins": ["./my-plugin.mjs", "@me/termcoder-plugin"] }
```

A plugin that fails to load is reported but never blocks startup.

## Sub-agents

The agent has a `task` tool that delegates a focused, self-contained instruction to a
sub-agent — a nested session that works autonomously with the same tools and returns a
summary. The sub-agent reuses the same permission gate (so mutating actions still prompt)
and cannot itself delegate, bounding delegation to a single level. This keeps the main
conversation focused while parallelizable or independent work happens in a sub-agent.

## Development

```bash
pnpm install
pnpm build
pnpm test

# run the TUI (needs an API key, e.g. ANTHROPIC_API_KEY)
pnpm dev

# or run the headless server (defaults to PORT=4096)
pnpm --filter @termcoder/server dev
```

## License

MIT
