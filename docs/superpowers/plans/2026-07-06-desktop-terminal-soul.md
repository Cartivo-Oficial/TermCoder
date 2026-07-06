# Desktop Terminal Soul Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The desktop stops looking like OpenCode: warm Ember tokens + brand-orange accent, monospace chrome, and three signatures (prompt spine, hero empty state, branded titlebar) — with zero structural/behavioral change.

**Architecture:** ~90% CSS-token and theme-data work (`styles.css`, `themes.ts`), plus a new `Hero.tsx` (wordmark + starfield), a `❯` span in the composer, eyebrow classes on existing labels, and a rebrand of the existing draggable toolbar. The theme applier computes `--accent-dim` from each theme's accent.

**Tech Stack:** Electron + React, plain CSS custom properties, no new dependencies, no webfonts (system mono stack).

## Global Constraints

- **Comment-free code** (user rule). No new runtime dependencies. Never edit via PowerShell (accented i18n strings exist in touched files).
- **No structural/behavioral change:** layout regions, flows, i18n keys, shortcuts all survive. This is a reskin.
- Exact brand values: accent `#FF7A45`; Ember tokens per the spec table; Paper light accent `#E8632C`; `--accent-dim` = accent at 14% alpha.
- Mono stack: `ui-monospace, "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace`.
- Starfield honors `prefers-reduced-motion` (static). Contrast: body text pairs ≥ 4.5:1; accent used for glyphs/borders/short labels only.
- Old default look stays selectable as theme id `mono`; new default id stays `"default"` named **Ember**.
- Verification is a clean `npx tsc --noEmit` (desktop has no unit tests) + `pnpm --filter @termcoder/desktop build` + launching the real app.
- **No version bump, no push** — bundle ships later; hold push for the final review.

---

### Task 1: Ember tokens + theme data

**Files:**
- Modify: `packages/desktop/src/renderer/styles.css:1-19` (the `:root` block)
- Modify: `packages/desktop/src/renderer/themes.ts`
- Modify: the theme applier (find with `grep -n "THEME_VARS" packages/desktop/src/renderer/*.tsx` — the code that writes theme `vars` onto `document.documentElement.style`)

**Interfaces:**
- Produces: CSS vars `--accent-dim`, `--mono` available app-wide; `COLOR_THEMES` with Ember default + `mono` legacy; applier sets `--accent` AND a derived `--accent-dim` for every theme.

- [ ] **Step 1: Replace the `:root` token block** in `styles.css` with:

```css
:root {
  --bg: #0C0B0A;
  --panel: #100F0D;
  --panel2: #0E0D0B;
  --elev: #1A1816;
  --elev2: #232019;
  --border: #232019;
  --text: #ECEAE6;
  --muted: #948F86;
  --faint: #5C5850;
  --ok: #6fb892;
  --warn: #d3aa66;
  --bad: #e08c8c;
  --accent: #FF7A45;
  --accent-dim: rgba(255, 122, 69, 0.14);
  --mono: ui-monospace, "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace;
  --radius: 10px;
  --ease: cubic-bezier(0.2, 0, 0, 1);
}
```

(The two comment lines currently inside the block are removed with it.)

- [ ] **Step 2: Theme data.** In `themes.ts`:
  - Change the first entry to `{ id: "default", name: "Ember", dark: true, accent: "#FF7A45", vars: {} }`.
  - Insert right after it the legacy look:

```ts
  {
    id: "mono",
    name: "Mono",
    dark: true,
    accent: "#e6e6e7",
    vars: { "--bg": "#0b0b0c", "--panel": "#0e0e0f", "--panel2": "#0c0c0d", "--elev": "#161617", "--elev2": "#1d1d1f", "--border": "#1c1c1f", "--text": "#e6e6e7", "--muted": "#8a8a90", "--faint": "#57575d" },
  },
```

  - Change `paper`'s `accent` to `"#E8632C"` (its `vars` unchanged).

