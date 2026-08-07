# Desktop Finish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the desktop renderer the spacing, type, elevation and focus vocabulary its theme system never had, collapse 84 pixel values / 18 font sizes / 36 shadows onto it, and extract the four UI patterns that measurably repeat.

**Architecture:** New tokens go into the existing `:root` block in `packages/desktop/src/renderer/styles.css`, beside the 28 that are already there — this is an addition, not a replacement. Four presentational primitives land in a new `renderer/ui/` directory and read only tokens. A guard test parses `styles.css` and fails on any off-scale value, carrying a shrinking allowlist of unswept surfaces; the last task empties it. The sweep runs surface by surface, never file by file.

**Tech Stack:** React 19, Electron (electron-vite), plain CSS with custom properties (no Tailwind in the desktop), vitest from the repository root, TypeScript.

## Global Constraints

- **No colour changes.** `--accent`, `--accent-dim`, `--accent-hot`, `--accent-glow`, `--ok`, `--bad`, `--warn`, every colour theme, `[data-theme]` light/dark — all untouched. A user on a purple theme must stay on a purple theme after every task.
- **`--mono` keeps its name.** Renaming it would touch every call site for no gain.
- **Density and motion must keep working.** `:root[data-density="compact"]` (styles.css:72-76) and `:root[data-motion="off"]` (77-79) override real values; when a surface is swept, its density overrides move onto the scale too, in the same task.
- Spacing scale, exactly: `--s-1: 2px  --s-2: 4px  --s-3: 6px  --s-4: 8px  --s-5: 12px  --s-6: 16px  --s-7: 24px  --s-8: 32px  --s-9: 48px`.
- Type scale, exactly: `--fs-1: 11px  --fs-2: 12px  --fs-3: 13px  --fs-4: 15px  --fs-5: 18px  --fs-6: 24px  --fs-7: 32px`.
- Weights: `--fw-regular: 400  --fw-medium: 500  --fw-semibold: 600`. Line heights: `--lh-tight: 1.25  --lh-body: 1.55`.
- Shadows compose from `--shadow-rgb`, never from hardcoded black. A black shadow on a light surface is the tell of a badly ported dark-first app, and this app has light themes.
- An off-scale value is permitted **only** with `/* off-scale: <reason> */` on the same line. The guard requires the reason text; an exemption is always a sentence somebody wrote.
- Primitives are presentational. They take no effects, own no state, and never swallow a handler or an `aria-label` from the markup they replace.
- `IDELayout.tsx` (2,772 lines) is tokenised but **not restructured** — project 2 rewrites that surface.
- Verification per task: `pnpm --filter @termcoder/desktop typecheck` clean, `pnpm test` with no new failures against the baseline recorded in Task 1, and a visual check in **one light theme and one dark theme**.
- `pnpm test` from the repository root does not exit zero: 7 test files fail on a pre-existing `better-sqlite3` native-binding problem. The bar is that the count does not grow.
- Conventional Commits, lowercase scope. End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## File Structure

**Created**

| path | responsibility |
| --- | --- |
| `packages/desktop/src/renderer/styles.guard.test.ts` | parses `styles.css`, fails on off-scale values, carries the shrinking allowlist |
| `packages/desktop/src/renderer/ui/Btn.tsx` | the button primitive |
| `packages/desktop/src/renderer/ui/Row.tsx` | the list-line primitive |
| `packages/desktop/src/renderer/ui/Panel.tsx` | the surface-with-head primitive |
| `packages/desktop/src/renderer/ui/Chip.tsx` | the chip primitive |
| `packages/desktop/src/renderer/ui/index.ts` | one import site for the four |

**Modified**

| path | change |
| --- | --- |
| `packages/desktop/src/renderer/styles.css` | new tokens in `:root`; then per-surface collapse onto them |
| `Hero.tsx`, `Welcome.tsx` | surface 1 |
| `App.tsx`, `MessageParser.tsx`, `ToolCard.tsx` | surface 2 |
| `Rail.tsx`, `SessionsPanel.tsx`, `ViewSwitcher.tsx` | surface 3 |
| `TerminalDeck.tsx`, `TerminalGrid.tsx`, `TerminalPane.tsx` | surface 4 |
| `Settings.tsx` | surface 5 |
| `SidePanel.tsx`, `RecipesPanel.tsx`, `ClassroomPanel.tsx`, `ModelBrowser.tsx`, `Study.tsx` | surface 6 |
| `CommandPalette.tsx`, `FilePreview.tsx`, `IDELayout.tsx` | surface 7 (IDELayout: tokens only) |

