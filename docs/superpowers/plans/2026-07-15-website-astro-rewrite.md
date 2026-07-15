# Website Astro Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-author the live static website (`website/`, 12 hand-written HTML pages) as an Astro + Tailwind v4 project (`site/`) with React islands, a refined-but-familiar dark/mono/terminal identity, and a new changelog page generated from `CHANGELOG.md` — preserving every public URL and the OAuth flow, switching the GitHub Pages deploy only at parity.

**Architecture:** New standalone Astro project at repo-root `site/` (outside the `packages/*` pnpm workspace, so it never touches package CI/releases). `build.format: 'file'` preserves `*.html` URLs. OAuth files (`auth.js`, `config.js`, `callback.html`) are copied verbatim into `public/` so the redirect contract is byte-identical. Three small React islands cover the only interactivity (hero replay, copy button, OS detection). The current `website/` keeps deploying until Phase E flips `pages.yml`.

**Tech Stack:** Astro 5 (static), Tailwind v4 via `@tailwindcss/vite`, `@astrojs/react` + React 18, Node 20. Deployed to GitHub Pages via a Node build step.

## Global Constraints

- **No changes** to `packages/*`, `pnpm-workspace.yaml`, package CI (`ci.yml`, `release.yml`, `termcoder.yml`), or the release pipeline. `site/` is not a pnpm workspace member.
- **Do not touch** `website/` until Phase E. It stays live throughout A–D.
- **Preserve URLs:** `build.format: 'file'` → `features.astro` emits `features.html`. Every current URL (`/index.html`, `/features.html`, `/callback.html`, …) must still resolve.
- **OAuth is not rewritten.** `auth.js`, `config.js`, `callback.html` are copied byte-for-byte into `site/public/`. Do not edit them. The Cloudflare Worker (`website/auth/`) is untouched.
- **Identity:** dark, mono-forward, `--accent #ff7a45`, hairline borders, no gradients/heavy shadows. Build on the current `.sys-*` spec-sheet language (numbered gutters, `//` mono eyebrows, `LIVE` tags, terminal-window hero). "Refine" = unify + tighten scale/spacing/motion, not a new palette.
- **Site invariants** (enforced by `verify.mjs` in Phase E): no emoji in markup, no version strings pinned outside `<code>/<pre>` (link `releases/latest`), any subscription mention labelled "experimental", `hero-session.js` keeps its `window.HERO_SESSION` + `recorded` provenance, required assets present.
- All commands run from the worktree root: `C:/Users/Purple/Downloads/Open Source/.claude/worktrees/website-astro-rewrite`. The Astro project lives in `site/`.
- Verification of each page is a build + Browser-pane parity check against the current live page (the controller runs these), plus `npm run build` succeeding. There is no unit-test runner for the site; the changelog parser (Phase C) is the one piece with a vitest test.

---

## File Structure

```
site/
  package.json  package-lock.json  astro.config.mjs  tsconfig.json
  src/
    styles/global.css              # @import "tailwindcss"; @theme tokens; @layer components (ported .sys-*)
    layouts/Layout.astro           # <head> meta slot + Nav + <slot/> + Footer
    components/
      Nav.astro  Footer.astro
      Hero.astro                   # terminal window markup; <TermReplay client:idle/>
      SpecSection.astro            # <section class="sys-sec2"> + gutter + split wrapper
      CommandBox.astro             # command line; <CopyButton client:visible/>
      react/TermReplay.tsx  react/CopyButton.tsx  react/DownloadCards.tsx
      ChangelogTimeline.astro
    data/changelog.ts              # parse ../../CHANGELOG.md → versions[]
    data/changelog.test.ts         # vitest for the parser
    pages/
      index.astro features.astro study.astro install.astro download.astro
      docs.astro viewer.astro pricing.astro changelog.astro
      login.astro dashboard.astro
  public/
    callback.html auth.js config.js               # verbatim from website/
    favicon.png mark.png app.png logo.png hero-session.js
    fonts/…
  worker/                          # copy of website/auth/ (reference; not served)
  tools/verify.mjs                 # Phase E: validate site/dist
```