- [ ] **Step 3: Derived accent-dim in the applier.** Where the theme is applied (it sets `--accent` from `theme.accent` and each of `THEME_VARS` from `theme.vars`), add a helper and one line:

```ts
function accentDim(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}
```

and set `--accent-dim` to `accentDim(theme.accent)` wherever `--accent` is set. When the theme is `default` (Ember), the `:root` fallback already matches. Also ensure switching AWAY from a non-default theme resets `THEME_VARS` it doesn't override (the applier already handles this for existing vars — keep that behavior; `--accent-dim` is always set explicitly so it needs no reset logic).

- [ ] **Step 4: Verify + commit**

Run: `cd packages/desktop && npx tsc --noEmit` (clean) and `pnpm --filter @termcoder/desktop build` (succeeds).

```bash
git add packages/desktop/src/renderer/styles.css packages/desktop/src/renderer/themes.ts packages/desktop/src/renderer/App.tsx
git commit -m "feat(desktop): Ember tokens + theme data (Mono kept as legacy)"
```

(If the applier lives in a file other than App.tsx, stage that file instead.)

---

### Task 2: Mono chrome + eyebrows

**Files:**
- Modify: `packages/desktop/src/renderer/styles.css`
- Modify: `packages/desktop/src/renderer/App.tsx`, `packages/desktop/src/renderer/Settings.tsx` (class additions on existing label elements only)

**Interfaces:**
- Produces: `.eyebrow` CSS class; chrome text (badges, chips, tabs, timestamps, status strip, section headers) renders in `--mono`.

- [ ] **Step 1: Add the eyebrow class** to `styles.css`:

```css
.eyebrow {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
}
.eyebrow::before { content: "// "; color: var(--accent); opacity: 0.7; }
```

- [ ] **Step 2: Mono the existing chrome selectors.** In `styles.css`, add `font-family: var(--mono);` (and where noted, a size bump-down to 11–12px if currently larger) to these existing rules — locate each with grep; if a listed selector does not exist, skip it and note it in the report:
  - `.badge`
  - the model chip / agent chip in the chat head (grep `chip` in styles.css)
  - tab labels in Settings nav (grep the Settings nav class, e.g. `.snav` or `.settings-nav`)
  - message timestamps (grep `time` classes)
  - the toolbar title text (Task 4 restyles the toolbar fully; here only ensure its text uses `--mono`)
  - `.upgrade-card b` stays sans (body copy) — do NOT mono conversation/body text.

- [ ] **Step 3: Apply `.eyebrow` to section headers.** In `App.tsx`: the sidebar headings (the "Sessions" label above the session list and any sibling section labels — grep `t("nav.sessions")` or the heading elements in the `<aside>`) get `className="eyebrow"` added (keep existing classes: `className="existing eyebrow"`). In `Settings.tsx`: the section titles inside tab panels (grep the heading elements, e.g. `<h3>` / `.stitle`) get the same. Do not change any text content — the `//` prefix comes from CSS.

- [ ] **Step 4: Verify + commit**

Run: `cd packages/desktop && npx tsc --noEmit`

```bash
git add packages/desktop/src/renderer/styles.css packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/Settings.tsx
git commit -m "feat(desktop): mono chrome + eyebrow section headers"
```

---

### Task 3: Prompt spine + hero empty state

**Files:**
- Create: `packages/desktop/src/renderer/Hero.tsx`
- Modify: `packages/desktop/src/renderer/App.tsx:1666` (empty state) and `:1826` (composer)
- Modify: `packages/desktop/src/renderer/styles.css` (`.composer`, `.empty`, new `.hero-*`/`.stars` rules)

**Interfaces:**
- Produces: `<Hero />` (no props) — block wordmark + starfield; a `.prompt-glyph` span inside the composer.

- [ ] **Step 1: Hero component** (`Hero.tsx`) — the same art as the website hero:

```tsx
import { useMemo } from "react";

const TERM = `█████ █████ ████  █   █
  █   █     █   █ ██ ██
  █   ████  ████  █ █ █
  █   █     █  █  █   █
  █   █████ █   █ █   █`;

const CODER = ` ████  ███  ████  █████ ████
█     █   █ █   █ █     █   █
█     █   █ █   █ ████  ████
█     █   █ █   █ █     █  █
 ████  ███  ████  █████ █   █`;

const GLYPHS = ["·", "+", "✦", "*"];

export function Hero() {
  const stars = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        glyph: GLYPHS[i % GLYPHS.length]!,
        left: `${Math.random() * 96}%`,
        top: `${Math.random() * 90}%`,
        delay: `${Math.random() * 3.2}s`,
      })),
    [],
  );
  return (
    <div className="hero">
      <div className="stars" aria-hidden="true">
        {stars.map((s) => (
          <b key={s.id} style={{ left: s.left, top: s.top, animationDelay: s.delay }}>{s.glyph}</b>
        ))}
      </div>
      <div className="hero-art" aria-hidden="true">
        <pre className="hero-t">{TERM}</pre>
        <pre className="hero-c">{CODER}</pre>
      </div>
      <div className="hero-tag">your terminal coding agent</div>
    </div>
  );
}
```

- [ ] **Step 2: Hero styles** — append to `styles.css`:

```css
.hero { position: relative; padding: 26px 12px 6px; overflow: hidden; }
.stars { position: absolute; inset: 0; pointer-events: none; }
.stars b {
  position: absolute;
  color: var(--elev2);
  font-family: var(--mono);
  font-size: 12px;
  animation: tw 3.2s ease-in-out infinite;
}
@keyframes tw { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.85; } }
@media (prefers-reduced-motion: reduce) { .stars b { animation: none; } }
.hero-art { display: flex; justify-content: center; gap: 11px; position: relative; }
.hero-art pre { margin: 0; font-family: var(--mono); font-size: 9px; line-height: 1.05; }
.hero-t { color: var(--accent); }
.hero-c { color: var(--text); }
.hero-tag { text-align: center; font-family: var(--mono); font-size: 12px; color: var(--muted); margin-top: 14px; }
```

- [ ] **Step 3: Mount it.** In `App.tsx`, import `{ Hero } from "./Hero";` and inside the empty state (`<div className="empty">` at ~1666), render `<Hero />` as the FIRST child, replacing the current plain `{t("chat.empty")}` text div (the free-hint button and upgrade card stay beneath it). Keep `t("chat.empty")` as the hero's sibling only if it adds information; otherwise drop that one text node (the tagline replaces it visually — i18n key stays defined, unused keys are harmless).

- [ ] **Step 4: Prompt spine.** In `App.tsx` at the composer (`className="composer"`, ~1826), add as the first child inside the composer container: `<span className="prompt-glyph" aria-hidden="true">❯</span>`. In `styles.css` extend:

```css
.composer { position: relative; }
.prompt-glyph {
  font-family: var(--mono);
  color: var(--accent);
  align-self: center;
  padding-left: 10px;
  user-select: none;
}
.composer:focus-within { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
```