---

## Phase 0 — Make the gate real

### Task 1: The style guard, written red

**Files:**
- Create: `packages/desktop/src/renderer/styles.guard.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the constant `UNSWEPT` — an array of CSS selector prefixes the guard skips. Later tasks delete entries from it by exact string.

- [ ] **Step 1: Record the baseline before touching anything**

```bash
pnpm test 2>&1 | tail -6
```

Write down the failed-file and failed-test counts. Every later task is measured against these two numbers, not against zero.

- [ ] **Step 2: Write the guard**

Create `packages/desktop/src/renderer/styles.guard.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Selector prefixes not yet swept onto the scale. Each sweep task deletes its
// own entries; the final task empties the array and the guard then covers the
// whole file permanently.
const UNSWEPT: string[] = [
  ".hero", ".welcome",
  ".composer", ".transcript", ".bubble", ".markdown", ".tool",
  ".rail", ".session", ".srow", ".switcher",
  ".xterm", ".term", ".deck",
  ".settings", ".set-",
  ".side", ".recipe", ".classroom", ".model-", ".study",
  ".palette", ".preview", ".ide-", ".scm-", ".editor-", ".test-",
];

const SPACING = new Set([0, 2, 4, 6, 8, 12, 16, 24, 32, 48]);
const FONT_SIZES = new Set([11, 12, 13, 15, 18, 24, 32]);
const SHADOW_TOKENS = ["var(--sh-flat)", "var(--sh-raised)", "var(--sh-float)", "var(--sh-modal)", "none"];

// import.meta.url, not __dirname: these tests run as ESM, where __dirname does
// not exist and the guard would throw before asserting anything.
const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

// Walk the file line by line, tracking which selector block we are inside, so a
// violation can be attributed to a surface and skipped while that surface is
// still on the allowlist.
interface Line { n: number; text: string; selector: string }

function lines(): Line[] {
  const out: Line[] = [];
  let selector = "";
  css.split("\n").forEach((text, i) => {
    const open = text.indexOf("{");
    if (open > 0) selector = text.slice(0, open).trim();
    out.push({ n: i + 1, text, selector });
  });
  return out;
}

const unswept = (selector: string) => UNSWEPT.some((p) => selector.includes(p));
const exempt = (text: string) => /\/\*\s*off-scale:\s*\S+/.test(text);

