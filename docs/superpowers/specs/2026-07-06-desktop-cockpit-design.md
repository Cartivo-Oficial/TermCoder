# Desktop Cockpit Relayout — Design

**Status:** approved (brainstorming) — ready for an implementation plan.
**Date:** 2026-07-06
**Bundle:** "O Motor" mega update. Turns the desktop from a chat app into a data-dense command center, on the Ember "Terminal Soul" foundation.

## Goal

A cockpit: live session cards (status + model + real usage), a collapsible dashboard (aggregate tokens, a sparkline, model-mix, a quick-action toolkit), and a rich status bar — plus real brand-colored language/tool file icons. Every existing flow survives; metrics are **tokens only** (no dollar cost — nothing fake).

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

## 6. What survives / out of scope

- **Survives:** chat + tools flow, study overlay, autonomous toggle, memory tab, settings, model picker, connect modals, command palette, keyboard shortcuts, i18n. The relayout reorganizes the shell (rail + dashboard + status bar), not the conversation.
- **Out of scope:** cost/pricing (deliberately), a multi-session concurrent runner (Hydra-style parallel agents — termcoder runs one active session), git-branch-per-session, time-series charts beyond the per-session sparkline.

## 7. Testing / verification

- No unit tests for renderer layout; verification is `cd packages/desktop && npx tsc --noEmit` + `pnpm --filter @termcoder/desktop build` + launching the app (strip `ELECTRON_RUN_AS_NODE`) and screenshotting: the rail cards (status/model/usage), the dashboard (overview + sparkline + model-mix + toolkit), the status bar, brand-colored file icons, and the light `paper` theme.
- The core data change (`SessionRecord.usage` accumulation + `SessionSummary.usage`) DOES get a unit test in `storage`/`session` tests: a turn with a usage event persists cumulative tokens; a second turn adds to them; a fresh record has none.
- i18n: en/pt/es for the new dashboard/status labels; full suite stays green.
