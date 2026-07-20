# Draggable Terminal Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user drag the terminal grid's dividers to resize panes on both axes, with the sizes persisted per terminal count.

**Architecture:** Terminals keep flowing into an N×M CSS grid; column widths and row heights become shared, draggable `fr` tracks. Pure track math lives in `grid.ts` (fully unit-tested); a `useGridLayout` hook owns the persisted fractions; a new `TerminalGrid` component renders the grid, the divider handles, and the drag interaction, and is wired into `TerminalDeck` in grid mode only. xterm refits itself via the existing `ResizeObserver` in `TerminalPane`.

**Tech Stack:** React, TypeScript, CSS grid, xterm.js (unchanged), Vitest.

## Global Constraints

- **No code comments.** Do not add comments to any code you write.
- **Preserve CRLF** on all `packages/desktop/**` files. Match exact existing text with Edit; do not normalize to LF (`core.autocrlf=true`, so `git show` renders LF — that's normal).
- pnpm workspace. Targeted tests: `npx vitest run grid` from the worktree root. Typecheck: `pnpm --filter @termcoder/desktop typecheck` (build `@termcoder/server` first in a fresh worktree if it complains about `@termcoder/server` types: `pnpm --filter @termcoder/core build && pnpm --filter @termcoder/server build`). Web build: `pnpm --filter @termcoder/desktop build:web`.
- **Tabs mode is untouched.** All changes apply only when `layout === "grid"`.
- Desktop tests are pure-function (see `grid.test.ts`) — do NOT add a DOM/hook test that needs jsdom; keep testable logic in the pure `grid.ts` functions. The component drag is covered by the manual gate.

---

### Task 1: Pure track math and layout persistence helpers

All the drag/persistence logic as pure functions in `grid.ts`, fully unit-tested. No React, no DOM.

**Files:**
- Modify: `packages/desktop/src/renderer/terminal/grid.ts`
- Test: `packages/desktop/src/renderer/terminal/grid.test.ts`

**Interfaces produced:**
- `equalTracks(count: number): number[]` — `count` equal fractions each `1/count`; `count<=0` → `[]`.
- `gridRowCount(count: number): number` — `Math.ceil(count / gridColumns(count))`; `count<=0` → `0`.
- `resizeTracks(tracks: number[], boundary: number, deltaFraction: number, minFraction: number): number[]` — move width across the divider between `boundary` and `boundary+1`, clamped so neither drops below `minFraction`; sum preserved; never reorders; out-of-range boundary → copy unchanged.
- `layoutStorageKey(count: number): string` — `` `tc-term-grid-${count}` ``.
- `parseLayout(count: number, raw: string | null): { cols: number[]; rows: number[] }` — validated fractions from a stored string, else equal fractions.

- [ ] **Step 1: Write the failing tests**

Append to `packages/desktop/src/renderer/terminal/grid.test.ts`:

```ts
import {
  equalTracks,
  gridRowCount,
  resizeTracks,
  layoutStorageKey,
  parseLayout,
} from "./grid";

describe("equalTracks", () => {
  it("returns count equal fractions summing to 1", () => {
    expect(equalTracks(1)).toEqual([1]);
    const four = equalTracks(4);
    expect(four).toHaveLength(4);
    expect(four.every((f) => Math.abs(f - 0.25) < 1e-9)).toBe(true);
    expect(four.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("returns an empty array for non-positive counts", () => {
    expect(equalTracks(0)).toEqual([]);
    expect(equalTracks(-2)).toEqual([]);
  });
});

describe("gridRowCount", () => {
  it("matches ceil(count / gridColumns)", () => {
    expect(gridRowCount(1)).toBe(1);
    expect(gridRowCount(2)).toBe(1);
    expect(gridRowCount(3)).toBe(2);
    expect(gridRowCount(4)).toBe(2);
    expect(gridRowCount(5)).toBe(2);
    expect(gridRowCount(7)).toBe(3);
    expect(gridRowCount(0)).toBe(0);
  });
});

describe("resizeTracks", () => {
  it("moves the delta from one track to its neighbour, preserving the sum", () => {
    const out = resizeTracks([0.5, 0.5], 0, 0.1, 0.05);
    expect(out[0]).toBeCloseTo(0.6);
    expect(out[1]).toBeCloseTo(0.4);
    expect(out[0] + out[1]).toBeCloseTo(1);
  });
  it("clamps so neither track drops below minFraction", () => {
    const out = resizeTracks([0.5, 0.5], 0, 0.9, 0.1);
    expect(out[1]).toBeCloseTo(0.1);
    expect(out[0]).toBeCloseTo(0.9);
  });
  it("clamps a negative delta the same way", () => {
    const out = resizeTracks([0.5, 0.5], 0, -0.9, 0.1);
    expect(out[0]).toBeCloseTo(0.1);
    expect(out[1]).toBeCloseTo(0.9);
  });
  it("leaves other tracks untouched", () => {
    const out = resizeTracks([0.25, 0.25, 0.5], 0, 0.1, 0.05);
    expect(out[2]).toBeCloseTo(0.5);
  });
  it("returns a copy unchanged for an out-of-range boundary", () => {
    expect(resizeTracks([0.5, 0.5], 1, 0.1, 0.05)).toEqual([0.5, 0.5]);
    expect(resizeTracks([0.5, 0.5], -1, 0.1, 0.05)).toEqual([0.5, 0.5]);
  });
  it("makes no move when there is no room for either side", () => {
    expect(resizeTracks([0.1, 0.1], 0, 0.05, 0.1)).toEqual([0.1, 0.1]);
  });
});

describe("parseLayout", () => {
  it("falls back to equal tracks when raw is null", () => {
    const out = parseLayout(4, null);
    expect(out.cols).toHaveLength(2);
    expect(out.rows).toHaveLength(2);
  });
  it("returns stored fractions of the right shape", () => {
    const stored = JSON.stringify({ cols: [0.6, 0.4], rows: [0.7, 0.3] });
    expect(parseLayout(4, stored)).toEqual({ cols: [0.6, 0.4], rows: [0.7, 0.3] });
  });
  it("falls back when lengths do not match the count", () => {
    const stored = JSON.stringify({ cols: [1], rows: [1] });
    const out = parseLayout(4, stored);
    expect(out.cols).toHaveLength(2);
  });
  it("falls back on malformed or non-finite data", () => {
    expect(parseLayout(2, "not json").cols).toHaveLength(2);
    expect(parseLayout(2, JSON.stringify({ cols: [1, "x"], rows: [1] })).cols).toEqual(equalTracks(2));
    expect(parseLayout(2, JSON.stringify({ cols: [1, NaN], rows: [1] })).cols).toEqual(equalTracks(2));
  });
  it("uses the count-scoped storage key", () => {
    expect(layoutStorageKey(3)).toBe("tc-term-grid-3");
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run grid`
Expected: FAIL — the new exports do not exist yet.

- [ ] **Step 3: Implement in `grid.ts`**

Append below the existing `gridColumns`:

```ts
export function equalTracks(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, () => 1 / count);
}

export function gridRowCount(count: number): number {
  if (count <= 0) return 0;
  return Math.ceil(count / gridColumns(count));
}

export function resizeTracks(
  tracks: number[],
  boundary: number,
  deltaFraction: number,
  minFraction: number,
): number[] {
  if (boundary < 0 || boundary >= tracks.length - 1) return tracks.slice();
  const a = tracks[boundary]!;
  const b = tracks[boundary + 1]!;
  const lo = minFraction - a;
  const hi = b - minFraction;
  if (lo > hi) return tracks.slice();
  const delta = Math.max(lo, Math.min(hi, deltaFraction));
  const next = tracks.slice();
  next[boundary] = a + delta;
  next[boundary + 1] = b - delta;
  return next;
}

export function layoutStorageKey(count: number): string {
  return `tc-term-grid-${count}`;
}

export function parseLayout(
  count: number,
  raw: string | null,
): { cols: number[]; rows: number[] } {
  const fallback = { cols: equalTracks(gridColumns(count)), rows: equalTracks(gridRowCount(count)) };
  if (!raw) return fallback;
  const valid = (arr: unknown, len: number): arr is number[] =>
    Array.isArray(arr) &&
    arr.length === len &&
    arr.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0);
  try {
    const parsed = JSON.parse(raw) as { cols?: unknown; rows?: unknown };
    if (valid(parsed.cols, gridColumns(count)) && valid(parsed.rows, gridRowCount(count))) {
      return { cols: parsed.cols, rows: parsed.rows };
    }
    return fallback;
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run grid`
Expected: PASS (all existing + new cases).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/terminal/grid.ts packages/desktop/src/renderer/terminal/grid.test.ts
git commit -m "feat(desktop): pure track math and layout persistence for the terminal grid"
```

---

### Task 2: `useGridLayout` hook, `TerminalGrid` component, gutters, and wiring

The interactive layer: a hook that owns persisted fractions, a component that renders the grid + draggable handles, the CSS for the handles, and the swap in `TerminalDeck`. Verified by typecheck, web build, and the manual gate.

**Files:**
- Create: `packages/desktop/src/renderer/terminal/useGridLayout.ts`
- Create: `packages/desktop/src/renderer/TerminalGrid.tsx`
- Modify: `packages/desktop/src/renderer/TerminalDeck.tsx`
- Modify: `packages/desktop/src/renderer/styles.css`

**Interfaces:**
- Consumes (Task 1): `equalTracks`, `gridColumns`, `gridRowCount`, `layoutStorageKey`, `parseLayout`, `resizeTracks` from `./terminal/grid`.
- Produces: `useGridLayout(count: number): { cols; rows; setCols(next): void; setRows(next): void; resetCol(boundary): void; resetRow(boundary): void }`; `TerminalGrid` component.

- [ ] **Step 1: Write the hook**

Create `packages/desktop/src/renderer/terminal/useGridLayout.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { equalTracks, gridColumns, gridRowCount, layoutStorageKey, parseLayout } from "./grid";

type Layout = { cols: number[]; rows: number[] };

function load(count: number): Layout {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(layoutStorageKey(count)) : null;
  return parseLayout(count, raw);
}

export function useGridLayout(count: number) {
  const [layout, setLayout] = useState<Layout>(() => load(count));
  const ref = useRef(layout);
  ref.current = layout;

  useEffect(() => {
    setLayout(load(count));
  }, [count]);

  const persist = useCallback(
    (next: Layout) => {
      setLayout(next);
      try {
        localStorage.setItem(layoutStorageKey(count), JSON.stringify(next));
      } catch {}
    },
    [count],
  );

  const setCols = useCallback((cols: number[]) => persist({ cols, rows: ref.current.rows }), [persist]);
  const setRows = useCallback((rows: number[]) => persist({ cols: ref.current.cols, rows }), [persist]);

  const resetCol = useCallback(
    (boundary: number) => {
      const cols = ref.current.cols.slice();
      if (boundary < 0 || boundary >= cols.length - 1) return;
      const avg = (cols[boundary]! + cols[boundary + 1]!) / 2;
      cols[boundary] = avg;
      cols[boundary + 1] = avg;
      persist({ cols, rows: ref.current.rows });
    },
    [persist],
  );

  const resetRow = useCallback(
    (boundary: number) => {
      const rows = ref.current.rows.slice();
      if (boundary < 0 || boundary >= rows.length - 1) return;
      const avg = (rows[boundary]! + rows[boundary + 1]!) / 2;
      rows[boundary] = avg;
      rows[boundary + 1] = avg;
      persist({ cols: ref.current.cols, rows });
    },
    [persist],
  );

  return {
    cols: layout.cols.length ? layout.cols : equalTracks(gridColumns(count)),
    rows: layout.rows.length ? layout.rows : equalTracks(gridRowCount(count)),
    setCols,
    setRows,
    resetCol,
    resetRow,
  };
}
```

Note: import is `useRef` (fix the import line to `useCallback, useEffect, useRef, useState`).

- [ ] **Step 2: Write the `TerminalGrid` component**

Create `packages/desktop/src/renderer/TerminalGrid.tsx`:

```tsx
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { resizeTracks } from "./terminal/grid";
import { useGridLayout } from "./terminal/useGridLayout";

const MIN_CELL_PX = 120;

export function TerminalGrid({
  terminals,
  activeId,
  onActivate,
  renderPane,
}: {
  terminals: number[];
  activeId: number;
  onActivate: (id: number) => void;
  renderPane: (id: number) => ReactNode;
}) {
  const count = terminals.length;
  const { cols, rows, setCols, setRows, resetCol, resetRow } = useGridLayout(count);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  function startDrag(
    axis: "col" | "row",
    boundary: number,
    e: React.PointerEvent,
  ) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const startTracks = axis === "col" ? cols.slice() : rows.slice();
    const start = axis === "col" ? e.clientX : e.clientY;
    const axisSize = axis === "col" ? size.w : size.h;
    if (axisSize <= 0) return;
    const minFraction = Math.min(0.45, MIN_CELL_PX / axisSize);
    const move = (ev: PointerEvent) => {
      const now = axis === "col" ? ev.clientX : ev.clientY;
      const deltaFraction = (now - start) / axisSize;
      const next = resizeTracks(startTracks, boundary, deltaFraction, minFraction);
      if (axis === "col") setCols(next);
      else setRows(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const cumulative = (tracks: number[], i: number) =>
    tracks.slice(0, i + 1).reduce((a, b) => a + b, 0);

  return (
    <div
      ref={bodyRef}
      className="term-deck-body grid"
      style={{
        gridTemplateColumns: cols.map((f) => `${f}fr`).join(" "),
        gridTemplateRows: rows.map((f) => `${f}fr`).join(" "),
      }}
    >
      {terminals.map((id) => (
        <div
          key={id}
          className={`term-pane-cell ${id === activeId ? "focused" : ""}`}
          onMouseDown={() => onActivate(id)}
        >
          {renderPane(id)}
        </div>
      ))}
      {cols.slice(0, -1).map((_, i) => (
        <div
          key={`c${i}`}
          className="term-grid-gutter col"
          style={{ left: `${cumulative(cols, i) * 100}%` }}
          onPointerDown={(e) => startDrag("col", i, e)}
          onDoubleClick={() => resetCol(i)}
        />
      ))}
      {rows.slice(0, -1).map((_, i) => (
        <div
          key={`r${i}`}
          className="term-grid-gutter row"
          style={{ top: `${cumulative(rows, i) * 100}%` }}
          onPointerDown={(e) => startDrag("row", i, e)}
          onDoubleClick={() => resetRow(i)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire `TerminalGrid` into `TerminalDeck`**

In `packages/desktop/src/renderer/TerminalDeck.tsx`, add the import at the top:

```ts
import { TerminalGrid } from "./TerminalGrid";
```

Replace the grid body block (the `<div className={\`term-deck-body ...\`} ...>` through its closing `</div>`, currently lines ~80-98) with a branch: tabs mode keeps the current flat body; grid mode delegates to `TerminalGrid`. The pane rendering (the `<TerminalPane .../>` inside a `.term-pane-cell`) is identical in both; extract it into a local `renderPane`:

```tsx
  const renderPane = (id: number) => (
    <TerminalPane
      id={id}
      cwd={cwd}
      hidden={layout === "grid" ? hidden : hidden || id !== activeId}
      themeKey={themeKey}
    />
  );

  return (
    <div className={`term-deck ${hidden ? "hidden" : ""}`}>
      <div className="term-tabs">
        {/* unchanged tab bar */}
      </div>
      {layout === "grid" ? (
        <TerminalGrid
          terminals={terminals}
          activeId={activeId}
          onActivate={setActiveId}
          renderPane={renderPane}
        />
      ) : (
        <div className="term-deck-body">
          {terminals.map((id) => (
            <div key={id} className="term-pane-cell">
              {renderPane(id)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
```

Keep the existing tab bar markup (the `.term-tabs` block, lines ~51-79) exactly as it is — only the body below it changes. Do not remove the layout toggle button.

- [ ] **Step 4: Add gutter CSS**

In `packages/desktop/src/renderer/styles.css`, immediately after the `.term-deck-body.grid .term-pane { position: absolute; inset: 0; }` line (~993), add:

```css
.term-grid-gutter { position: absolute; z-index: 5; background: transparent; }
.term-grid-gutter.col { top: 0; bottom: 0; width: 10px; margin-left: -5px; cursor: col-resize; }
.term-grid-gutter.row { left: 0; right: 0; height: 10px; margin-top: -5px; cursor: row-resize; }
.term-grid-gutter::after { content: ""; position: absolute; background: var(--border); opacity: 0; transition: opacity 0.12s; }
.term-grid-gutter.col::after { top: 0; bottom: 0; left: 4px; width: 2px; }
.term-grid-gutter.row::after { left: 0; right: 0; top: 4px; height: 2px; }
.term-grid-gutter:hover::after, .term-grid-gutter:active::after { opacity: 1; background: var(--accent); }
```

- [ ] **Step 5: Typecheck and web build**

Run: `pnpm --filter @termcoder/desktop typecheck`
Expected: no errors. (If it fails resolving `@termcoder/server`, run `pnpm --filter @termcoder/core build && pnpm --filter @termcoder/server build` first — a fresh-worktree build-order gap, not a code error.)

Run: `pnpm --filter @termcoder/desktop build:web`
Expected: builds `dist-web` with no error.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/renderer/terminal/useGridLayout.ts packages/desktop/src/renderer/TerminalGrid.tsx packages/desktop/src/renderer/TerminalDeck.tsx packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): draggable dividers for the terminal grid"
```

- [ ] **Step 7: Record the manual gate**

Cannot be automated here (needs the running app). Note for the controller to drive:
- Open 4 terminals, switch to grid view.
- Drag the vertical divider right — the left column widens, the right narrows, and both terminals reflow (xterm columns change).
- Drag the horizontal divider — the top row grows, bottom shrinks.
- Double-click a divider — its two tracks return to equal.
- Confirm a pane cannot be dragged smaller than ~120px.
- Close a terminal (now 3) — the layout swaps cleanly; reopen to 4 — the customized 4-layout is restored.
- Quit and relaunch — the layout persisted.

---

## Self-Review

**Spec coverage:**
- `equalTracks`, `gridRowCount`, `resizeTracks` (clamped, sum-preserving, no reorder) → Task 1. ✅
- `layoutStorageKey` / `parseLayout` persistence + corruption fallback → Task 1. ✅
- `useGridLayout` per-count persisted fractions → Task 2 Step 1. ✅
- `TerminalGrid` grid + gutters + drag (snapshot + cumulative delta) + double-click reset → Task 2 Steps 2-4. ✅
- Wire into `TerminalDeck`, grid-only, tabs untouched → Task 2 Step 3. ✅
- xterm refit via existing ResizeObserver → no code needed; relied upon (Step 7 verifies). ✅
- Min cell size clamp → `MIN_CELL_PX` → `minFraction` in Task 2 Step 2 + `resizeTracks` clamp. ✅
- Container-not-measured fallback → `size` starts `{0,0}`, drag guarded by `axisSize<=0`; tracks still render from equal fractions. ✅

**Placeholder scan:** No TBD/TODO; every code step is complete.

**Type consistency:** `resizeTracks(tracks, boundary, deltaFraction, minFraction)` used identically in Task 1 and Task 2. `useGridLayout` returns `{cols, rows, setCols, setRows, resetCol, resetRow}` — all consumed in `TerminalGrid`. `parseLayout`/`equalTracks`/`gridColumns`/`gridRowCount` signatures match between tasks.

**Simplification noted:** `minFraction` uses a fixed `MIN_CELL_PX / axisSize` (capped at 0.45) rather than a fully general per-track px model — adequate for the small terminal counts the grid targets, and clamped so it never exceeds a movable range.