describe("styles.css stays on the scale", () => {
  it("uses only spacing-scale values for padding, margin and gap", () => {
    const bad: string[] = [];
    for (const { n, text, selector } of lines()) {
      if (unswept(selector) || exempt(text)) continue;
      const decl = /^\s*(padding|margin|gap|row-gap|column-gap)[a-z-]*\s*:([^;]+);/.exec(text);
      if (!decl) continue;
      for (const px of decl[2]!.matchAll(/(\d+)px/g)) {
        const v = Number(px[1]);
        if (!SPACING.has(v)) bad.push(`${n}: ${selector} — ${v}px in ${decl[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("uses only type-scale font sizes", () => {
    const bad: string[] = [];
    for (const { n, text, selector } of lines()) {
      if (unswept(selector) || exempt(text)) continue;
      // Decimals and rem are caught too: `font-size: 12.5px` is exactly the kind
      // of value a scale exists to eliminate, and an integer-only pattern would
      // wave it through.
      const decl = /^\s*font-size\s*:\s*([\d.]+)(px|rem)/.exec(text);
      if (!decl) continue;
      const px = decl[2] === "rem" ? Number(decl[1]) * 16 : Number(decl[1]);
      if (!FONT_SIZES.has(px)) bad.push(`${n}: ${selector} — ${decl[1]}${decl[2]}`);
    }
    expect(bad).toEqual([]);
  });

  it("uses only the four shadow tokens", () => {
    const bad: string[] = [];
    for (const { n, text, selector } of lines()) {
      if (unswept(selector) || exempt(text)) continue;
      if (selector === ":root") continue; // the tokens are declared here
      const decl = /^\s*box-shadow\s*:([^;]+);/.exec(text);
      if (decl && !SHADOW_TOKENS.some((t) => decl[1]!.includes(t))) bad.push(`${n}: ${selector}`);
    }
    expect(bad).toEqual([]);
  });

  it("routes every focus outline through --ring", () => {
    const bad: string[] = [];
    for (const { n, text, selector } of lines()) {
      if (unswept(selector) || exempt(text)) continue;
      // `none` is NOT allowed. All 35 outline declarations in this file are
      // currently `outline: none`, so an allowance for it would let the guard
      // pass forever on an app with no visible focus anywhere. Suppressing the
      // default ring is legitimate only when the element defines its own
      // :focus-visible ring from --ring; anything else needs a written reason.
      const decl = /^\s*outline\s*:([^;]+);/.exec(text);
      if (decl && !decl[1]!.includes("var(--ring)")) bad.push(`${n}: ${selector} — ${decl[1]!.trim()}`);
    }
    expect(bad).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run packages/desktop/src/renderer/styles.guard.test.ts
```

Expected: FAIL. The failures name real line numbers in `styles.css` — every one is a value outside the scale in a selector that is not on the allowlist. That failure is the deliverable: it is the definition of done, written before the work.

If it *passes*, the allowlist is too broad — check that `UNSWEPT` matches only the selector prefixes listed above and not, say, a bare `"."`.

- [ ] **Step 4: Commit the red guard**

```bash
git add packages/desktop/src/renderer/styles.guard.test.ts
git commit -m "test(desktop): guard the spacing, type, elevation and focus scales"
```

---

## Phase 1 — The vocabulary

### Task 2: The token layer

**Files:**
- Modify: `packages/desktop/src/renderer/styles.css` (the `:root` block at line 1, and the `[data-theme]` blocks)

**Interfaces:**
- Consumes: nothing.
- Produces: the tokens every later task uses — `--s-1..--s-9`, `--fs-1..--fs-7`, `--fw-regular|medium|semibold`, `--lh-tight|body`, `--sans`, `--shadow-rgb`, `--sh-flat|raised|float|modal`, `--ring`. `--mono` and all colour tokens are unchanged.

- [ ] **Step 1: Add the tokens to `:root`**

Append inside the existing `:root { … }` block, after the tokens already there:

```css
  /* ── finish vocabulary ─────────────────────────────────────────────
     The theme system above owns colour. This owns everything else:
     rhythm, type, depth and focus. Values here are the only ones the
     guard permits — see styles.guard.test.ts. */

  --s-1: 2px;  --s-2: 4px;  --s-3: 6px;  --s-4: 8px;  --s-5: 12px;
  --s-6: 16px; --s-7: 24px; --s-8: 32px; --s-9: 48px;

  --sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --fs-1: 11px; --fs-2: 12px; --fs-3: 13px; --fs-4: 15px;
  --fs-5: 18px; --fs-6: 24px; --fs-7: 32px;
  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600;
  --lh-tight: 1.25; --lh-body: 1.55;

  /* Shadows compose from a themeable colour rather than hardcoding black,
     so a light theme can soften or retint them. */
  --shadow-rgb: 0 0 0;
  --sh-flat: none;
  --sh-raised: 0 1px 2px rgb(var(--shadow-rgb) / 0.16);
  --sh-float: 0 8px 24px -8px rgb(var(--shadow-rgb) / 0.32);
  --sh-modal: 0 24px 64px -16px rgb(var(--shadow-rgb) / 0.48);

  --ring: 2px solid var(--accent);
```

- [ ] **Step 2: Soften the shadow colour for light themes**

Find the light-theme block. Locate it with:

```bash
grep -n 'data-theme="light"\|data-theme=.light.' packages/desktop/src/renderer/styles.css | head -3
```

Inside that block add:

```css
  /* A pure-black shadow reads as dirt on a light surface. */
  --shadow-rgb: 30 27 24;
```

If the grep returns nothing, the light theme is expressed some other way — read the file around the `:root` block, find how light mode is selected, and add the override there. Report which selector you used.

- [ ] **Step 3: Confirm nothing rendered changed yet**

```bash
pnpm --filter @termcoder/desktop typecheck
npx vitest run packages/desktop/src/renderer/styles.guard.test.ts
```

Expected: typecheck clean. The guard still FAILS — adding tokens does not collapse any existing value onto them. That is correct at this point.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): spacing, type, elevation and focus tokens"
```

---

### Task 3: The four primitives

**Files:**
- Create: `packages/desktop/src/renderer/ui/Btn.tsx`, `Row.tsx`, `Panel.tsx`, `Chip.tsx`, `index.ts`
- Modify: `packages/desktop/src/renderer/styles.css` (append the four classes)

**Interfaces:**
- Consumes: the tokens from Task 2.
- Produces, and every sweep task uses exactly these names:
  - `<Btn size?: "sm" | "md" = "md", tone?: "quiet" | "solid" | "danger" = "quiet", …ButtonHTMLAttributes>`
  - `<Row active?: boolean, …HTMLAttributes<HTMLDivElement>>`
  - `<Panel head?: React.ReactNode, elevation?: "flat" | "raised" = "flat", …HTMLAttributes<HTMLDivElement>>`
  - `<Chip on?: boolean, …ButtonHTMLAttributes>`

- [ ] **Step 1: Write the four components**

`packages/desktop/src/renderer/ui/Btn.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

// Presentational only. Every handler, label and aria-* passes straight through
// — a swept surface keeps its behaviour and changes only what it renders into.
export function Btn({
  size = "md",
  tone = "quiet",
  className = "",
  ...rest
}: { size?: "sm" | "md"; tone?: "quiet" | "solid" | "danger" } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`u-btn u-btn-${size} u-btn-${tone} ${className}`.trim()} {...rest} />;
}
```

`ui/Row.tsx`:

```tsx
import type { HTMLAttributes } from "react";

export function Row({
  active = false,
  className = "",
  ...rest
}: { active?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`u-row ${active ? "is-active" : ""} ${className}`.trim()} {...rest} />;
}
```

`ui/Panel.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from "react";

export function Panel({
  head,
  elevation = "flat",
  className = "",
  children,
  ...rest
}: { head?: ReactNode; elevation?: "flat" | "raised" } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`u-panel u-panel-${elevation} ${className}`.trim()} {...rest}>
      {head !== undefined && <div className="u-panel-head">{head}</div>}
      <div className="u-panel-body">{children}</div>
    </div>
  );
}
```

`ui/Chip.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

export function Chip({
  on = false,
  className = "",
  ...rest
}: { on?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`u-chip ${on ? "is-on" : ""} ${className}`.trim()} aria-pressed={on} {...rest} />;
}
```

`ui/index.ts`:

```ts
export { Btn } from "./Btn";
export { Row } from "./Row";
export { Panel } from "./Panel";
export { Chip } from "./Chip";
```

- [ ] **Step 2: Add their CSS**

Append to `styles.css`. Note the `u-` prefix: it keeps these out of the way of the existing `.btn`, `.chip` and `.card` rules, which stay working until each surface is swept.

```css
/* ── primitives ───────────────────────────────────────────────────── */
.u-btn {
  display: inline-flex; align-items: center; gap: var(--s-3);
  border: 1px solid var(--border); border-radius: var(--r-md);
  background: var(--elev); color: var(--text);
  font-family: var(--sans); font-size: var(--fs-3); font-weight: var(--fw-medium);
  cursor: pointer; transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}
.u-btn-sm { padding: var(--s-2) var(--s-4); }
.u-btn-md { padding: var(--s-3) var(--s-5); }
.u-btn-quiet:hover { background: var(--elev2); }
.u-btn-solid { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.u-btn-danger { color: var(--bad); }
.u-btn:focus-visible { outline: var(--ring); outline-offset: 2px; }
.u-btn:disabled { opacity: 0.5; cursor: default; }

.u-row {
  display: flex; align-items: center; gap: var(--s-4);
  padding: var(--s-3) var(--s-5); border-radius: var(--r-sm);
  font-family: var(--sans); font-size: var(--fs-3); line-height: var(--lh-body);
  color: var(--text);
}
.u-row:hover { background: var(--elev); }
.u-row.is-active { background: var(--elev2); }
.u-row:focus-visible { outline: var(--ring); outline-offset: -2px; }

.u-panel {
  border: 1px solid var(--border); border-radius: var(--r-md);
  background: var(--panel); overflow: hidden;
}
.u-panel-flat { box-shadow: var(--sh-flat); }
.u-panel-raised { background: var(--elev); box-shadow: var(--sh-raised); }
.u-panel-head {
  padding: var(--s-4) var(--s-5); border-bottom: 1px solid var(--border);
  font-family: var(--sans); font-size: var(--fs-2); font-weight: var(--fw-semibold);
  color: var(--muted);
}
.u-panel-body { padding: var(--s-5); }

.u-chip {
  display: inline-flex; align-items: center; gap: var(--s-2);
  padding: var(--s-2) var(--s-4); border: 1px solid var(--border);
  border-radius: var(--r-lg); background: transparent; color: var(--muted);
  font-family: var(--sans); font-size: var(--fs-1); cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}
.u-chip:hover { color: var(--text); }
.u-chip.is-on { color: var(--accent); border-color: var(--accent); }
.u-chip:focus-visible { outline: var(--ring); outline-offset: 2px; }
```

- [ ] **Step 3: Typecheck and confirm the guard sees the new CSS as clean**

```bash
pnpm --filter @termcoder/desktop typecheck
npx vitest run packages/desktop/src/renderer/styles.guard.test.ts
```

Expected: typecheck clean. The guard still fails on the unswept surfaces, but **must not** name any `.u-` selector — the primitives are written on the scale from the start. If it names one, fix the primitive, not the guard.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer/ui packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): Btn, Row, Panel and Chip on the new scales"
```

---

## Phase 2 — The sweep

Tasks 4 through 10 share one shape. For each:

1. Read the surface's CSS rules and its `.tsx`.
2. Collapse every `padding`, `margin`, `gap` onto `--s-*`; every `font-size` onto `--fs-*`; every `box-shadow` onto `--sh-*`. Judge each value by the job it does — `5px` is `--s-2` in a tight inline gap and `--s-3` in a list row. This is not find-and-replace.
3. Where a value genuinely cannot sit on the scale — optical alignment, a hairline, a sprite offset — leave it and annotate `/* off-scale: <reason> */` on the same line.
4. **Restore focus.** Every `outline: none` in this surface is a keyboard user who cannot see where they are — there are 35 across the file and not one visible ring. Replace each with a real `:focus-visible { outline: var(--ring); outline-offset: … }` on the element that was silenced. If an element genuinely must not show a ring, say why with the exemption comment; "it looked noisy" is not a reason.
5. Replace hand-rolled buttons, list lines, cards and chips with `Btn`, `Row`, `Panel`, `Chip` **where the markup matches**. Do not force a fit; a bespoke control stays bespoke and just moves onto the tokens.
6. Move that surface's `:root[data-density="compact"]` overrides onto the scale too, in this same task.
7. Delete this surface's entries from `UNSWEPT` in `styles.guard.test.ts`.
8. Run `pnpm --filter @termcoder/desktop typecheck`, `npx vitest run packages/desktop/src/renderer/styles.guard.test.ts`, and `pnpm test`.
9. **Look at it.** Launch with `env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev` — the variable must be stripped or no window opens on this machine. Check the surface in one dark theme and one light theme. Spacing changes that look right in dark and wrong in light are the specific failure this step exists to catch.
10. Commit.

The guard must not name the swept surface afterwards. It will still name the ones below it — that is the point.

### Task 4: Home

**Files:** `Hero.tsx`, `Welcome.tsx`, `styles.css` (`.hero`, `.welcome`), `styles.guard.test.ts`

- [ ] **Step 1** Apply the ten steps above to the `.hero` and `.welcome` rules and their components.
- [ ] **Step 2** Remove `".hero"` and `".welcome"` from `UNSWEPT`.
- [ ] **Step 3** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer/styles.guard.test.ts && pnpm test`
- [ ] **Step 4** Visual check, dark theme and light theme.
- [ ] **Step 5** `git add -A packages/desktop && git commit -m "feat(desktop): Home on the scale"`

### Task 5: Composer and chat

**Files:** `App.tsx`, `MessageParser.tsx`, `ToolCard.tsx`, `styles.css` (`.composer`, `.transcript`, `.bubble`, `.markdown`, `.tool`), `styles.guard.test.ts`

This is the densest surface and the one a user looks at longest. `:root[data-density="compact"]` overrides `.transcript-inner`, `.bubble.user` and `.composer` at styles.css:72-76 — those move onto the scale here.

- [ ] **Step 1** Apply the ten steps.
- [ ] **Step 2** Remove `".composer"`, `".transcript"`, `".bubble"`, `".markdown"`, `".tool"` from `UNSWEPT`.
- [ ] **Step 3** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer/styles.guard.test.ts && pnpm test`
- [ ] **Step 4** Visual check in both themes, **and** in compact density — this is the task most likely to break it.
- [ ] **Step 5** `git add -A packages/desktop && git commit -m "feat(desktop): composer and chat on the scale"`

### Task 6: Rail and sessions

**Files:** `Rail.tsx`, `SessionsPanel.tsx`, `ViewSwitcher.tsx`, `styles.css` (`.rail`, `.session`, `.srow`, `.switcher`), `styles.guard.test.ts`

`.srow` is the clearest `Row` candidate in the app; `.session-card` is a `Panel`. Both carry density overrides at styles.css:74-75.

- [ ] **Step 1** Apply the ten steps.
- [ ] **Step 2** Remove `".rail"`, `".session"`, `".srow"`, `".switcher"` from `UNSWEPT`.
- [ ] **Step 3** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer/styles.guard.test.ts && pnpm test`
- [ ] **Step 4** Visual check, both themes.
- [ ] **Step 5** `git add -A packages/desktop && git commit -m "feat(desktop): rail and sessions on the scale"`

### Task 7: Terminal

**Files:** `TerminalDeck.tsx`, `TerminalGrid.tsx`, `TerminalPane.tsx`, `styles.css` (`.xterm`, `.term`, `.deck`), `styles.guard.test.ts`

Careful here: xterm.js renders its own DOM and some values are dictated by the terminal's cell metrics, not by our design. Those are the legitimate `/* off-scale: xterm cell metric */` cases — do not force a cell dimension onto the spacing scale.

- [ ] **Step 1** Apply the ten steps.
- [ ] **Step 2** Remove `".xterm"`, `".term"`, `".deck"` from `UNSWEPT`.
- [ ] **Step 3** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer/styles.guard.test.ts && pnpm test`
- [ ] **Step 4** Visual check, both themes. Type a long line and confirm no reflow regression.
- [ ] **Step 5** `git add -A packages/desktop && git commit -m "feat(desktop): terminal chrome on the scale"`

### Task 8: Settings

**Files:** `Settings.tsx` (1,659 lines), `styles.css` (`.settings`, `.set-`, `.srow`), `styles.guard.test.ts`

The largest single component in the sweep. It is mostly rows and panels, so `Row` and `Panel` should carry a lot of it.

`.srow` belongs here, not to Task 6 — the plan originally listed it under the rail, but it appears only in `Settings.tsx`, `SidePanel.tsx` and `Study.tsx`. Task 6 verified this and left it in `UNSWEPT`. It is the row that defines the settings list, so it is swept here; Task 9 only consumes it. **`.srow` is the real `Row` candidate the plan was pointing at** — check its markup against `Row` before assuming it must stay bespoke.

- [ ] **Step 1** Apply the ten steps.
- [ ] **Step 2** Remove `".settings"`, `".set-"` and `".srow"` from `UNSWEPT`.
- [ ] **Step 3** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer/styles.guard.test.ts && pnpm test`
- [ ] **Step 4** Visual check, both themes. Open every settings section — this file has the most branches.
- [ ] **Step 5** `git add -A packages/desktop && git commit -m "feat(desktop): settings on the scale"`

### Task 9: Side panels

**Files:** `SidePanel.tsx`, `RecipesPanel.tsx`, `ClassroomPanel.tsx`, `ModelBrowser.tsx`, `Study.tsx`, `styles.css` (`.side`, `.recipe`, `.classroom`, `.model-`, `.study`), `styles.guard.test.ts`

`SidePanel.tsx` and `Study.tsx` also render `.srow`, but Task 8 owns and sweeps that rule. Do not re-sweep it here — only check that these two still look right against whatever Task 8 made of it.

**The five prefixes above do not describe this surface.** They were guessed before the components were read. `ClassroomPanel.tsx` renders `class-*`, not `.classroom`; `ModelBrowser.tsx` renders `mb-*`, not `.model-`. Together the five components render 86 distinct classes, and the declared prefixes cover 14 off-scale values while another 56 sit in classes nobody's task claims (`.mb-*`, `.class-*`, `.room-*`, `.tree-*`, `.recipe-form-*`, `.agents-panel`, `.view-all`, `.btn-2`, …). Sweep by **what these five components actually render**, not by the prefix list. A class shared with a surface outside these five belongs to its owner or to Task 11 — leave it and name it in the report.

- [ ] **Step 1** Apply the ten steps.
- [ ] **Step 2** Remove `".side"`, `".recipe"`, `".classroom"`, `".model-"`, `".study"` from `UNSWEPT`.
- [ ] **Step 3** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer/styles.guard.test.ts && pnpm test`
- [ ] **Step 4** Visual check, both themes.
- [ ] **Step 5** `git add -A packages/desktop && git commit -m "feat(desktop): side panels on the scale"`

### Task 10: Dialogs, palette, and IDELayout tokens

> **NOT DONE — and not runnable as written.** After Task 9 the guard reported 370 violations and **zero** of them matched this task's six prefixes, so Task 10 would sweep nothing measurable. The prefixes were guessed before the components were read, the same defect Tasks 6 and 9 hit. See "Where this stopped" at the end of this plan.

**Files:** `CommandPalette.tsx`, `FilePreview.tsx`, `IDELayout.tsx`, `styles.css` (`.palette`, `.preview`, `.ide-`, `.scm-`, `.editor-`, `.test-`), `styles.guard.test.ts`

`IDELayout.tsx` gets tokens **only**. Do not split it, do not restructure it, do not move a component out of it — project 2 rewrites this surface and any structural work here is thrown away.

The command palette and file preview are the app's two floating surfaces: they take `--sh-float` and `--sh-modal` respectively.

- [ ] **Step 1** Apply the ten steps, with the IDELayout restriction above.
- [ ] **Step 2** Remove `".palette"`, `".preview"`, `".ide-"`, `".scm-"`, `".editor-"`, `".test-"` from `UNSWEPT`.
- [ ] **Step 3** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer/styles.guard.test.ts && pnpm test`
- [ ] **Step 4** Visual check, both themes. Open the palette over a busy screen and confirm the float shadow reads on light.
- [ ] **Step 5** `git add -A packages/desktop && git commit -m "feat(desktop): dialogs, palette and IDE chrome on the scale"`

---

## Phase 3 — Close it

### Task 11: Empty the allowlist

> **NOT DONE.** The allowlist was not emptied; it was turned into the register of what is left (commit `3af45c7`). Emptying it would have meant sweeping 254 more selectors in one diff, which nobody could review. See "Where this stopped".

**Files:** Modify `packages/desktop/src/renderer/styles.guard.test.ts`

- [ ] **Step 1: Empty it**

```ts
// Empty, and it stays empty: every selector in styles.css is now on the scale.
// An off-scale value is still permitted, but only with a written reason —
// `/* off-scale: <reason> */` on the same line.
const UNSWEPT: string[] = [];
```

- [ ] **Step 2: Run the guard over the whole file**

```bash
npx vitest run packages/desktop/src/renderer/styles.guard.test.ts
```

Expected: PASS, with an empty allowlist. That is the definition of done.

If it fails, a surface was missed. The failure names the line and selector — go back and sweep it rather than re-adding it to the allowlist.

- [ ] **Step 3: Count what the sweep achieved**

```bash
cd packages/desktop/src/renderer
echo "px values:"; grep -oE "[0-9]+px" styles.css | sort -u | wc -l
echo "font sizes:"; grep -oE "font-size: *[0-9.]+(px|rem)" styles.css | sort -u | wc -l
echo "shadows:";    grep -oE "box-shadow: *[^;]+" styles.css | sort -u | wc -l
echo "off-scale exemptions:"; grep -c "off-scale:" styles.css
```

Record all four in the commit message. The starting numbers were 84 pixel values, 18 font sizes and 36 shadows. Every exemption should have a reason a reader would accept.

- [ ] **Step 4: Full verification**

```bash
pnpm --filter @termcoder/desktop typecheck
pnpm test
```

Expected: typecheck clean; `pnpm test` shows no new failures against the Task 1 baseline.

- [ ] **Step 5: Final visual pass**

Launch with `env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev` and walk every surface in **one light theme, one dark theme, and compact density**. This is the last chance to catch a spacing collapse that reads wrong in a configuration the per-task checks happened to skip.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/renderer/styles.guard.test.ts
git commit -m "feat(desktop): close the style guard over the whole stylesheet"
```

---

## Not in this plan

- Restructuring `IDELayout.tsx` or `App.tsx`. Project 2 rewrites the workspace; splitting them now is wasted.
- Any colour change, any new theme, any change to `data-density` or `data-motion` semantics.
- `Field`, `Toolbar` or `Dialog` primitives. Project 2 will show whether they earn their place.
- Copying any code from Synara. This project takes the standard, not the source; a later project that lifts a module of theirs must carry the T3 Tools copyright notice with it.

---

## Where this stopped

Tasks 1 through 9 shipped. Tasks 10 and 11 did not, and the reason is worth
keeping: the plan's selector prefixes were guessed before the components were
read, and by Task 10 that guess had run out.

**What is on the scale:** Home, the composer and chat transcript, the rail and
sessions list, the terminal chrome, Settings, and the side panels — the six
surfaces a user actually looks at.

**What is not:** 254 selectors, now listed exactly in `UNSWEPT` in
`styles.guard.test.ts`. That array is no longer a sweep-in-progress list; it is
the register of the debt. Delete a family from it, sweep that family, and the
guard names the first value you miss. By size: room 27, agent canvas 24,
search 20, file tree 17, git 15, inline editor 14, chip 13, task runner 11,
debugger 11, quick open 10, then a long tail.

**Three findings that outlived the plan:**

1. **The guard was blind for its first eight tasks.** Every pattern was anchored
   to the start of a line, so in a rule written on one line only the first
   declaration was checked — and nearly every rule in this file is written on
   one line. It reported 152 violations while 267 more hid past the first
   semicolon. Fixed in `638f410`. The sweeps themselves held up: under the
   corrected guard, exactly one value in Tasks 4-8's surfaces was off-scale.

2. **The prefix lists did not describe the surfaces.** `.srow` was listed under
   the rail and lives in Settings. `.classroom` matched no selector in the file
   at all — `ClassroomPanel` renders `class-*`. `.model-` reaches Settings' model
   picker, not `ModelBrowser`. Task 10's six prefixes matched nothing left.
   A future sweep should start from what a component renders, not from a name.

3. **The four primitives are dead code.** `Btn`, `Row`, `Panel` and `Chip` were
   built in Task 3 with complete CSS and focus rings. Six sweep tasks in a row
   examined their controls and refused them, each with a concrete reason, and no
   file in the renderer imports from `./ui`. The blocker is small and specific:
   `Row` and `Panel` render a `<div>` and so cannot replace a `<button>`, and
   `Btn` has no tone matching `.settings-btn.primary`'s `var(--text)` fill.
   Task 8 found that `.settings-nav button` is declaration-for-declaration
   identical to `.u-row` after its sweep. An `as` prop and one tone would make
   that conversion mechanical, and would decide whether the primitives earn
   their place or should be deleted. **This was left undone deliberately** —
   converting the app's settings navigation with no way to look at the result
   is the wrong risk to take at closing time.

**Nothing here was seen running.** Electron has no display in the environment
these tasks ran in; it starts and dies without a window. Every "visual check"
step in Phase 2 was reasoned, not seen. Light theme and compact density are
where a regression would be hiding.