Page-content source of truth during migration: the existing `website/<page>.html`. Each port reproduces that page's content using the new components at visual parity.

---

## Phase A — Foundation + index at parity

### Task A1: Scaffold `site/` with Astro + Tailwind v4 + React, design tokens, Layout/Nav/Footer

**Files:**
- Create: `site/` (via scaffold), `site/astro.config.mjs`, `site/src/styles/global.css`, `site/src/layouts/Layout.astro`, `site/src/components/Nav.astro`, `site/src/components/Footer.astro`, `site/src/pages/index.astro` (placeholder)
- Add to repo `.gitignore`: `site/node_modules`, `site/dist`, `site/.astro`

**Interfaces:**
- Produces: a building Astro project. `Layout.astro` accepts props `{ title: string; description: string; active?: string }` and renders `<head>` meta + `<Nav active={active}/>` + `<slot/>` + `<Footer/>`. `Nav` highlights the link whose key matches `active`.

- [ ] **Step 1: Scaffold the Astro project**

Run (non-interactive):
```bash
cd "C:/Users/Purple/Downloads/Open Source/.claude/worktrees/website-astro-rewrite"
npm create astro@latest site -- --template minimal --no-install --no-git --skip-houston --typescript strict
cd site
npm install
npx astro add react --yes
npx astro add tailwind --yes
```
Expected: `site/` created; `@astrojs/react`, `react`, `react-dom`, `@tailwindcss/vite`, `tailwindcss` installed; `astro.config.mjs` has the react integration and the tailwind Vite plugin.

- [ ] **Step 2: Configure `astro.config.mjs` for file-format output**

Ensure `site/astro.config.mjs` reads (merge with what `astro add` wrote — keep the vite tailwind plugin and react integration):
```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  build: { format: "file" },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
```

- [ ] **Step 3: Design tokens + base + component layer in `global.css`**

Create `site/src/styles/global.css`. Import Tailwind, define the tokens as a `@theme`, add base styles, and port the current `.sys-*` component rules from `website/style.css` into an `@layer components` block (read `website/style.css` and bring over `.sys-nav .in-row .mark-cell .brand-mark .wordmark .links`, `.sys-sec2 .gutter .split .t .a .full`, `.mono-eyebrow .slash`, `.num-head .nn .lbl .live`, `.eyebrow-2`, `.lead`, `.cmd-2 .in .copy2`, `.btn-2 .go .row-2`, `.term-2 .bar .body-2 .foot-2 .out .tline .p .tk`, `.reqs .no .yes .x`, `.dlgrid .dlcol .dlrow .ext .dl-note`, `.sys-foot`, and the rest used by the pages). Refine as you port: unify spacing to a consistent scale, keep the palette. Start with:
```css
@import "tailwindcss";

@theme {
  --color-bg: #0b0b0c;
  --color-panel: #0f0f11;
  --color-line: #232327;
  --color-fg: #e7e7ea;
  --color-muted: #9a9aa3;
  --color-faint: #5c5c64;
  --color-accent: #ff7a45;
  --font-mono: ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, Consolas, monospace;
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

@layer base {
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--color-bg); color: var(--color-fg);
    font-family: var(--font-sans); line-height: 1.65; font-size: 16px; -webkit-font-smoothing: antialiased; }
  a { color: inherit; text-decoration: none; }
}

@layer components {
  /* Port .sys-* rules from website/style.css here, refined. */
}
```

- [ ] **Step 4: `Nav.astro` and `Footer.astro`**

