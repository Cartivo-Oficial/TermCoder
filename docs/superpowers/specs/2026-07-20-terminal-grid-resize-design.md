# Draggable terminal grid — design

base: 8cd5a36 (v0.11.1)
status: design (awaiting user review)

## Problem

The terminal grid (`TerminalDeck`, added in v0.10.x) tiles panes into `gridColumns(n)` equal columns with auto rows: `gridTemplateColumns: repeat(gridColumns(n), minmax(0,1fr))`. There is no manual control. With several terminals open the equal tiling is cramped and the user cannot give the pane they are working in more room. User feedback: "está muito poluído quando abro vários porque não consigo ajustar o espaço manualmente — ele já vem ajustado."

Decision: draggable grid dividers on both axes (approach B). Not a tmux-style split tree (approach C) — that is a separate, larger project.

## Approach

Keep the existing model — terminals flow into an N×M grid — but make the grid lines draggable. Column widths and row heights are shared across the grid (spreadsheet model), not per-cell independent. Dragging a vertical divider redistributes width between two adjacent columns; a horizontal divider redistributes height between two adjacent rows. Double-clicking a divider resets its two tracks to equal. Sizes persist. Tabs mode is untouched.

The FitAddon path already refits xterm on any cell resize via `ResizeObserver` (`TerminalPane`), so dragging a divider only changes CSS grid track sizes and the terminals refit themselves — no xterm work in this change.

## Components

### `packages/desktop/src/renderer/terminal/grid.ts` (extend)

Already exports `gridColumns(n)`. Add pure, unit-testable track math:

- `equalTracks(count: number): number[]` — `count` equal fractions, each `1/count` (sums to 1). `count <= 0` → `[]`; `count === 1` → `[1]`.
- `resizeTracks(tracks: number[], boundary: number, deltaFraction: number, minFraction: number): number[]` — move `deltaFraction` across the divider between track `boundary` and `boundary+1`, clamped so neither adjacent track drops below `minFraction`. Every other track is unchanged; the result still sums to the same total. A delta that would violate the clamp is reduced to the largest legal move (never throws, never reorders).
- `gridRowCount(count: number): number` — `Math.ceil(count / gridColumns(count))`, the number of rows the flow grid occupies.

These are the parts where drag math hides bugs, so they carry the tests.

### `packages/desktop/src/renderer/terminal/useGridLayout.ts` (new)

A hook owning the persisted fractions for the current terminal count:

- State: `{ cols: number[]; rows: number[] }`, lengths `gridColumns(count)` and `gridRowCount(count)`.
- Persistence: `localStorage` key `tc-term-grid-<count>` → `{cols, rows}`. On mount / when `count` changes, load that count's saved layout, else `equalTracks(...)`. This means customizing a 4-pane layout, dropping to 3, and returning to 4 restores the 4-pane layout; each count keeps its own.
- Exposes: `cols`, `rows`, `resizeCol(boundary, deltaFraction)`, `resizeRow(boundary, deltaFraction)`, `resetCol(boundary)`, `resetRow(boundary)`, all writing through to state + storage. `minFraction` is derived from a minimum cell size so a pane can't be dragged to nothing.

### `packages/desktop/src/renderer/TerminalGrid.tsx` (new)

Extracted from `TerminalDeck` to keep it focused. Props: `terminals: number[]`, `activeId`, `onActivate(id)`, and a render function for a pane cell (so it stays decoupled from `TerminalPane` wiring). Responsibilities:

- Render the grid with `gridTemplateColumns`/`gridTemplateRows` built from the hook's fractions (as `fr` units).
- Render thin divider handles at each interior track boundary (`cols.length - 1` vertical, `rows.length - 1` horizontal), positioned from the cumulative fractions and the container's measured size (via a ref).
- Drag: pointer-down on a handle captures the pointer; pointer-move converts pixel delta along the axis into a fraction delta (`delta / containerAxisSize`) and calls `resizeCol`/`resizeRow`; pointer-up releases. Double-click calls `resetCol`/`resetRow`.
- The handles live in the existing `gap` band (`gap: 6px`) so they don't steal cell space.

### `packages/desktop/src/renderer/TerminalDeck.tsx` (modify)

Replace the inline grid `<div>` (lines ~80-98) with `<TerminalGrid>` when `layout === "grid"`. Tabs mode rendering is unchanged. `TerminalDeck` keeps owning `terminals`/`activeId`/`layout`; the grid sizing moves into `TerminalGrid` + the hook.

### CSS (`*.css`, the `.term-deck-body.grid` block ~990)

- Keep `display: grid; gap: 6px; padding: 6px`.
- Add `.term-grid-gutter` (col/row variants): thin, cursor `col-resize`/`row-resize`, absolutely positioned over the gap, a hover/active highlight, and a comfortable hit area (wider than the visual line). Above the cells (`z-index`) but not capturing when idle beyond its band.

## Data flow

`TerminalDeck` (owns terminals/active/layout) → `TerminalGrid` (owns nothing but drag interaction) → `useGridLayout(count)` (owns persisted fractions) → CSS grid template + gutter positions. Drag → hook update → re-render with new template → `ResizeObserver` in each `TerminalPane` → xterm refit. One-way, no back-channel.

## Edge cases

- **Count changes (add/close terminal):** the hook swaps to the new count's stored (or equal) layout. No attempt to interpolate a 3-track layout into 4 — each count is independent and equal by default.
- **Minimum cell:** `minFraction` from a min px cell size (measured against the container) prevents a pane collapsing to zero; `resizeTracks` clamps.
- **1 terminal:** no dividers; `cols=[1]`, `rows=[1]`; identical to today.
- **Container not yet measured (first paint):** fall back to equal fractions until the ref reports a size; dividers render once measured.
- **Persistence corruption:** a malformed stored value (wrong length, non-numbers, NaN) is ignored in favor of `equalTracks`.

## Testing

- Unit (`grid.test.ts`): `equalTracks` sums/lengths; `resizeTracks` moves the right amount, clamps at `minFraction` (both directions), never reorders, preserves the sum, and reduces an over-large delta to the legal maximum; `gridRowCount` matches `gridColumns` for a range of counts.
- Manual gate (driven in the running app): open 4 terminals in grid mode, drag the vertical divider to widen the left column and confirm the xterm reflows; drag the horizontal divider; double-click to reset; close a terminal and confirm the layout swaps cleanly; reopen the app and confirm the layout persisted.

## Out of scope (logged)

- tmux-style arbitrary split tree (approach C).
- Drag-to-reorder panes (opencode "draggable tabs") — separate, smaller follow-on.
- Per-cell independent sizing (only shared row/column tracks here).
