# Terminal Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tabs↔grid layout toggle to the desktop terminal deck so terminals can tile side by side, all visible, one focused.

**Architecture:** `TerminalDeck` gains a persisted `layout` state and a toggle button. In grid mode it renders every `TerminalPane` visible in a CSS grid (columns = `ceil(sqrt(n))`), click-to-focus with an accent border; tabs mode is unchanged. `TerminalPane` is reused untouched — it already fits itself via a ResizeObserver and a start effect keyed on `hidden`, so no pty/xterm wiring changes.

**Tech Stack:** Electron + React renderer, xterm.js (`@xterm/addon-fit`), CSS, vitest.

**Spec:** `docs/superpowers/specs/2026-07-17-terminal-grid-design.md`

## Global Constraints

- **Code carries no comments.** Hard repo rule, stated twice by the user, emphatically. Explanations go in commit messages. Pre-existing comments in files you touch may stay.
- **Do not touch the pty/xterm fit machinery** in `TerminalPane.tsx` — it already fits on visibility change and container resize. Grid mode only changes layout + which panes are visible.
- **Columns rule is exactly** `cols = max(1, ceil(sqrt(n)))` — 1→1, 2→2, 3→2, 4→2, 5→3, 6→3, 9→3, 10→4.
- **Default layout is `"tabs"`** (today's behaviour); the choice persists in `localStorage` under the key `"tc-term-layout"`.
- **In grid mode every pane is visible** — the deck passes `hidden={hidden}` (its own hidden prop, i.e. whether the whole terminal view is behind the Chat tab) to all panes, NOT `hidden || id !== activeId`.
- Tests run with vitest from the WORKTREE ROOT: `npx vitest run`.
- The live xterm-renders-correctly-in-a-grid behaviour is the **user's manual gate** (needs a real Electron window + real terminals).

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/desktop/src/renderer/terminal/grid.ts` (new) | `gridColumns(n)` — the pure tiling rule |
| `packages/desktop/src/renderer/terminal/grid.test.ts` (new) | its test |
| `packages/desktop/src/renderer/TerminalDeck.tsx` | `layout` state (persisted), toggle button, grid rendering + focus |
| `packages/desktop/src/renderer/styles.css` | `.term-deck-body.grid`, its `.term-pane` override, `.term-pane.focused`, the toggle button |

---

### Task 1: The pure tiling rule

**Files:**
- Create: `packages/desktop/src/renderer/terminal/grid.ts`
- Test: `packages/desktop/src/renderer/terminal/grid.test.ts`

**Interfaces:**
- Produces: `gridColumns(n: number): number` — columns for `n` panes; `max(1, ceil(sqrt(n)))`.

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/src/renderer/terminal/grid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gridColumns } from "./grid";

describe("gridColumns", () => {
  it("tiles by the square-root rule", () => {
    expect(gridColumns(1)).toBe(1);
    expect(gridColumns(2)).toBe(2);
    expect(gridColumns(3)).toBe(2);
    expect(gridColumns(4)).toBe(2);
    expect(gridColumns(5)).toBe(3);
    expect(gridColumns(6)).toBe(3);
    expect(gridColumns(9)).toBe(3);
    expect(gridColumns(10)).toBe(4);
  });

  it("never returns less than one column", () => {
    expect(gridColumns(0)).toBe(1);
    expect(gridColumns(-3)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/desktop/src/renderer/terminal/grid.test.ts`
Expected: FAIL — cannot resolve `./grid`.

- [ ] **Step 3: Implement**

Create `packages/desktop/src/renderer/terminal/grid.ts`:

```ts
export function gridColumns(n: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(0, n))));
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run packages/desktop/src/renderer/terminal/grid.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/terminal/grid.ts packages/desktop/src/renderer/terminal/grid.test.ts
git commit -m "feat(desktop): the terminal grid tiling rule"
```

---

### Task 2: The layout toggle + grid rendering in TerminalDeck

**Files:**
- Modify: `packages/desktop/src/renderer/TerminalDeck.tsx` (whole component — it is 75 lines)

**Interfaces:**
- Consumes: `gridColumns` from `./terminal/grid`; the existing `TerminalPane` (props `id`, `cwd`, `hidden`, `themeKey`).
- Produces: no new exports.

Read the current `TerminalDeck.tsx` first. It holds `terminals: number[]`, `activeId`, `nextId`; a tab bar (`.term-tabs`) with per-terminal tabs, a close button, and an add (`+`) button; and `.term-deck-body` rendering every `TerminalPane` with `hidden={hidden || id !== activeId}`.

- [ ] **Step 1: Add persisted layout state**

At the top of the component, alongside the existing state:

```tsx
  const [layout, setLayout] = useState<"tabs" | "grid">(
    () => (localStorage.getItem("tc-term-layout") === "grid" ? "grid" : "tabs"),
  );
  const toggleLayout = () => {
    setLayout((prev) => {
      const next = prev === "grid" ? "tabs" : "grid";
      localStorage.setItem("tc-term-layout", next);
      return next;
    });
  };
```

- [ ] **Step 2: Add the toggle button to the tab bar**

In the `.term-tabs` div, after the add (`+`) button, add a layout toggle. Reuse the tab-button styling class for consistency; the label is a glyph that reflects the CURRENT-mode's action:

```tsx
        <button
          className="term-tab-add"
          title={layout === "grid" ? "Tabs view" : "Grid view"}
          onClick={toggleLayout}
        >
          {layout === "grid" ? "▭" : "▦"}
        </button>
```

- [ ] **Step 3: Render the body per layout**

Replace the `.term-deck-body` block so grid mode lays panes out visibly and tabs mode is unchanged:

```tsx
      <div
        className={`term-deck-body ${layout === "grid" ? "grid" : ""}`}
        style={layout === "grid" ? { gridTemplateColumns: `repeat(${gridColumns(terminals.length)}, minmax(0, 1fr))` } : undefined}
      >
        {terminals.map((id) => (
          <div
            key={id}
            className={`term-pane-cell ${layout === "grid" && id === activeId ? "focused" : ""}`}
            onMouseDown={layout === "grid" ? () => setActiveId(id) : undefined}
          >
            <TerminalPane
              id={id}
              cwd={cwd}
              hidden={layout === "grid" ? hidden : hidden || id !== activeId}
              themeKey={themeKey}
            />
          </div>
        ))}
      </div>
```

Note: the wrapping `.term-pane-cell` div is new — in tabs mode it is `position: absolute; inset: 0` (so nothing changes visually), in grid mode it is a grid item carrying the focus border. Import `gridColumns` at the top:

```tsx
import { gridColumns } from "./terminal/grid";
```

- [ ] **Step 4: Typecheck + build the desktop**

Run: `cd packages/desktop && npx tsc --noEmit` — no NEW errors in `TerminalDeck.tsx` (pre-existing `@termcoder/core`/`@termcoder/server` module-resolution errors in `src/main/index.ts` are unrelated). Then `npm run build` (electron-vite) — confirm it builds. (If it fails on `@termcoder/core` resolution, run `npx tsup` in `packages/core` and `packages/server` first — a known monorepo build-order quirk.)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run` — the grid test passes, nothing regressed. Report the count.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/renderer/TerminalDeck.tsx
git commit -m "feat(desktop): tabs<->grid layout toggle for the terminal deck"
```

---

### Task 3: The grid CSS

**Files:**
- Modify: `packages/desktop/src/renderer/styles.css` (near the existing `.term-deck-body` / `.term-pane` rules, ~lines 986–988)

**Interfaces:**
- Consumes: the class names from Task 2 (`.term-deck-body.grid`, `.term-pane-cell`, `.focused`).
- Produces: no exports.

Current relevant CSS (read it):
```
.term-deck-body { position: relative; flex: 1; min-height: 0; }
.term-pane { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--bg); }
.term-pane.hidden { display: none; }
```

- [ ] **Step 1: Add the cell + grid rules**

Add after the existing `.term-pane` rules:

```css
.term-pane-cell { position: absolute; inset: 0; }
.term-deck-body.grid { display: grid; gap: 6px; padding: 6px; }
.term-deck-body.grid .term-pane-cell { position: relative; inset: auto; min-width: 0; min-height: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.term-deck-body.grid .term-pane-cell.focused { border-color: var(--accent); }
.term-deck-body.grid .term-pane { position: absolute; inset: 0; }
```

Rationale (for the commit message, not the code): in tabs mode `.term-pane-cell` is `absolute inset:0` so the single visible pane fills the body exactly as before; in grid mode the cells become grid items with a border, and the pane fills its cell absolutely so xterm's fit measures the cell. `min-width/min-height: 0` lets grid cells shrink so panes can actually tile rather than overflow.

- [ ] **Step 2: Build the desktop and confirm CSS loads**

Run: `cd packages/desktop && npm run build` — confirm it builds (CSS is bundled).

- [ ] **Step 3: Manual verification (the user's gate) — write the checklist into the report**

There is no automated test for xterm rendering. In the commit, and in the task report, record the manual checklist for the user to run in a real Electron window:
- Toggle to grid with 1, 2, 4, and 6 terminals → all render, none garbled, each shell live.
- Click a pane → its border turns accent and keystrokes go to it.
- Resize the window → panes reflow and stay legible (no clipped/garbled text).
- Toggle back to tabs → single pane fills the body as before.
- Relaunch the app → the last layout choice is remembered.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): grid CSS for the terminal deck — tiled cells with a focused border"
```

---

## Manual acceptance (the user's gate)

- [ ] Grid tiles 6 terminals as 3×2, all live, one focused with an accent border.
- [ ] Clicking a pane focuses it (keystrokes go there).
- [ ] Window resize reflows without garbling any terminal.
- [ ] Toggling back to tabs restores the single-pane view; the choice persists across relaunch.
