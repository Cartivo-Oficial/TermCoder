# Terminal grid — tile the terminals, keep tabs

**Date:** 2026-07-17
**Status:** draft, awaiting review

## Problem

The desktop terminal deck shows one terminal at a time: `TerminalDeck` renders every `TerminalPane` stacked (`position: absolute; inset: 0`) but hides all but `activeId` (`.term-pane.hidden { display: none }`), with a tab bar to switch. The user wants the terminals tiled side by side — all visible in a grid, one highlighted as focused — which is far better for a production workflow (watching several agent sessions at once).

## What we build

A **layout toggle** on `TerminalDeck`: `"tabs"` (today's behaviour) ↔ `"grid"` (all panes tiled). Decided with the user: a toggle (not grid-only), an automatic equal grid (not draggable splits).

- A toggle button in the tab bar switches modes. The choice persists in `localStorage` so it sticks across launches. Default: `"tabs"` (least surprise for existing users; one click to grid).
- **Grid mode:** `.term-deck-body` becomes a CSS grid; every pane renders VISIBLE (all shells live and on screen). Columns are computed from the pane count: `cols = max(1, ceil(sqrt(n)))` — 1→1, 2→2, 3–4→2, 5–9→3, so six panes tile 3×2 (matching the reference). Clicking a pane focuses it (`setActiveId`); the focused pane gets an accent border. The keyboard goes to the focused pane (xterm takes focus on click).
- **Tabs mode:** unchanged — only `activeId` visible, tabs to switch.

## Why this is feasible without touching the pty/xterm plumbing

`TerminalPane` already resizes itself correctly, verified in code:
- It fits on becoming visible: its start effect early-returns while `hidden` and re-runs when `hidden` flips (its dep array includes `hidden`), calling `fit.fit()` (`TerminalPane.tsx:97,103,119`).
- It fits on container resize: a `ResizeObserver` calls `fit.fit()` + `window.api.pty.resize(...)` whenever the pane's box changes, skipping only while `hidden` (`TerminalPane.tsx:124–134`).

So in grid mode, when a pane's `hidden` becomes `false` and it sits in a grid cell, the start effect fits it; and adding/removing a pane, resizing the window, or toggling modes changes each cell's box, so each pane's ResizeObserver refits and tells its pty the new cols/rows. The grid needs no new fit/resize wiring — only the layout and the visibility of all panes. This is the load-bearing assumption; the plan verifies it by running.

## The CSS mode switch (the one structural detail)

Today `.term-pane` is `position: absolute; inset: 0` (panes overlap, one shown). A grid cannot use absolutely-positioned children. So grid mode adds a modifier:

- `.term-deck-body.grid { display: grid; gap: 6px; }` with `grid-template-columns` set inline from React (`repeat(<cols>, minmax(0, 1fr))`) since the count is dynamic.
- `.term-deck-body.grid .term-pane { position: relative; inset: auto; }` — panes become grid items instead of stacked absolutes.
- `.term-pane.focused { outline: 1px solid var(--accent); }` (or a border) — the highlight on the focused pane.

Tabs mode keeps the current absolute stacking untouched.

## Components and interfaces

| Unit | Responsibility |
|---|---|
| `packages/desktop/src/renderer/terminal/grid.ts` (new) | `gridColumns(n: number): number` — the pure tiling rule; unit-tested |
| `packages/desktop/src/renderer/TerminalDeck.tsx` | `layout` state (persisted), the toggle button, render all panes visible in grid mode with computed columns + focus border + click-to-focus |
| `packages/desktop/src/renderer/TerminalPane.tsx` | unchanged (it already fits itself); it must render VISIBLE in grid mode — the deck passes `hidden={false}` for all panes in grid mode |
| `packages/desktop/src/renderer/styles.css` | `.term-deck-body.grid`, `.term-deck-body.grid .term-pane`, `.term-pane.focused` |

In grid mode the deck passes `hidden={hidden}` (the deck's own hidden prop — i.e. whether the whole terminal view is hidden behind the Chat tab) to EVERY pane, not `hidden || id !== activeId`. So all panes are visible when the terminal view is shown, and all correctly hidden when the user switches to Chat.

## What could go wrong

- **A pane that never became visible has no live pty.** In tabs mode only the active pane's start effect has run (the others are `hidden`, early-return). Switching to grid flips them all visible, so their start effects run and spawn their shells then. Expected — a terminal you never looked at starts its shell when it first appears in the grid. Confirm the start effect is idempotent (doesn't double-spawn a pane that was already started while active) — the plan checks this.
- **Fit timing on toggle.** When several panes flip visible at once, each fits to its cell. If a pane fits before the grid has laid out (0-size cell), it could compute wrong cols/rows; the ResizeObserver corrects it on the next layout tick. Acceptable; verify by running that no terminal renders garbled after toggling.
- **Very many terminals.** `ceil(sqrt(n))` keeps it square-ish; 10 panes → 4 cols. Tiny panes are the user's choice (that's what the toggle back to tabs is for). No artificial cap.
- **The focused pane in grid mode.** `activeId` still drives which pane is "focused" (accent border + where the tab bar's context applies). Clicking any pane sets it.

## Testing

- **Pure unit:** `gridColumns(n)` — 1→1, 2→2, 3→2, 4→2, 5→3, 6→3, 9→3, 10→4, 0→1. Vitest, no DOM.
- **Run the app (user's eyeball gate):** toggle to grid with 1/2/4/6 terminals; confirm all render, none garbled, each shell live, click-to-focus highlights the right pane, window resize reflows, toggling back to tabs restores single-pane; the choice persists across relaunch.

## Out of scope

- Draggable splits / per-pane resize + persistence.
- Broadcast input to all terminals at once.
- Reordering panes by drag.
- Any change to the pty/xterm fit machinery (reused as-is).
