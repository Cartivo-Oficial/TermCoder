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
- `WS /sessions/:id/stream` — send `{ "type": "prompt", "text": "..." }`; receive the
  core's event stream. On `{ "type": "permission-request", "id", "request" }`, reply with
  `{ "type": "permission-decision", "id", "decision": "allow" | "deny" | "allow-always" }`.

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
