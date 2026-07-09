# Desktop Cockpit Relayout — Design

**Status:** approved (brainstorming) — ready for an implementation plan.
**Date:** 2026-07-06
**Bundle:** "O Motor" mega update. Turns the desktop from a chat app into a data-dense command center, on the Ember "Terminal Soul" foundation.

## Goal

A cockpit inspired by the Hydra-ensemble reference (adapted to termcoder's chat-first, single-session model): a **center tab bar (Chat / Editor / Terminal)**, live session cards (status + model + real usage), a collapsible dashboard (aggregate tokens, a sparkline, model-mix, a run-toolkit), a rich header (editing file + git branch + model + status), and a rich status bar — plus real brand-colored file icons. Every existing flow survives; metrics are **tokens only** (no dollar cost — nothing fake).

**Scope note (native deps):** the full interactive **Terminal** tab requires `xterm.js` + `xterm-addon-fit` + `node-pty` (a NATIVE module) — this deliberately overrides the project's usual "no new runtime dependencies" rule for that one piece, and adds packaging work (see §8). Everything else stays dependency-free. Because the feature is large, the implementation plan phases it: **Phase A** shell relayout + data + cards + dashboard + status bar + icons; **Phase B** Editor tab + rich header; **Phase C** Terminal + run-toolkit. Each phase is independently shippable.

## Decisions (locked in brainstorming)

- **Tokens only, no cost.** No pricing table, no `$`. Persist per-session token totals; show tokens in/out + context.
- **Dashboard = a collapsible right column**, not an overlay (the point is live density alongside the chat).
- **Persist per-session usage** on `SessionRecord` to feed cards + dashboard.
- **File icons already use `react-icons/si` brand logos** — the fix is dropping the gray `mute()` blend for real brand colors + completing coverage. No new dependency.
- Comment-free code; i18n en/pt/es for new labels; no new runtime dependencies; the Ember tokens/`--mono` chrome are the visual base.

## 1. Data plumbing (the honest core)

- **`SessionRecord.usage?: { tokensIn: number; tokensOut: number }`** (`storage.ts`) — optional, retro-compatible (old records have none → treated as 0). Accumulated across turns: the session already yields `{ type: "usage", inputTokens, outputTokens }` per turn (`session.ts:560`); on save, add the turn's totals into `record.usage`. `SessionStore.save` already stamps `updatedAt`; extend it (or the session) to fold usage in.
- **`SessionSummary.usage?: { tokensIn, tokensOut }`** (`storage.ts`) — so `list()` cards + the dashboard aggregate without loading full records (mirrors how `messageCount` is already surfaced).
- **Status** per session is live-only (idle/generating/error) and comes from the running App state (the active session's `busy`/error), not persisted — a persisted session card shows `idle` unless it's the active one.
- The server already serves session summaries; the extra `usage` field flows through unchanged. No new endpoint.

## 2. Left rail — session cards

Replace the plain `.session-row` list with cards (`.session-card`). Each card:
- **Status dot:** `○` idle (muted), `●` generating (ember, pulsing), `✕` error (red) — the active session reflects live `busy`/error; others are idle.
- **Title** (mono, truncated) + a delete affordance on hover (existing behavior).
- **Model chip** (mono, from `record.model`) + **usage** `↓<tokensIn> ↑<tokensOut>` (compact, e.g. `↓8k ↑4k`).
- Active card: ember left-bar + elevated background (existing `.active` treatment, restyled as a card).
- Empty sessions still hidden (existing `messageCount > 0` filter).

## 3. Right — the Dashboard (collapsible)

A new right column in `.body` (`.dashboard`), collapsible via a toolbar toggle (persist collapsed state in `localStorage`). Sections (mono `// ` eyebrows):
- **`// OVERVIEW`:** total sessions, total tokens ↓ and ↑ (summed across summaries), and this-session live tokens.
- **Sparkline:** tokens per recent session (last ~12), a tiny inline SVG/CSS bar strip (`.spark`) — no dependency, derived from summaries.
- **`// MODELS`:** the model-mix — a chip per distinct model used, with a count (from summaries' `model`).
- **`// TOOLKIT`:** quick-action buttons — New session, Run check (`/background`-style), Share, Settings — wired to the existing handlers.

The dashboard reads only from the already-fetched session summaries + live App state; it recomputes on session change/turn end. Purely presentational aggregation, no new data source.

## 4. Rich status bar

A persistent bottom strip (`.statusbar`, mono), parity with the TUI's StatusBar: `cwd · model · agent · ctx <N>k (<pct>%) · ↓<in> ↑<out> · <status dot>`. Uses the App's existing `tokensIn/tokensOut/lastCtx/model/agent/busy` state (already tracked). Amber ctx when >40% of the model's window, red >70% (contextK from the catalog, same thresholds as the TUI).

## 5. Language & tool file icons (the "horrible icons" fix)

`FileIcons.tsx` already maps extensions/filenames to `react-icons/si` brand logos. The fix:
- **Drop the gray `mute()` blend** — render each icon in its real brand color (define a small `BRAND` color map keyed by icon, e.g. TypeScript `#3178C6`, JavaScript/`#F7DF1E`, React `#61DAFB`, Python `#3776AB`, Rust `#DEA584`, Go `#00ADD8`, etc.). Folders/generic keep a neutral tone.
- **Complete coverage:** add missing common types (`.tsx`→React, `.jsx`, `.mjs/.cjs`, `.json`, `.lock`, `.env`, `Dockerfile`, `.sql`, `.java`, `.kt`, `.swift`, `.rb`, `.php`, `.vue`, `.svelte`, `.graphql`, `.wasm`, `.toml`, `.ini`) — reuse existing `Si*`/`Fa*` imports where available, add a few more from `react-icons` (already a dep).
- **Size/alignment:** bump to a consistent 15px, vertically centered; unknown types get a clean neutral document glyph (not a jarring fallback).
- Light-theme safe: very-dark brand colors get a minimum-contrast floor on the light `paper` theme.

## 5.5 Center tab bar — Chat / Editor / Terminal (Phase B & C)

The center column gets a slim mono tab bar (`.center-tabs`): **Chat** (default, the existing conversation), **Editor**, **Terminal**. Switching tabs swaps the center body; the left rail, dashboard, and status bar persist. The tab bar shows the same eyebrow/mono chrome as the rest.

## 5.6 Editor tab + rich header (Phase B)

- **Editor tab:** reuses the existing `CodeEditor.tsx` (CodeMirror + `editorThemes.ts`) and the diff renderer. It shows the **file the agent last touched** (tracked from the write/edit tool events in the session stream — the desktop already renders tool calls; capture the last edited path), with a MODIFIED badge, a `+N / -N` line count, and a toggle between the **diff** and the **full file** (syntax-highlighted). A file can also be opened from the file tree into this tab. Read-only by default; the existing editable-editor affordance stays.
- **Rich header** (center header strip): the current model chip, the **editing file** name (when the agent is mid-edit), the **git branch** (read once per session via `git rev-parse --abbrev-ref HEAD`, cheap, cached), and the live status dot. No cost field.

## 5.7 Terminal tab + run-toolkit (Phase C — native deps)

- **Terminal tab:** a real interactive shell. Main process spawns a login shell via **`node-pty`**; the renderer renders it with **`xterm.js`** (+ `xterm-addon-fit` for resize). Data flows over IPC: `pty:spawn` (cwd + cols/rows) → `pty:data` (stream) / `pty:input` (keystrokes) / `pty:resize` / `pty:exit`. One PTY per window, spawned lazily on first open, disposed on window close. The shell is the user's default (`$SHELL` / `ComSpec`).
- **Run-toolkit** (moves into the dashboard's `// TOOLKIT`): buttons **test / build / lint / deploy** (detected from `package.json` scripts, falling back to the project's check via the existing `detectVerifyCommand`) + a "run a command" input. Clicking a button writes the command into the Terminal tab's PTY and switches to it — so output is the real shell, not a fake pane.
- **Fail-graceful:** if `node-pty` fails to load (native binary missing for the platform), the Terminal tab shows a clear "terminal unavailable on this build" message and the run-toolkit falls back to the existing spawn-based `runVerify` output; the rest of the app is unaffected.

## 6. What survives / out of scope

- **Survives:** chat + tools flow, study overlay, autonomous toggle, memory tab, settings, model picker, connect modals, command palette, keyboard shortcuts, i18n. The relayout reorganizes the shell and adds tabs/panels, not the conversation itself.
- **Out of scope:** cost/pricing (deliberately), a multi-session concurrent runner (Hydra-style parallel agents on worktrees — termcoder runs one active session), git-branch-per-session, time-series charts beyond the per-session sparkline.

## 7. Dependencies & packaging (the honest native-module cost)

- New deps (Phase C only): `xterm`, `@xterm/addon-fit` (renderer, pure JS) and **`node-pty`** (main process, **native**).
- **Packaging:** `node-pty` must be a real `dependency` of `@termcoder/desktop`, `asarUnpack`-ed in the electron-builder config, and rebuilt for each target — electron-builder runs `@electron/rebuild` for native modules, but the release matrix (win/mac/linux) must have a working build toolchain (the GitHub runners do). Verify a packaged build on at least one OS before shipping; the Phase-C plan includes that check. If native rebuild proves fragile in CI, Phase C can ship behind a flag while A/B ship first.
- Phases A and B add **no** dependencies.

## 8. Testing / verification

- No unit tests for renderer layout; verification is `cd packages/desktop && npx tsc --noEmit` + `pnpm --filter @termcoder/desktop build` + launching the app (strip `ELECTRON_RUN_AS_NODE`) and screenshotting each phase: rail cards, dashboard (overview + sparkline + model-mix + toolkit), status bar, brand icons, light `paper` theme; the Editor tab (diff + full file); the Terminal tab (a real shell running a command, and the run-toolkit sending into it).
- The core data change (`SessionRecord.usage` accumulation + `SessionSummary.usage`) DOES get a unit test in `storage`/`session` tests: a turn with a usage event persists cumulative tokens; a second turn adds to them; a fresh record has none. `detectVerifyCommand`/script detection for the toolkit is unit-tested.
- i18n: en/pt/es for the new tab/dashboard/status/toolkit labels; full suite stays green.
