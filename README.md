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

This boundary lets a future HTTP/WS server (and web/IDE clients) wrap the same core
without a rewrite.

## Development

```bash
pnpm install
pnpm build
pnpm test

# run the TUI (needs an API key, e.g. ANTHROPIC_API_KEY)
pnpm dev
```

## License

MIT
