# Contributing to TermCoder

Thanks for helping build TermCoder. This guide covers the setup, the layout, and
what a good change looks like.

## Setup

TermCoder is a pnpm monorepo. You need Node 20+ and pnpm.

```bash
pnpm install
pnpm build       # builds every package (core is required before typecheck)
pnpm typecheck   # tsc --noEmit across all packages
pnpm test        # vitest, the whole suite
```

Run a package on its own:

```bash
pnpm --filter @termcoder/tui dev        # the CLI
pnpm --filter @termcoder/desktop dev    # the desktop app (Electron)
```

## Layout

- `packages/core` — the headless engine (`@termcoder/core`): agent loop, tools,
  providers, sessions, sync, classrooms, licensing. Everything else builds on it.
- `packages/server` — the HTTP/WebSocket server (`@termcoder/server`) the desktop
  and browser clients talk to.
- `packages/tui` — the Ink terminal UI (`@termcoder/tui`, the `termcoder`/`term`
  bin).
- `packages/desktop` — the Electron + React desktop app.
- `website/` — the static marketing site (no build step; see `website/tools/verify.mjs`).
- `eval/` — the agentic benchmark harness (see `eval/README.md`).
- `docs/` — user and API documentation.

## Making a change

- Match the surrounding code — its naming, its structure, its comment density.
  The codebase is deliberately light on comments; let clear names carry the
  meaning.
- Add or update tests for behaviour you change. `core` and `server` use vitest;
  the TUI uses `ink-testing-library` (`packages/tui/src/components/*.test.tsx`).
- Keep `pnpm build`, `pnpm typecheck`, and `pnpm test` green before opening a PR.
- Editing the website? Run `node website/tools/verify.mjs` — it enforces the site
  guardrails (no inline styles, no emoji, honest copy).
- One focused change per PR. If you find unrelated cleanup, mention it rather than
  bundling it in.

## Open core

The engine and clients are open source under MIT. Some collaboration features
(hosting live rooms and classrooms, cross-device session sync) are part of
**termcoder Pro** and are gated behind a license — see `docs/` and the pricing
page. Contributions to the free core are always welcome; if you want to work on a
Pro-gated surface, open an issue first so we can align.

## Commits and PRs

- Write present-tense, scoped commit subjects (`feat(desktop): …`, `fix(core): …`).
- Describe what changed and why in the PR body, and how you verified it.
- Link the issue it closes.
