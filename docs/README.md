# termcoder documentation

termcoder is an open-source AI coding agent built as a small monorepo with a
clean split between a headless engine and its clients.

| Package | What it is |
| --- | --- |
| [`@termcoder/core`](../packages/core) | The headless engine: agent loop, providers, tools, permissions, sessions, config. Knows nothing about a UI. |
| [`@termcoder/server`](../packages/server) | An HTTP + WebSocket server wrapping the core. Foundation for the desktop/web/IDE clients. |
| [`@termcoder/tui`](../packages/tui) | An Ink (React) terminal client. Ships the `termcoder` binary. |
| [`@termcoder/desktop`](../packages/desktop) | An Electron + React desktop app embedding the server. |

## Guides

- **[SDK](./sdk.md)** — drive the engine programmatically: create a session, stream a
  turn, add tools, gate permissions.
- **[Server API](./server-api.md)** — the full HTTP + WebSocket reference used by the
  desktop app and any other client.
- **[Configuration](./configuration.md)** — every config key: models/providers, agents,
  commands, formatters, permissions (incl. globs), keybinds, MCP, LSP, plugins.
- **[GitHub Action](./github-action.md)** — run termcoder in CI to answer issues and
  review pull requests.
- **[Troubleshooting](./troubleshooting.md)** — credentials, permissions, the Windows
  icon cache, MCP restarts, and more.
- **[termexplorer](./termexplorer.md)** — the sister AI for studying: summaries, homework
  help, flashcards, and study plans, usable by non-programmers.

## The core idea

Every client — TUI, desktop, server — is a thin shell over the same `Session` in
`@termcoder/core`. A turn is an async stream of typed events; mutating tools (write,
edit, bash) pass through a `PermissionManager` that a client answers however it likes
(a modal, a config rule, auto-approve). That boundary is why adding a new front-end
never means rewriting the agent.