Create `site/src/components/Nav.astro` reproducing the current `.sys-nav` markup (from any current page's header) as a component, with an `active` prop:
```astro
---
const { active = "" } = Astro.props;
const links = [
  ["index.html", "Home"], ["features.html", "Features"], ["study.html", "Study"],
  ["install.html", "Install"], ["download.html", "Download"], ["pricing.html", "Pricing"],
  ["changelog.html", "Changelog"], ["docs.html", "Docs"], ["login.html", "Sign in"],
];
---
<header class="sys-nav">
  <div class="in-row">
    <div class="mark-cell"><span class="brand-mark" aria-hidden="true"></span></div>
    <div class="row">
      <a class="wordmark" href="index.html">TERMCODER</a>
      <nav class="links">
        {links.map(([href, label]) => (
          <a href={href} class={active === href ? "on" : ""}>{label}</a>
        ))}
        <a href="https://github.com/Cartivo-Oficial/TermCoder" target="_blank" rel="noopener">GitHub</a>
      </nav>
    </div>
  </div>
</header>
```
Create `Footer.astro` reproducing the current `.sys-foot` markup (from `website/download.html` lines 90-99), as a static component (no props).

- [ ] **Step 5: `Layout.astro`**

Create `site/src/layouts/Layout.astro`:
```astro
---
import "../styles/global.css";
import Nav from "../components/Nav.astro";
import Footer from "../components/Footer.astro";
const { title, description, active = "" } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/png" href="favicon.png" />
    <title>{title}</title>
    <meta name="description" content={description} />
  </head>
  <body class="sys">
    <Nav active={active} />
    <main><slot /></main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 6: Placeholder `index.astro` + build**

Replace `site/src/pages/index.astro` with a minimal page using the layout:
```astro
---
import Layout from "../layouts/Layout.astro";
---
<Layout title="TermCoder" description="The open source AI coding agent for your terminal." active="index.html">
  <section class="sys-sec2"><div class="split"><div class="t full"><h1>TermCoder</h1></div></div></section>
</Layout>
```
Run: `cd site && npm run build`
Expected: build succeeds; `site/dist/index.html` exists and links the bundled CSS.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/Purple/Downloads/Open Source/.claude/worktrees/website-astro-rewrite"
git add site .gitignore
git commit -m "feat(site): scaffold Astro + Tailwind v4 + React, design tokens, Layout/Nav/Footer"
```

### Task A2: Assets + Hero replay island + full index parity

**Files:**
- Create: `site/public/{favicon.png,mark.png,app.png,logo.png,hero-session.js}`, `site/public/fonts/*`, `site/src/components/Hero.astro`, `site/src/components/react/TermReplay.tsx`, `site/src/components/SpecSection.astro`, `site/src/components/CommandBox.astro`, `site/src/components/react/CopyButton.tsx`
- Modify: `site/src/pages/index.astro` (full port)

**Interfaces:**
- Consumes: `Layout` from A1.
- Produces: `Hero.astro` (renders the terminal window and mounts `<TermReplay client:idle/>`); `SpecSection.astro` (props `{ gutter?: string }`, wraps `<section class="sys-sec2"><div class="gutter">{gutter}</div><div class="split"><slot/></div></section>`); `CommandBox.astro` (props `{ cmd: string }`, renders the `.cmd-2` line + `<CopyButton client:visible text={cmd}/>`).

- [ ] **Step 1: Copy assets into `public/`**

Copy from `website/` to `site/public/`: `favicon.png`, `mark.png` (if present; else copy `logo.png`), `app.png`, `logo.png`, `hero-session.js`, and the `fonts/` dir. Verify `hero-session.js` still assigns `window.HERO_SESSION` with its `recorded` field (do not edit it).
```bash
cd "C:/Users/Purple/Downloads/Open Source/.claude/worktrees/website-astro-rewrite"
mkdir -p site/public/fonts
cp website/favicon.png website/app.png website/logo.png website/hero-session.js site/public/ 2>/dev/null || true
cp website/mark.png site/public/ 2>/dev/null || true
cp -r website/fonts/* site/public/fonts/ 2>/dev/null || true
```
(If `mark.png` does not exist in `website/`, the Nav's `.brand-mark` is CSS-driven — confirm from `website/style.css` how `.brand-mark` renders and reproduce it; do not invent an image.)

- [ ] **Step 2: `TermReplay.tsx` island (port of `hero.js`)**

Create `site/src/components/react/TermReplay.tsx` — a React port of `website/hero.js` that reads `window.HERO_SESSION`, renders each line (`prompt` with `❯`, `tool` with `✓`, `text` plain), types prompt lines char-by-char, and renders all lines immediately when `prefers-reduced-motion: reduce`. Use `useEffect` + `useRef` on a `<div class="body-2">`; guard against `window.HERO_SESSION` being undefined. Keep the timings from `hero.js` (32ms/char, 420ms between non-prompt lines, 520ms after a prompt). The component renders `<div class="body-2" ref={...} />` and does the DOM building in the effect (matching `hero.js`), or builds React nodes into state — either is fine as long as the output markup matches `.tline`/`.p`/`.tk` classes.

- [ ] **Step 3: `Hero.astro`**

Create `site/src/components/Hero.astro` reproducing the hero markup from `website/index.html` lines 36-62 (the `.sys-sec2` `00` gutter, the `.split` with the text column — eyebrow, `<h1>`, lead, `<CommandBox cmd="npm install -g @termcoder/tui"/>`, the two buttons — and the `.a` column with the `.term-2` window whose `.body-2` is `<TermReplay client:idle/>`). Load `hero-session.js` before the island with `<script is:inline src="/hero-session.js"></script>` in the hero (or in the page head) so `window.HERO_SESSION` exists when the island hydrates.

- [ ] **Step 4: `SpecSection.astro` + `CommandBox.astro` + `CopyButton.tsx`**

Create `SpecSection.astro` (wrapper described in Interfaces). Create `CopyButton.tsx` — a React button that copies `props.text` via `navigator.clipboard.writeText`, showing "Copied" for ~1.2s (port of the current `copyCmd()` behavior). Create `CommandBox.astro` rendering the `.cmd-2` markup with `<CopyButton client:visible text={cmd} />`.

- [ ] **Step 5: Port `index.astro` to full parity**

Rewrite `site/src/pages/index.astro` to reproduce all of `website/index.html`'s sections (hero via `<Hero/>`, the thesis section, and the numbered spec sections `01`…) using `SpecSection`, `CommandBox`, and plain markup ported from the source. Keep the copy verbatim. Refine spacing/rhythm per the identity goal, but do not change the content or the section order.

- [ ] **Step 6: Build**

Run: `cd site && npm run build`
Expected: build succeeds; `site/dist/index.html` present with the hero markup and the island script tags. No console/build errors.

- [ ] **Step 7: Commit**

```bash
git add site
git commit -m "feat(site): assets, hero replay island, and full index parity"
```

> **Controller parity gate (A2):** serve `site/dist` locally and compare `index.html` against the live `website/index.html` in the Browser pane (structure + hero replay + buttons). Note any deliberate refinements.

---

## Phase B — Marketing pages

### Task B1: Shared primitives + features + study

**Files:**
- Create: `site/src/components/FeatureRow.astro`, `Steps.astro`, `Cta.astro`
- Create: `site/src/pages/features.astro`, `site/src/pages/study.astro`

**Interfaces:**
- Consumes: `Layout`, `SpecSection`, `CommandBox` (Phase A).
- Produces: `FeatureRow.astro` (props `{ k: string }` slot for body — the `.frow`/`.num-head` pattern), `Steps.astro` (renders a `.steps` wrapper around slotted `.step`s), `Cta.astro` (the `.cta`/CTA band). Reuse these across pages B2/B3.

- [ ] **Step 1:** Read `website/features.html` and `website/study.html`. Extract the recurring row/step/cta patterns into `FeatureRow.astro`, `Steps.astro`, `Cta.astro` (port the exact classes/markup from `website/style.css` + the pages).
- [ ] **Step 2:** Create `features.astro` and `study.astro` using `Layout` (with the correct `active=` key), `SpecSection`, and the new primitives, reproducing each page's content verbatim.
- [ ] **Step 3:** `cd site && npm run build` — expected: `features.html` and `study.html` emitted, build clean.
- [ ] **Step 4:** Commit: `git add site && git commit -m "feat(site): shared primitives + features + study pages"`

> **Controller parity gate (B1):** Browser-pane compare `features.html` and `study.html` vs the live pages.

### Task B2: install + download (OS-detection island)

**Files:**
- Create: `site/src/components/react/DownloadCards.tsx`, `site/src/pages/install.astro`, `site/src/pages/download.astro`

**Interfaces:**
- Consumes: `Layout`, `SpecSection`, `Steps` (B1).
- Produces: `DownloadCards.tsx` — a React island porting the OS-detection `<script>` from `website/download.html` lines 101-113: from `navigator.platform`/`userAgent` pick `{ os, primaryAsset }`, set the primary Download button href to `releases/latest/download/<asset>` and the "your system" text. Renders the primary button + the `.dlgrid` of all installers (verbatim links from `website/download.html`).

- [ ] **Step 1:** Create `DownloadCards.tsx` with the exact asset names and detection logic from `website/download.html` (Windows `TermCoder-Setup.exe`, mac `TermCoder-arm64.dmg`, linux `TermCoder-x86_64.AppImage`; full grid links as in the source). Base URL `https://github.com/Cartivo-Oficial/TermCoder/releases/latest/download/`.
- [ ] **Step 2:** Create `install.astro` (port `website/install.html` — the 5-step guided install, using `Steps`/`SpecSection`) and `download.astro` (port `website/download.html`, mounting `<DownloadCards client:load/>` for the top section; the static grid can live inside the island or beside it — keep all real installer URLs).
- [ ] **Step 3:** `cd site && npm run build` — clean; `install.html`/`download.html` emitted.
- [ ] **Step 4:** Commit: `git add site && git commit -m "feat(site): install + download pages with OS-detection island"`

> **Controller parity gate (B2):** Browser-pane compare; confirm the download button's href updates to the detected OS asset and the grid links match the live page.

### Task B3: docs + viewer + pricing

**Files:**
- Create: `site/src/pages/docs.astro`, `site/src/pages/viewer.astro`, `site/src/pages/pricing.astro`; any small component the docs sidebar/scroll-spy needs (e.g. `site/src/components/react/Viewer.tsx` if `viewer.html` runs JS).

**Interfaces:**
- Consumes: `Layout`, `SpecSection`.

- [ ] **Step 1:** Port `website/docs.html` (the sticky sidebar + scroll-spy reference — reproduce its structure; if it uses inline JS for scroll-spy, move that into a small `client:idle` island or an `is:inline` script), `website/viewer.html` (the gist session viewer — if it runs JS to fetch/parse a gist, port that logic into a `client:load` island `Viewer.tsx`, preserving the `?gist=` behavior), and `website/pricing.html`.
- [ ] **Step 2:** `cd site && npm run build` — clean; the three pages emitted.
- [ ] **Step 3:** Commit: `git add site && git commit -m "feat(site): docs + viewer + pricing pages"`

> **Controller parity gate (B3):** Browser-pane compare; confirm docs scroll-spy works and the viewer still resolves a `?gist=` link.

---

## Phase C — Changelog

### Task C1: Changelog parser + timeline + page + nav link

**Files:**
- Create: `site/src/data/changelog.ts`, `site/src/data/changelog.test.ts`, `site/src/components/ChangelogTimeline.astro`, `site/src/pages/changelog.astro`
- Modify: `site/src/components/Nav.astro` (the "Changelog" link is already in A1's list — confirm it points to `changelog.html`)

**Interfaces:**
- Produces: `parseChangelog(md: string): Array<{ version: string; title?: string; body: string }>` — splits `CHANGELOG.md` on `^## ` headings; the heading text after `## ` is the `version` (may include a ` — "title"` suffix which is split into `title`); `body` is the markdown between this heading and the next `## `. Order preserved (newest first, as in the file).

- [ ] **Step 1: Write the failing parser test**

Create `site/src/data/changelog.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseChangelog } from "./changelog";

describe("parseChangelog", () => {
  it("splits versions on ## headings, newest first", () => {
    const md = "# Changelog\n\n## 0.10.0\n\nBig release.\n\n## 0.8.2\n\nBugfix.\n";
    const out = parseChangelog(md);
    expect(out.map((v) => v.version)).toEqual(["0.10.0", "0.8.2"]);
    expect(out[0].body.trim()).toBe("Big release.");
  });
  it("splits a ' — title' suffix out of the version heading", () => {
    const md = "## 0.8.0 — \"O Motor\" (The Engine)\n\nText.\n";
    const [v] = parseChangelog(md);
    expect(v.version).toBe("0.8.0");
    expect(v.title).toBe("\"O Motor\" (The Engine)");
  });
  it("ignores the top-level # title and any preamble", () => {
    expect(parseChangelog("# Changelog\n\nintro\n").length).toBe(0);
  });
});
```

- [ ] **Step 2: Run it — expected FAIL** (`Cannot find module './changelog'`): `cd site && npx vitest run src/data/changelog.test.ts`

- [ ] **Step 3: Implement `changelog.ts`**

Create `site/src/data/changelog.ts`. Export `parseChangelog(md)` implementing the Interfaces contract, and a build-time helper that reads the file:
```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface ChangelogEntry { version: string; title?: string; body: string; }

export function parseChangelog(md: string): ChangelogEntry[] {
  const parts = md.split(/^## +/m).slice(1);
  return parts.map((part) => {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    const body = (nl === -1 ? "" : part.slice(nl + 1)).replace(/\n+$/, "").trim();
    const dash = heading.split(/\s+—\s+/);
    const version = dash[0].trim();
    const title = dash.length > 1 ? dash.slice(1).join(" — ").trim() : undefined;
    return title ? { version, title, body } : { version, body };
  });
}

export function loadChangelog(): ChangelogEntry[] {
  const path = fileURLToPath(new URL("../../../CHANGELOG.md", import.meta.url));
  return parseChangelog(readFileSync(path, "utf8"));
}
```
(Confirm the relative path resolves from `site/src/data/` to the repo-root `CHANGELOG.md` — adjust the `../` count if the build reports ENOENT.)

- [ ] **Step 4: Run the test — expected PASS**: `cd site && npx vitest run src/data/changelog.test.ts` (3 passing). If `vitest` is not installed, `npm i -D vitest` in `site/` first.

- [ ] **Step 5: `ChangelogTimeline.astro` + `changelog.astro`**

Create `ChangelogTimeline.astro` (props `{ entries: ChangelogEntry[] }`) rendering a vertical timeline: each entry a node with the `version` in accent mono, the optional `title`, and the `body` rendered from markdown (use Astro's built-in markdown or a light renderer — bold/paragraphs are enough; if you add a renderer, `marked` is fine as a dev dep). Create `changelog.astro`:
```astro
---
import Layout from "../layouts/Layout.astro";
import ChangelogTimeline from "../components/ChangelogTimeline.astro";
import { loadChangelog } from "../data/changelog";
const entries = loadChangelog();
---
<Layout title="TermCoder — Changelog" description="What's new in TermCoder — every release, newest first." active="changelog.html">
  <section class="sys-sec2">
    <div class="split"><div class="t full">
      <div class="mono-eyebrow"><span class="slash">//</span> CHANGELOG</div>
      <h1>What's new.</h1>
      <ChangelogTimeline entries={entries} />
    </div></div>
  </section>
</Layout>
```

- [ ] **Step 6: Build**: `cd site && npm run build` — `changelog.html` emitted with all versions from `CHANGELOG.md`. Confirm no emoji leaks into the rendered output (the `## 0.8.0 — "O Motor"` entry is fine; watch for any `🎉`-style content — there is none in the current file, but the parser must not inject any).

- [ ] **Step 7: Commit**: `git add site && git commit -m "feat(site): changelog page generated from CHANGELOG.md"`

> **Controller parity gate (C1):** Browser-pane render `changelog.html`; confirm the timeline lists 0.10.0 → 0.8.0 with titles and readable bodies.

---

## Phase D — OAuth pages (flow preserved)

### Task D1: Verbatim OAuth passthrough + login + dashboard

**Files:**
- Create: `site/public/callback.html`, `site/public/auth.js`, `site/public/config.js` (verbatim copies), `site/worker/` (copy of `website/auth/`)
- Create: `site/src/pages/login.astro`, `site/src/pages/dashboard.astro`

**Interfaces:**
- Consumes: `Layout`.
- Constraint: the OAuth JS is **not modified**. `login`/`dashboard` load `config.js` + `auth.js` via `<script>` tags in the same order as the current pages.

- [ ] **Step 1: Copy the OAuth machinery verbatim**
```bash
cd "C:/Users/Purple/Downloads/Open Source/.claude/worktrees/website-astro-rewrite"
cp website/callback.html website/auth.js website/config.js site/public/
mkdir -p site/worker && cp -r website/auth/* site/worker/
```
Do not edit these files. `callback.html`, `auth.js`, `config.js` now emit at `site/dist/` root — same URLs as today.

- [ ] **Step 2: Port `login.astro`**

Reproduce `website/login.html`'s body content inside `Layout` (active `login.html`), including its `<script src="config.js?v=...">` and `<script src="auth.js?v=...">` tags with the SAME `?v=` query the current page uses (read it from `website/login.html`). Keep the `.auth-*` markup and the two provider buttons exactly.

- [ ] **Step 3: Port `dashboard.astro`**

Reproduce `website/dashboard.html`'s body (the `.dash-*` tabs + panels + the small inline tab-switch `<script>`), inside `Layout` (or a bare layout if the dashboard hides the marketing nav — match the current page). Keep its `config.js`/`auth.js` script tags with the same `?v=` values, and the `hydrateDashboard`/`[data-signout]` hooks intact.

- [ ] **Step 4: Build**: `cd site && npm run build` — expected: `login.html`, `dashboard.html`, `callback.html`, `auth.js`, `config.js` all present in `site/dist` at the root.

- [ ] **Step 5: Commit**: `git add site && git commit -m "feat(site): OAuth login/dashboard pages with verbatim auth passthrough"`

> **Controller OAuth smoke (D1):** serve `site/dist`; in the Browser pane confirm `login.html` renders the two buttons, `config.js` loads (the Worker URL + client IDs present), `callback.html` resolves (shows its CSRF/error handling when opened with a bad state), and unconfigured/normal buttons behave as on the live site. Full end-to-end login against the real Worker is the user's to confirm post-cutover.

---

## Phase E — Cutover

### Task E1: Rewrite `verify.mjs` to validate `site/dist`

**Files:**
- Create: `site/tools/verify.mjs`

**Interfaces:**
- Produces: a Node script that builds/reads `site/dist/*.html` and asserts the same invariants as `website/tools/verify.mjs`, adapted to the built output.

- [ ] **Step 1:** Port `website/tools/verify.mjs` to `site/tools/verify.mjs`, pointing `site` at `site/dist` (run after `npm run build`). Keep the checks: no emoji in markup, no version pinned outside `<code>/<pre>`, subscription mention ⇒ "experimental" present, required assets present (`favicon.png`, `app.png`, `hero-session.js`, `config.js`, `auth.js`, `callback.html`), `hero-session.js` keeps `window.HERO_SESSION` + `recorded`, and `--links` range-requests the installer URLs. Drop checks that no longer apply (e.g. "links style.css" — Astro bundles CSS with hashed names; instead assert each page includes a `<link rel="stylesheet"` to a bundled sheet). Add: `changelog.html` exists and mentions the latest version heading.
- [ ] **Step 2:** Run: `cd site && npm run build && node tools/verify.mjs` — expected: `OK — N pages verified`. Fix any real violation the port surfaces.
- [ ] **Step 3:** Commit: `git add site && git commit -m "build(site): verify.mjs adapted to the Astro dist output"`

### Task E2: Switch the Pages deploy to build Astro; retire `website/`

**Files:**
- Modify: `.github/workflows/pages.yml`
- Create: `site/package-lock.json` (commit it for reproducible `npm ci`)
- Remove (per the user's Phase-E decision): `website/` — OR keep it one release. **Confirm with the controller/user before deleting.**

**Interfaces:**
- Produces: a Pages workflow that builds `site/` and deploys `site/dist`.

- [ ] **Step 1:** Update `.github/workflows/pages.yml` `paths:` to include `site/**` and the workflow, and replace the upload step with a build:
```yaml
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: actions/configure-pages@v5
      - run: npm ci
        working-directory: site
      - run: npm run build
        working-directory: site
      - run: node tools/verify.mjs
        working-directory: site
      - uses: actions/upload-pages-artifact@v3
        with: { path: site/dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```
- [ ] **Step 2:** Ensure `site/package-lock.json` is committed (it exists after `npm install`; it must NOT be gitignored).
- [ ] **Step 3:** Retirement decision (ask the user via the controller): remove `website/` in this commit, or keep it one release as a fallback. Apply the chosen option.
- [ ] **Step 4:** Commit: `git add .github/workflows/pages.yml site && git commit -m "build(site): deploy Astro build to GitHub Pages"` (+ the `website/` removal if chosen).

> **Controller final gate (E):** `cd site && npm ci && npm run build && node tools/verify.mjs` green locally; Browser-pane parity across all pages; OAuth smoke passes. The deploy only takes effect once merged to `main` and pushed (the user decides when — pushing triggers the live cutover).

---

## Self-Review notes

- **Spec coverage:** Astro+Tailwind+React scaffold (A1); design tokens/identity (A1 §3 + refine-as-you-port); URL preservation via `build.format:'file'` (A1 §2, applies to every page task); hero replay island (A2); marketing pages (B1–B3); OS-detection island (B2); changelog from CHANGELOG.md (C1); OAuth verbatim passthrough + login/dashboard (D1); verify.mjs on dist (E1); deploy cutover + website retirement (E2). Every spec section maps to a task.
- **No package/monorepo impact:** `site/` is outside `packages/*`; `.gitignore` covers `site/node_modules|dist|.astro`; the pnpm workspace and its CI are untouched.
- **OAuth safety:** `auth.js`/`config.js`/`callback.html` copied verbatim (D1 §1), same URLs (`build.format:'file'` + `public/`), same `?v=` script tags (D1 §2-3). No OAuth app or Worker change.
- **Type/interface consistency:** `parseChangelog`/`loadChangelog`/`ChangelogEntry` names match across `changelog.ts`, its test, and `ChangelogTimeline`/`changelog.astro`. `Layout` props `{title,description,active}` consistent across all pages. `SpecSection`/`CommandBox`/`FeatureRow`/`Steps`/`Cta` interfaces defined where introduced and reused by name.
- **Placeholder scan:** the two genuinely-open decisions (Tailwind v4 vs v3 fallback; retire vs keep `website/`) are flagged for the controller/user, not left as silent TODOs; all code steps carry concrete commands/code.
```