(The composer is a flex row hosting the textarea — confirm and, if it isn't `display:flex`, wrap glyph+textarea placement accordingly so the textarea keeps its full behavior. If `color-mix` complicates, use `rgba(255,122,69,.4)` — but prefer `color-mix` so non-Ember themes follow their accent.)

- [ ] **Step 5: Verify + commit**

Run: `cd packages/desktop && npx tsc --noEmit`

```bash
git add packages/desktop/src/renderer/Hero.tsx packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): hero empty state + composer prompt spine"
```

---

### Task 4: Branded titlebar (rebrand of the existing toolbar)

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx` (~1505-1520 — the existing toolbar with `.win-btn` minimize/maximize)
- Modify: `packages/desktop/src/renderer/styles.css` (`.toolbar` at ~line 75)
- Possibly modify: `packages/desktop/src/preload/index.ts` + `packages/desktop/src/main/index.ts` (ONLY if a close control is missing)

**Interfaces:**
- Consumes: existing `window.api.minimize/maximize` (preload `window-minimize`/`window-maximize`).
- Produces: a 36px branded titlebar: Logo + mono lowercase `termcoder` at left; min/max/close at right; drag region preserved.

- [ ] **Step 1: Audit the existing controls.** `grep -n "win-btn\|window-close\|close" packages/desktop/src/renderer/App.tsx packages/desktop/src/preload/index.ts packages/desktop/src/main/index.ts`. If a close button/IPC already exists, skip Step 2.

- [ ] **Step 2 (only if missing): add close.** Preload: `close: () => ipcRenderer.send("window-close"),` next to minimize/maximize. Main (`src/main/index.ts`, near the other `ipcMain.on` handlers): `ipcMain.on("window-close", () => { mainWindow?.close(); });` (mirror how window-minimize is handled — if minimize/maximize handlers are missing in main too, add all three the same way). Renderer: a third `.win-btn` with an × icon (reuse the icon set in `Icons.tsx`; if no close icon exists, inline a 10px `<svg><path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor"/></svg>`). Type the new `close` in App.tsx's `window.api` declaration (~line 54).

- [ ] **Step 3: Brand the left side.** In the toolbar JSX, ensure the leftmost content is: `<Logo />` (already imported or import from `./Logo`) followed by `<span className="tb-title">termcoder</span>`. Style:

```css
.tb-title { font-family: var(--mono); font-size: 12px; color: var(--muted); letter-spacing: 0.02em; }
.toolbar { height: 36px; background: var(--panel); border-bottom: 1px solid var(--border); }
.toolbar .win-btn:hover { background: var(--accent-dim); color: var(--text); }
```

(Merge with the existing `.toolbar` rule at ~line 75 — keep its drag-region declarations exactly as they are.)

- [ ] **Step 4: Verify + commit**

Run: `cd packages/desktop && npx tsc --noEmit`

```bash
git add packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/styles.css packages/desktop/src/preload/index.ts packages/desktop/src/main/index.ts
git commit -m "feat(desktop): branded titlebar with window controls"
```

---

### Task 5: Welcome recolor, sweep, live launch

**Files:**
- Modify: `packages/desktop/src/renderer/Welcome.tsx` + `styles.css` (`.welcome-*` rules)
- Modify: anything the sweep catches (chips/badges that missed `--mono`, hardcoded old grays)

- [ ] **Step 1: Welcome recolor.** In the `.welcome-*` CSS: any hardcoded oranges align to `#FF7A45` (grep `#ff7a45|#fb923c|orange` in styles.css/Welcome.tsx); the Code/Study card accents keep their blue/orange split but the orange one uses the brand value; headings inside Welcome get `.eyebrow` where they are labels (not body copy).

- [ ] **Step 2: Hardcoded-gray sweep.** `grep -n "#0b0b0c\|#0e0e0f\|#161617\|#1d1d1f\|#1c1c1f\|#e6e6e7\|#8a8a90\|#57575d" packages/desktop/src/renderer/*.tsx packages/desktop/src/renderer/*.css` — replace stragglers with the matching var (except inside `themes.ts`'s `mono` legacy entry, which must keep them).

- [ ] **Step 3: Full verify**

```bash
cd packages/desktop && npx tsc --noEmit
pnpm --filter @termcoder/desktop build
pnpm -r typecheck && npx vitest run
```
Expected: clean, build ok, 263 tests still green (no core/server/tui files touched — confirm with `git status`).

- [ ] **Step 4: Live launch** (the known Electron launch quirk: strip `ELECTRON_RUN_AS_NODE`):

```bash
env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev
```
Run in the background; confirm the window opens with the Ember look (no renderer console errors in the dev output), then leave it open for the user to inspect: hero + starfield on the empty state, `❯` in the composer, mono chrome, branded titlebar, theme picker showing Ember (default) + Mono (legacy) + Paper with the darker ember accent.

- [ ] **Step 5: Commit (no push — final review first)**

```bash
git add -A
git commit -m "feat(desktop): Terminal Soul reskin — ember, mono chrome, hero, titlebar"
```
