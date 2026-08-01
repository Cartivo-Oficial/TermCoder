# Website Synara Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public site in `app/` as a light-first, pure-monochrome, screenshot-led page set in the mould of trysynara.com, across all fourteen pages, with a dark theme behind a nav toggle.

**Architecture:** A greyscale token layer in `app/src/index.css` drives everything. A small marketing component kit in `app/src/components/site/` replaces the layout that each page currently re-declares inline. `app/verify.mjs` — the existing post-build guard that already runs in CI — is extended with the redesign's own invariants (no banned colour token, pre-paint theme script present, no `Dither`), carrying a shrinking allowlist of not-yet-migrated files. That allowlist is the plan's test: every phase deletes entries from it, and the guard fails while any phase is half-done.

**Tech Stack:** React 19, Vite 7, Tailwind CSS 4, shadcn primitives, `@fontsource-variable/geist`, SSR entry + `prerender.mjs` to static HTML, vitest (from the repository root), oxlint.

## Global Constraints

- Node 22 (`app/package.json` has no engines field; `.github/workflows/pages.yml` pins `node-version: 22`).
- The deploy base path is `/TermCoder/`. `app/verify.mjs` hardcodes `const BASE = "/TermCoder/"`. Do not change it.
- All fourteen routes keep their current filenames. `verify.mjs` requires these by name: `index`, `features`, `study`, `install`, `download`, `docs`, `pricing`, `login`, `dashboard`, `viewer`, `changelog`. Renaming any of them fails the build.
- `app/public/auth.js`, `app/public/config.js` and `app/public/callback.html` are untouchable. `verify.mjs` asserts `callback.html` still loads both scripts and calls `handleCallback`.
- Site copy stays in English.
- No invented social proof: no testimonials, no star counts, no download counters. The repository has 1 star.
- Banned in `app/src/**` once a file is migrated, as the regexes the guard uses: `/ff7a45/`, `/31d0b4/`, `/\btext-study\b/`, `/\btext-primary\b(?!-)/`, `/shadow-primary/`, `/build-soft/`, `/study-soft/`, `/Funnel Display/`, `/<Dither/`. Note `text-primary-foreground` is **permitted and expected** — it is the text colour of a solid button. Only bare `text-primary` is banned.
- Colour is permitted **only** for state: one green and one red, used for pass/fail and form validation. Nowhere else.
- Mono is the system stack. No mono webfont ships.
- `pricing.tsx` carries the Paddle checkout. Presentation may change; checkout behaviour may not.
- Every phase ends green on: `cd app && npm run build && node verify.mjs && npx oxlint`.
- `pnpm test` from the repository root does **not** exit zero, and is not expected to: 7 test files fail on a pre-existing `better-sqlite3` native-binding problem unrelated to the site. The binding requirement is narrower — `app/src/**` tests pass, and the count of pre-existing failures is unchanged from the 95 recorded at Task 1. A new failure outside `app/` means you broke something; the existing 95 do not.

---

## File Structure

**Created**

| path | responsibility |
| --- | --- |
| `app/src/lib/theme.ts` | `resolveTheme()` — pure, testable theme resolution |
| `app/src/lib/theme.test.ts` | its unit test |
| `app/src/components/site/section.tsx` | `Section`, `Eyebrow`, `Heading`, `Lead` — page rhythm and headings |
| `app/src/components/site/card-grid.tsx` | `CardGrid` — responsive card grid |
| `app/src/components/site/screenshot.tsx` | `Screenshot` — framed image, fixed ratio, lazy |
| `app/src/components/site/feature-block.tsx` | `FeatureBlock` — text/visual pair, alternating |
| `app/src/components/site/faq.tsx` | `FAQ` — native `<details>`, no JS |
| `app/src/components/site/prose.tsx` | `Prose` — running-text typography |
| `app/src/components/site/theme-toggle.tsx` | `ThemeToggle` — the nav button |
| `app/src/assets/shot-*.webp` | the five product screenshots |

**Modified**

| path | change |
| --- | --- |
| `vitest.config.ts` (root) | add `app/src/**` to `include` so app tests run at all |
| `app/verify.mjs` | add the redesign invariants and the shrinking allowlist |
| `app/index.html` | drop `class="dark"`, add the pre-paint theme script |
| `app/src/index.css` | the whole token layer: greyscale ramps, Geist, radii, fonts |
| `app/src/components/site/nav.tsx` | monochrome, plus `ThemeToggle` |
| `app/src/components/site/footer.tsx` | monochrome |
| `app/src/components/ui/{button,card,badge}.tsx` | drop colour variants, new radius |
| `app/src/components/{mark,docs,licence-panel}.tsx` | drop hardcoded colour |
| `app/src/pages/*.tsx` | all fourteen, in phase order |
| `.github/workflows/pages.yml` | correct trigger paths and the stale header comment |

**Deleted**

| path | why |
| --- | --- |
| `app/src/components/dither.tsx` | the texture does not survive a light, airy layout |
| `app/src/fonts/funnel-display.woff2` | display font dropped |
| `app/src/fonts/inter-400.woff2`, `inter-600.woff2` | replaced by variable Geist |

`app/src/fonts/departure-mono.woff2` is **kept** — the wordmark may still use it. Nothing else may.

---

## Phase 0 — Make the gate real

### Task 1: Wire `app/` into the test runner

`app/src/lib/gist.test.ts` exists and has never run: the root `vitest.config.ts` `include` covers `packages/*` and `website/auth` only. Nothing in this plan can be test-driven until that is fixed.

**Files:**
- Modify: `vitest.config.ts:19` (the `include` array)

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm test` from the repository root now executes `app/src/**/*.{test,spec}.{ts,tsx}`. Every later task's tests rely on this.

- [ ] **Step 1: Run the suite and record what runs today**

```bash
pnpm test 2>&1 | tail -20
```

Expected: passes, and the file list contains **no** `app/` entry. Note the test-file count.

- [ ] **Step 2: Add `app/` to the include**

In `vitest.config.ts`, replace the `include` line:

```ts
  test: {
    include: [
      "packages/*/src/**/*.{test,spec}.{ts,tsx}",
      "app/src/**/*.{test,spec}.{ts,tsx}",
      "website/auth/**/*.test.mjs",
    ],
    environment: "node",
  },
```

- [ ] **Step 3: Add the `@/` alias vitest will need**

`app/` imports use the `@/` prefix (`@/lib/utils`). `vite.config.ts` in `app/` defines it, but the root vitest config does not. Add it beside the existing alias:

```ts
  resolve: {
    alias: {
      "@termcoder/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./app/src", import.meta.url)),
    },
  },
```

- [ ] **Step 4: Run and confirm the app test now executes**

```bash
pnpm test 2>&1 | tail -20
```

Expected: PASS, and `app/src/lib/gist.test.ts` now appears in the output. If it *fails*, that is a real pre-existing bug in `createOptimisticQueue` surfacing for the first time — fix it before continuing, and say so in the commit.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts
git commit -m "test: run the app's tests, which the root config never included"
```

---

### Task 2: The design guard in `verify.mjs`

This is the failing test that drives the whole redesign. It scans source for banned tokens and asserts the theme script exists. It starts red, and each later phase removes files from its allowlist.

**Files:**
- Modify: `app/verify.mjs` (append before the final failure report)

**Interfaces:**
- Consumes: nothing.
- Produces: an exported-by-convention constant `NOT_YET_MIGRATED` — an array of `src`-relative paths the guard skips. Later tasks delete entries from it by exact filename.

- [ ] **Step 1: Read the tail of the existing guard**

```bash
tail -25 app/verify.mjs
```

Note how it accumulates into `fail` and how it exits. The new checks must use the same `check(cond, msg)` helper and the same `fail` array — do not add a second reporting mechanism.

- [ ] **Step 2: Append the guard**

Add to `app/verify.mjs`, immediately before the block that prints `fail` and exits:

```js
// ── redesign invariants ────────────────────────────────────────────────
// Files still carrying the old dark/orange identity. Each redesign phase
// deletes entries here; the guard fails while any listed file has been
// migrated in appearance but not in fact.
const NOT_YET_MIGRATED = [
  "pages/features.tsx", "pages/study.tsx", "pages/pricing.tsx",
  "pages/download.tsx", "pages/install.tsx", "pages/docs.tsx",
  "pages/changelog.tsx", "pages/privacy.tsx", "pages/terms.tsx",
  "pages/refunds.tsx", "pages/dashboard.tsx", "pages/viewer.tsx",
  "pages/login.tsx", "components/docs.tsx", "components/licence-panel.tsx",
  "components/settings-panel.tsx", "components/connectors-panel.tsx",
  "components/download-cards.tsx", "components/dither.tsx",
];

// Regexes, not substrings: "text-primary" is a prefix of the perfectly
// legitimate "text-primary-foreground", and a plain includes() would ban
// every solid button in the kit.
const BANNED = [
  /ff7a45/, /31d0b4/, /\btext-study\b/, /\btext-primary\b(?!-)/,
  /shadow-primary/, /build-soft/, /study-soft/, /Funnel Display/, /<Dither/,
];

const srcDir = join(root, "src");
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

for (const file of walk(srcDir)) {
  if (!/\.(tsx?|css)$/.test(file)) continue;
  const rel = file.slice(srcDir.length + 1).replace(/\\/g, "/");
  if (NOT_YET_MIGRATED.includes(rel)) continue;
  const body = readFileSync(file, "utf8");
  for (const re of BANNED)
    check(!re.test(body), `${rel} still matches ${re}`);
}

// The pre-paint theme script must sit in the built HTML, or a dark-theme
// visitor gets a white flash on every navigation.
for (const p of ["index", "features", "docs"]) {
  const html = join(dist, `${p}.html`);
  if (!existsSync(html)) continue;
  const body = readFileSync(html, "utf8");
  check(body.includes("__termcoder_theme"), `${p}.html has no pre-paint theme script`);
  check(!body.includes('<html lang="en" class="dark">'), `${p}.html still hardcodes the dark class`);
}
```

- [ ] **Step 3: Run it and watch it fail**

```bash
cd app && npm run build && node verify.mjs
```

Expected: FAIL. The named files should be `index.css`, `pages/home.tsx`, `components/site/nav.tsx`, `components/mark.tsx`, `components/ui/button.tsx` and `components/ui/badge.tsx` — everything carrying colour that the allowlist does *not* cover — plus three `has no pre-paint theme script` lines. That failure is the point: it is the redesign's definition of done, written down before the work starts.

- [ ] **Step 4: Commit the red guard**

```bash
git add app/verify.mjs
git commit -m "test(site): guard the redesign invariants, failing until the work lands"
```

---

## Phase 1 — Design system

### Task 3: The token layer

**Files:**
- Modify: `app/src/index.css` (the whole file)
- Delete: `app/src/fonts/funnel-display.woff2`, `app/src/fonts/inter-400.woff2`, `app/src/fonts/inter-600.woff2`

**Interfaces:**
- Consumes: nothing.
- Produces: the token names every later task uses — `--background`, `--foreground`, `--muted-foreground`, `--border`, `--card`, `--primary`, `--primary-foreground`, `--ok`, `--bad`, `--radius`. `--study`, `--build-soft`, `--study-soft` no longer exist; referencing them is a build error in Tailwind 4.

- [ ] **Step 1: Replace the font faces and the theme block**

At the top of `app/src/index.css`, replace the four `@font-face` rules with a single import and keep only the mono declaration:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";

@font-face { font-family: "Departure Mono"; src: url("./fonts/departure-mono.woff2") format("woff2"); font-weight: 400; font-display: swap; }

@custom-variant dark (&:is(.dark *));
```

Then in the `@theme inline` block, replace the three font lines:

```css
    --font-display: 'Geist Variable', system-ui, sans-serif;
    --font-heading: var(--font-display);
    --font-sans: 'Geist Variable', system-ui, sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --font-wordmark: 'Departure Mono', ui-monospace, monospace;
```

And delete these four lines from `@theme inline`:

```css
    --color-study: var(--study);
    --color-study-soft: var(--study-soft);
    --color-build-soft: var(--build-soft);
```

Add in their place:

```css
    --color-ok: var(--ok);
    --color-bad: var(--bad);
```

- [ ] **Step 2: Replace both ramps**

Replace the whole `:root` block and the whole `.dark` block:

```css
:root {
    --background: #ffffff;
    --foreground: #0a0a0a;
    --card: #ffffff;
    --card-foreground: #0a0a0a;
    --popover: #ffffff;
    --popover-foreground: #0a0a0a;
    --primary: #0a0a0a;
    --primary-foreground: #ffffff;
    --secondary: #fafafa;
    --secondary-foreground: #0a0a0a;
    --muted: #fafafa;
    --muted-foreground: #6b6b6b;
    --accent: #f4f4f4;
    --accent-foreground: #0a0a0a;
    --border: #e6e6e6;
    --input: #e6e6e6;
    --ring: #0a0a0a;
    --ok: #157f3d;
    --bad: #c02626;
    --destructive: #c02626;
    --radius: 0.75rem;
}

.dark {
    --background: #0a0a0a;
    --foreground: #f5f5f5;
    --card: #141414;
    --card-foreground: #f5f5f5;
    --popover: #141414;
    --popover-foreground: #f5f5f5;
    --primary: #f5f5f5;
    --primary-foreground: #0a0a0a;
    --secondary: #1a1a1a;
    --secondary-foreground: #f5f5f5;
    --muted: #141414;
    --muted-foreground: #a0a0a0;
    --accent: #1a1a1a;
    --accent-foreground: #f5f5f5;
    --border: rgba(255, 255, 255, 0.10);
    --input: rgba(255, 255, 255, 0.14);
    --ring: #f5f5f5;
    --ok: #4ade80;
    --bad: #f87171;
    --destructive: #f87171;
}
```

The `--sidebar-*` and `--chart-*` tokens in both blocks may be deleted outright — grep confirms nothing uses them:

```bash
grep -rn "sidebar-\|chart-" app/src --include=*.tsx | grep -v index.css
```

Expected: no output. If there is output, keep the tokens those files use.

- [ ] **Step 3: Delete the dropped font files**

```bash
git rm app/src/fonts/funnel-display.woff2 app/src/fonts/inter-400.woff2 app/src/fonts/inter-600.woff2
```

- [ ] **Step 4: Build and confirm the CSS compiles**

```bash
cd app && npm run build
```

Expected: build succeeds. `verify.mjs` will still fail on pages not yet migrated — that is correct at this point. If the build errors with `Cannot apply unknown utility class: text-primary`, a component still references a deleted token; note which and fix it in Task 5.

- [ ] **Step 5: Commit**

```bash
git add app/src/index.css app/src/fonts
git commit -m "feat(site): monochrome token ramps and Geist, replacing the orange identity"
```

---

### Task 4: Theme resolution, the pre-paint script, and the toggle

**Files:**
- Create: `app/src/lib/theme.ts`, `app/src/lib/theme.test.ts`, `app/src/components/site/theme-toggle.tsx`
- Modify: `app/index.html:2` (drop `class="dark"`, add the script), `app/src/components/site/nav.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`, `buttonVariants` from `@/components/ui/button`.
- Produces:
  - `export type Theme = "light" | "dark"`
  - `export function resolveTheme(stored: string | null, prefersDark: boolean): Theme`
  - `export function applyTheme(theme: Theme): void` — toggles `.dark` on `document.documentElement` and writes `localStorage.termcoder-theme`
  - `export const STORAGE_KEY = "termcoder-theme"`
  - `<ThemeToggle />` — no props.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("honours an explicit stored choice over the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("falls back to the system preference when nothing is stored", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("treats a corrupt stored value as unset rather than throwing", () => {
    expect(resolveTheme("aubergine", true)).toBe("dark");
    expect(resolveTheme("", false)).toBe("light");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm test app/src/lib/theme.test.ts
```

Expected: FAIL — `Failed to resolve import "./theme"`.

- [ ] **Step 3: Write the module**

Create `app/src/lib/theme.ts`:

```ts
export type Theme = "light" | "dark";

export const STORAGE_KEY = "termcoder-theme";

export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode — the choice simply does not persist
  }
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm test app/src/lib/theme.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Add the pre-paint script**

In `app/index.html`, change line 2 from `<html lang="en" class="dark">` to `<html lang="en">`, and add this as the **first** element inside `<head>` — before any stylesheet link, or the flash still happens:

```html
    <script>
      window.__termcoder_theme = (function () {
        try {
          var s = localStorage.getItem("termcoder-theme");
          var t = s === "light" || s === "dark"
            ? s
            : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
          if (t === "dark") document.documentElement.classList.add("dark");
          return t;
        } catch (e) {
          return "light";
        }
      })();
    </script>
```

The literal `__termcoder_theme` is what `verify.mjs` greps for. Do not rename it.

- [ ] **Step 6: Write the toggle**

Create `app/src/components/site/theme-toggle.tsx`:

```tsx
import { useEffect, useState } from "react";
import { applyTheme, resolveTheme, STORAGE_KEY, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(
      resolveTheme(
        localStorage.getItem(STORAGE_KEY),
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      ),
    );
  }, []);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`Switch to the ${next} theme`}
      onClick={() => { applyTheme(next); setTheme(next); }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border",
        "text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <span aria-hidden className="text-[13px]">{theme === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}
```

The component renders `light` on the server and corrects itself in `useEffect`; the `<html>` class is already right from the pre-paint script, so only the icon settles a frame late. That is deliberate — reading `localStorage` during render would break the prerender.

- [ ] **Step 7: Rewrite the nav monochrome, with the toggle**

Replace `app/src/components/site/nav.tsx` entirely:

```tsx
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/site/theme-toggle";

const LINKS = ["features", "study", "install", "download", "docs", "pricing"];

export function Nav({ active }: { active?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-8 px-6">
        <a href="index.html" className="flex items-center gap-2.5">
          <Mark size={20} />
          <span className="text-[16px] font-semibold tracking-tight text-foreground">termcoder</span>
        </a>
        <nav className="hidden items-center gap-6 text-[14px] text-muted-foreground md:flex">
          {LINKS.map((n) => (
            <a
              key={n}
              href={`${n}.html`}
              className={cn("transition-colors hover:text-foreground", active === n && "text-foreground")}
            >
              {n}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <a href="login.html" className="hidden text-[14px] text-muted-foreground transition-colors hover:text-foreground sm:block">
            Sign in
          </a>
          <ThemeToggle />
          <a href="download.html" className={cn(buttonVariants(), "h-9 rounded-lg px-4 text-[14px]")}>
            Get the app
          </a>
        </div>
      </div>
    </header>
  );
}
```

Note the link list changed: `build`/`study` anchors into the home page are replaced by real pages, because the coloured hover that distinguished them is gone and two anchors plus five links read as clutter in one weight.

**The one open aesthetic choice.** Task 3 keeps `departure-mono.woff2` and defines `--font-wordmark` for it. The nav above does *not* use it — the wordmark renders in Geist like everything else. To let the pixel font survive in the wordmark alone, change that one span to:

```tsx
<span className="font-[family-name:var(--font-wordmark)] text-[16px] text-foreground">termcoder</span>
```

If it is left unused, delete both the `@font-face` rule and `app/src/fonts/departure-mono.woff2` in Task 20 rather than shipping a font nothing loads.

- [ ] **Step 8: Build, verify the script landed, commit**

```bash
cd app && npm run build && grep -c "__termcoder_theme" dist/index.html
```

Expected: build succeeds, `grep` prints `1` or more.

```bash
git add app/index.html app/src/lib/theme.ts app/src/lib/theme.test.ts app/src/components/site/theme-toggle.tsx app/src/components/site/nav.tsx
git commit -m "feat(site): light by default, with a dark toggle that does not flash"
```

---

### Task 5: The component kit

**Files:**
- Create: `app/src/components/site/section.tsx`, `card-grid.tsx`, `screenshot.tsx`, `feature-block.tsx`, `faq.tsx`, `prose.tsx`
- Modify: `app/src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `app/src/components/mark.tsx`, `app/src/components/site/footer.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`.
- Produces, and every page task from here on uses exactly these names:
  - `<Section id?: string, bordered?: boolean, className?: string>` — `bordered` defaults to `true`
  - `<Eyebrow>` — children only
  - `<Heading level?: 1 | 2>` — defaults to `2`
  - `<Lead>` — children only
  - `<CardGrid cols?: 2 | 3 | 4>` — defaults to `3`
  - `<Screenshot src: string, alt: string, width: number, height: number, caption?: string, priority?: boolean>`
  - `<FeatureBlock eyebrow: string, title: string, body: string, reverse?: boolean>` — visual goes in `children`
  - `<FAQ items: { q: string; a: string }[]>`
  - `<Prose>` — children only

- [ ] **Step 1: Write the rhythm primitives**

Create `app/src/components/site/section.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function Section({
  children, id, bordered = true, className,
}: { children: React.ReactNode; id?: string; bordered?: boolean; className?: string }) {
  return (
    <section id={id} className={cn(bordered && "border-t border-border")}>
      <div className={cn("mx-auto max-w-[1120px] px-6 py-20 sm:py-28", className)}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
  );
}

export function Heading({ children, level = 2 }: { children: React.ReactNode; level?: 1 | 2 }) {
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <Tag
      className={cn(
        "mt-4 font-semibold tracking-[-0.03em] text-balance text-foreground",
        level === 1
          ? "max-w-[16ch] text-[clamp(40px,7vw,72px)] leading-[1.02]"
          : "max-w-[24ch] text-[clamp(28px,4vw,40px)] leading-[1.1]",
      )}
    >
      {children}
    </Tag>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-muted-foreground">{children}</p>;
}
```

- [ ] **Step 2: Write the grid, the screenshot frame and the feature block**

Create `app/src/components/site/card-grid.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function CardGrid({
  children, cols = 3,
}: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "mt-10 grid gap-4 sm:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
        cols === 4 && "lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}
```

Create `app/src/components/site/screenshot.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function Screenshot({
  src, alt, width, height, caption, priority = false, className,
}: {
  src: string; alt: string; width: number; height: number;
  caption?: string; priority?: boolean; className?: string;
}) {
  return (
    <figure className={cn("mt-10", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_60px_-32px_rgba(0,0,0,0.35)]">
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="block w-full"
        />
      </div>
      {caption && <figcaption className="mt-3 text-[13px] text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
```

Create `app/src/components/site/feature-block.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/site/section";

export function FeatureBlock({
  eyebrow, title, body, reverse = false, children,
}: {
  eyebrow: string; title: string; body: string;
  reverse?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn(reverse && "lg:order-2")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-3 max-w-[20ch] text-[clamp(24px,3vw,32px)] font-semibold leading-[1.15] tracking-[-0.025em] text-foreground">
          {title}
        </h3>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className={cn("min-w-0", reverse && "lg:order-1")}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Write the FAQ and the prose wrapper**

Create `app/src/components/site/faq.tsx`:

```tsx
export function FAQ({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mt-10 divide-y divide-border border-y border-border">
      {items.map(({ q, a }) => (
        <details key={q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium text-foreground">
            {q}
            <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 max-w-[68ch] text-[16px] leading-relaxed text-muted-foreground">{a}</p>
        </details>
      ))}
    </div>
  );
}
```

Create `app/src/components/site/prose.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[68ch] text-[16px] leading-[1.7] text-muted-foreground",
        "[&_h2]:mt-14 [&_h2]:mb-4 [&_h2]:text-[28px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-foreground",
        "[&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-[20px] [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1.5",
        "[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4",
        "[&_code]:font-mono [&_code]:text-[14px] [&_code]:text-foreground",
        "[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border",
        "[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[13.5px] [&_pre]:leading-relaxed",
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Strip colour from the primitives**

In `app/src/components/ui/button.tsx`, `card.tsx` and `badge.tsx`: change every `rounded-md` to `rounded-lg`, and delete any variant whose classes reference `study`, `build-soft` or a literal hex. Find them first:

```bash
grep -n "study\|build-soft\|ff7a45\|31d0b4\|rounded-md" app/src/components/ui/*.tsx app/src/components/mark.tsx app/src/components/site/footer.tsx
```

Rewrite each hit so it uses `bg-primary text-primary-foreground` (solid), `border-border text-foreground` (outline) or `text-muted-foreground` (ghost). `Mark` must take `currentColor`, not a fixed hex, so it inherits the theme.

- [ ] **Step 5: Build and confirm the kit compiles**

```bash
cd app && npm run build && npx oxlint
```

Expected: build succeeds, lint clean. `verify.mjs` still fails on the allowlisted pages — expected.

- [ ] **Step 6: Commit**

```bash
git add app/src/components
git commit -m "feat(site): a marketing component kit the pages can share"
```

---

## Phase 2 — The home pilot

### Task 6: Rewrite the home page on the kit

The screenshots do not exist yet. Each of the five image slots gets a `Screenshot` pointing at the existing `app-hero.png` as a stand-in, so the layout is real and the swap in Task 8 is a one-line change per slot.

**Files:**
- Modify: `app/src/pages/home.tsx` (full rewrite, 481 lines → the twelve blocks below)

**Interfaces:**
- Consumes: everything Task 5 produced, plus `CopyButton` from `@/components/copy-button`, `Nav`, `Footer`.
- Produces: nothing later tasks import.

- [ ] **Step 1: Delete the Dither usage and the colour helpers**

Remove from `home.tsx`: both `<Dither />` elements, the `Cmd` helper (replaced by `Eyebrow`), the local `H2`/`Lead`/`Section` helpers (replaced by the kit), the `btn`/`btnOutline` constants carrying `shadow-primary`, and every `from-[#ff7a45]` gradient span.

- [ ] **Step 2: Build the twelve blocks in this exact order**

| # | block | kit components | notes |
| --- | --- | --- | --- |
| 1 | Hero | `Heading level={1}`, `Lead`, two buttons, fact line | fact line: `MIT · 12 providers · 16 tools · Windows · macOS · Linux · no telemetry`, as plain `text-muted-foreground`, separated by `·` |
| 2 | Anchor shot | `Screenshot priority` | full container width, `caption` naming the tabs |
| 3 | Providers | `Section`, `Eyebrow`, `Heading`, `CardGrid cols={3}` | the existing `PROVIDERS` array; heading *"It opens on a free model. Twelve more are one command away."* |
| 4 | The builder | `Section`, `FeatureBlock` | keep the struck-through "to start you need" list. The `✗` is **`text-muted-foreground`, not `text-bad`** — nothing in that list has failed, so it is not state, and spending the error colour on decorative negation devalues its one real use in block 7. The negation must also reach the accessibility tree: `<s>` alone is not announced by NVDA or VoiceOver, so a hidden `✗` plus struck text reads aloud as the exact opposite of the claim |
| 5 | A real shell | `Section`, `FeatureBlock reverse` | — |
| 6 | Memory + retrieval | `Section`, `FeatureBlock` | — |
| 7 | Autonomous | `Section`, `FeatureBlock reverse` | the round list keeps `text-ok` / `text-bad` — this is the sanctioned use of colour |
| 8 | Secondary | `Section`, `CardGrid cols={4}` | agents/skills/commands/recipes · MCP connectors · the tutor · classrooms and live rooms |
| 9 | Security is a feature | `Section`, `CardGrid cols={2}` | local-first · no telemetry · direct-to-provider · no account · per-tool permission |
| 10 | Technical proof | `Section` | `MIT` · `16` tools · `12` providers · `0` servers holding your code, plus a link to the source. **No stars, no downloads, no testimonials.** |
| 11 | FAQ | `Section`, `FAQ` | the six questions below, verbatim |
| 12 | Final CTA | `Section bordered`, `CopyButton` | `npm install -g @termcoder/tui`, two buttons |

The FAQ items, to be used exactly:

```tsx
const FAQ_ITEMS = [
  { q: "Do I need an API key?",
    a: "No. It opens on a free, community-hosted model with no sign-up and no card. It is rate-limited when busy, and prompts go to a third party we do not run — point it at a local Ollama to keep everything on your machine." },
  { q: "Is it really free?",
    a: "The agent and the tutor are MIT licensed and free forever, and joining any room or class is free. Only hosting a room is paid." },
  { q: "Does it work offline?",
    a: "With a local model, yes. Point it at Ollama and nothing leaves your machine — retrieval, memory and the tool loop all run locally." },
  { q: "Does it run on Windows?",
    a: "Yes. The CLI runs on Windows, macOS and Linux, and the desktop app ships installers for all three with Node bundled." },
  { q: "Where does my code go?",
    a: "To the model provider you choose, and nowhere else. There is no TermCoder server in the middle, no telemetry, and no account. Your config, memory and sessions are plain files on disk." },
  { q: "How is this different from Claude Code?",
    a: "It is provider-agnostic rather than tied to one vendor, it routes each turn to a model tier on its own, and it has a study mode — flashcards, quizzes and worked homework — that no other coding agent ships." },
];
```

- [ ] **Step 3: Build and check the guard's home-page verdict**

```bash
cd app && npm run build && node verify.mjs
```

Expected: the failure list no longer names `pages/home.tsx` or `components/site/nav.tsx`. It still names the thirteen allowlisted files. If `home.tsx` is still named, a banned token survived — the message says which.

- [ ] **Step 4: Look at it in both themes**

```bash
cd app && npx vite preview --port 4173
```

Open `http://localhost:4173/TermCoder/index.html`. Check: no white flash when reloading in dark mode; the fact line does not wrap awkwardly at 375px; the FAQ opens without JavaScript; every heading is one weight and one colour.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/home.tsx
git commit -m "feat(site): rewrite the home page into the Synara section flow"
```

---

### Task 7: Review gate

**Files:** none.

- [ ] **Step 1: Stop and show the author**

The home page is the pilot for a monochrome, neutral-sans direction that could read as clean or could read as generic. Present it before touching the other thirteen pages. If the direction is wrong, it is wrong here and costs one page — which is the entire reason the plan is ordered this way.

Do not proceed to Phase 3 without an explicit go-ahead.

---

## Phase 3 — Screenshots

### Task 8: Capture the five shots

**Files:**
- Create: `app/src/assets/shot-app.webp`, `shot-builder.webp`, `shot-shell.webp`, `shot-memory.webp`, `shot-autonomous.webp`
- Modify: `app/src/pages/home.tsx` (swap the five stand-in `src` values)
- Delete: `app/src/assets/app-hero.png` once nothing references it

- [ ] **Step 1: Launch the desktop app**

`ELECTRON_RUN_AS_NODE` must be stripped from the environment or no window opens on this machine:

```bash
cd packages/desktop && env -u ELECTRON_RUN_AS_NODE npm run dev
```

- [ ] **Step 2: Set the window to a fixed size**

1440×900 at 2× device pixel ratio. The same window, the same sample project, and the same theme across all five — they must read as one series, not five stray captures.

- [ ] **Step 3: Capture the five states**

| file | state |
| --- | --- |
| `shot-app.webp` | the app on open: session rail, Chat and Terminal tabs, composer with the model picker |
| `shot-builder.webp` | a build session mid-turn, with a diff visible |
| `shot-shell.webp` | the Terminal tab running the project's tests |
| `shot-memory.webp` | memory and retrieval — remembered facts, a `symbols` result |
| `shot-autonomous.webp` | an autonomous run partway through its rounds |

- [ ] **Step 4: Convert and record the true dimensions**

```bash
cd app/src/assets && for f in shot-*.png; do npx sharp-cli -i "$f" -o "${f%.png}.webp" -f webp -q 82; done
npx sharp-cli --version >/dev/null && node -e "const s=require('sharp');(async()=>{for(const f of require('fs').readdirSync('.').filter(x=>x.endsWith('.webp'))){const m=await s(f).metadata();console.log(f,m.width,m.height)}})()"
```

Put the printed width and height into each `Screenshot` call. A guessed ratio causes layout shift, which is exactly what the component's `width`/`height` props exist to prevent.

- [ ] **Step 5: If a state cannot be produced presentably**

Do **not** substitute silently. Leave that block's coded artefact in place, and report which slot fell back and why. The spec commits to this explicitly.

- [ ] **Step 6: Build, verify, commit**

```bash
cd app && npm run build && node verify.mjs
git add app/src/assets app/src/pages/home.tsx
git commit -m "feat(site): five real product screenshots, shot as one series"
```

---

## Phase 4 — Group A, the marketing pages

Each of Tasks 9–13 follows the same shape. For every one:

1. Delete the `<Dither />` import and element.
2. Replace the page's inline `mx-auto max-w-6xl px-6 py-20` containers with `Section`.
3. Replace local heading helpers with `Eyebrow` / `Heading` / `Lead`.
4. Replace every `text-primary` and `text-study` with `text-foreground`, and every `shadow-primary/*` with nothing.
5. Delete the file's entry from `NOT_YET_MIGRATED` in `app/verify.mjs`.
6. Run `cd app && npm run build && node verify.mjs && npx oxlint`. The guard must not name the file.
7. Commit.

### Task 9: `features.tsx`

**Files:** Modify `app/src/pages/features.tsx` (233 lines, 3 containers, 7 tinted lines), `app/verify.mjs`

- [ ] **Step 1** Apply the seven steps above.
- [ ] **Step 2** Where the page lists capabilities, use `CardGrid cols={3}`; where it explains one thing at length, use `FeatureBlock`.
- [ ] **Step 3** `cd app && npm run build && node verify.mjs && npx oxlint` — the guard must not name `pages/features.tsx`.
- [ ] **Step 4** `git add app/src/pages/features.tsx app/verify.mjs && git commit -m "feat(site): features page on the new kit"`

### Task 10: `study.tsx`

**Files:** Modify `app/src/pages/study.tsx` (230 lines, 11 tinted lines — the most teal-heavy page), `app/verify.mjs`

- [ ] **Step 1** Apply the seven steps. This page leans hardest on `text-study`; every one becomes `text-foreground`. The study identity now comes from the words and the flashcard artefact, not the hue.
- [ ] **Step 2** Keep the streak bar chart, redrawn in `bg-foreground/80` bars on `bg-muted`.
- [ ] **Step 3** `cd app && npm run build && node verify.mjs && npx oxlint`
- [ ] **Step 4** `git add app/src/pages/study.tsx app/verify.mjs && git commit -m "feat(site): study page on the new kit"`

### Task 11: `pricing.tsx`

**Files:** Modify `app/src/pages/pricing.tsx` (299 lines, 11 tinted lines, 2 Dithers), `app/verify.mjs`

- [ ] **Step 1** Before editing, record the checkout path:

```bash
grep -n "Paddle\|checkout\|openCheckout\|priceId" app/src/pages/pricing.tsx
```

Every line printed is behaviour. Change presentation around it; do not move, rename or re-wire any of it.

- [ ] **Step 2** Apply the seven steps.
- [ ] **Step 3** `cd app && npm run build && node verify.mjs && npx oxlint`. `verify.mjs` has its own pricing assertions — if any fire, the checkout markup was disturbed; revert that hunk.
- [ ] **Step 4** `git add app/src/pages/pricing.tsx app/verify.mjs && git commit -m "feat(site): pricing page on the new kit, checkout untouched"`

### Task 12: `download.tsx`

**Files:** Modify `app/src/pages/download.tsx` (92 lines, 5 tinted lines), `app/src/components/download-cards.tsx`, `app/verify.mjs`

- [ ] **Step 1** Apply the seven steps to both files; delete both entries from `NOT_YET_MIGRATED`.
- [ ] **Step 2** The platform cards become `CardGrid cols={3}`.
- [ ] **Step 3** `cd app && npm run build && node verify.mjs && npx oxlint`
- [ ] **Step 4** `git add app/src/pages/download.tsx app/src/components/download-cards.tsx app/verify.mjs && git commit -m "feat(site): download page on the new kit"`

### Task 13: `install.tsx`

**Files:** Modify `app/src/pages/install.tsx` (122 lines, 6 tinted lines), `app/verify.mjs`

- [ ] **Step 1** Apply the seven steps.
- [ ] **Step 2** Command blocks use the `Prose` `[&_pre]` styling or a bordered `bg-muted` block — one or the other across the page, not both.
- [ ] **Step 3** `cd app && npm run build && node verify.mjs && npx oxlint`
- [ ] **Step 4** `git add app/src/pages/install.tsx app/verify.mjs && git commit -m "feat(site): install page on the new kit"`

---

## Phase 5 — Group B, the running-text pages

### Task 14: `docs.tsx` onto `Prose`

The largest single win: 660 lines of hand-rolled typography collapse onto one wrapper.

**Files:** Modify `app/src/pages/docs.tsx`, `app/src/components/docs.tsx`, `app/verify.mjs`

- [ ] **Step 1** Wrap the document body in `<Prose>` and delete every per-element typography class it now supplies (`text-sm leading-relaxed text-muted-foreground` on paragraphs, heading sizes, list padding, `<pre>` styling).
- [ ] **Step 2** Add a sticky side index:

```tsx
<div className="mx-auto grid max-w-[1120px] gap-12 px-6 py-20 lg:grid-cols-[220px_1fr]">
  <nav className="hidden lg:block">
    <div className="sticky top-24 space-y-2 text-[14px]">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="block text-muted-foreground transition-colors hover:text-foreground">
          {s.title}
        </a>
      ))}
    </div>
  </nav>
  <Prose>{/* … */}</Prose>
</div>
```

Declare `SECTIONS` at the top of the file as `const SECTIONS: { id: string; title: string }[]`, one entry per `<h2>` already in the document, with `id` the kebab-case slug of the title. Add the same `id` to each `<h2>` so the anchors resolve, and add `scroll-mt-24` to those headings so the sticky nav does not cover them on jump.

- [ ] **Step 3** Delete both entries from `NOT_YET_MIGRATED`.
- [ ] **Step 4** `cd app && npm run build && node verify.mjs && npx oxlint`
- [ ] **Step 5** `git add app/src/pages/docs.tsx app/src/components/docs.tsx app/verify.mjs && git commit -m "feat(site): docs on Prose, with a sticky index"`

### Task 15: `changelog.tsx`

**Files:** Modify `app/src/pages/changelog.tsx` (83 lines, 7 tinted lines), `app/verify.mjs`

- [ ] **Step 1** Apply the Phase 4 seven steps; version numbers become `font-mono text-foreground`, dates `text-muted-foreground`.
- [ ] **Step 2** `cd app && npm run build && node verify.mjs && npx oxlint`
- [ ] **Step 3** `git add app/src/pages/changelog.tsx app/verify.mjs && git commit -m "feat(site): changelog on the new kit"`

### Task 16: The legal trio

**Files:** Modify `app/src/pages/privacy.tsx`, `terms.tsx`, `refunds.tsx`, `app/src/components/site/legal.tsx`, `app/verify.mjs`

- [ ] **Step 1** Each becomes `Nav` + `Section` + `Prose` + `Footer` and nothing else. If `legal.tsx` already wraps them, put `Prose` there once instead of three times.
- [ ] **Step 2** Delete all three entries from `NOT_YET_MIGRATED`.
- [ ] **Step 3** `cd app && npm run build && node verify.mjs && npx oxlint`
- [ ] **Step 4** `git add app/src/pages/privacy.tsx app/src/pages/terms.tsx app/src/pages/refunds.tsx app/src/components/site/legal.tsx app/verify.mjs && git commit -m "feat(site): legal pages on Prose"`

---

## Phase 6 — Group C, the app surfaces

These take the tokens, not the Synara flow. They are working surfaces, not marketing.

### Task 17: `dashboard.tsx` and its panels

**Files:** Modify `app/src/pages/dashboard.tsx` (395 lines), `app/src/components/settings-panel.tsx`, `licence-panel.tsx`, `connectors-panel.tsx`, `app/verify.mjs`

- [ ] **Step 1** Replace colour with tokens: panel surfaces `bg-card border-border`, primary actions `bg-primary text-primary-foreground`, destructive actions `text-bad`. Success states keep `text-ok` — a licence that verified is a state, and state is where colour is allowed.
- [ ] **Step 2** Delete the `<Dither />` and all four `NOT_YET_MIGRATED` entries.
- [ ] **Step 3** `cd app && npm run build && node verify.mjs && npx oxlint`. `verify.mjs` has dashboard-specific assertions — if they fire, an element it looks for was renamed.
- [ ] **Step 4** `git add app/src/pages/dashboard.tsx app/src/components/*-panel.tsx app/verify.mjs && git commit -m "feat(site): dashboard on the monochrome tokens"`

### Task 18: `viewer.tsx`

**Files:** Modify `app/src/pages/viewer.tsx` (157 lines, 1 tinted line), `app/verify.mjs`

- [ ] **Step 1** Tokens only; the viewer chrome goes `bg-card`, the content area `bg-background`.
- [ ] **Step 2** `cd app && npm run build && node verify.mjs && npx oxlint`
- [ ] **Step 3** `git add app/src/pages/viewer.tsx app/verify.mjs && git commit -m "feat(site): viewer on the monochrome tokens"`

### Task 19: `login.tsx`

**Files:** Modify `app/src/pages/login.tsx` (74 lines), `app/verify.mjs`

- [ ] **Step 1** This is the seam between site and app — it must look like the site, not like a different product. `Nav` + a centred card at `max-w-[400px]`, `bg-card border-border rounded-xl`.
- [ ] **Step 2** Validation errors use `text-bad`. Do not touch the OAuth handoff: `verify.mjs` asserts the login page's script wiring.
- [ ] **Step 3** `cd app && npm run build && node verify.mjs && npx oxlint`
- [ ] **Step 4** `git add app/src/pages/login.tsx app/verify.mjs && git commit -m "feat(site): login page matched to the site"`

---

## Phase 7 — Close it out

### Task 20: Delete the dead identity and fix the workflow

**Files:**
- Delete: `app/src/components/dither.tsx`
- Modify: `app/verify.mjs` (empty the allowlist), `.github/workflows/pages.yml`

- [ ] **Step 1: Confirm nothing imports Dither**

```bash
grep -rn "dither\|Dither" app/src
```

Expected: no output. If there is any, that page was missed — go back and finish it.

- [ ] **Step 2: Delete the component**

```bash
git rm app/src/components/dither.tsx
```

- [ ] **Step 3: Empty the allowlist**

In `app/verify.mjs`, reduce it to:

```js
const NOT_YET_MIGRATED = [];
```

An empty allowlist means the guard now covers every source file, permanently. This is the line that makes the redesign irreversible by accident.

- [ ] **Step 4: Fix the workflow**

In `.github/workflows/pages.yml`, correct the header comment (it still says it publishes `website/`) and the trigger paths — `site/**` fires a deploy of a folder it does not build:

```yaml
# Publishes the static site in app/ to GitHub Pages on every push to main
# that touches it. One-time setup: repo Settings → Pages → Source = "GitHub Actions".

on:
  push:
    branches: [main]
    paths:
      - "app/**"
      - "CHANGELOG.md"
      - ".github/workflows/pages.yml"
  workflow_dispatch:
```

- [ ] **Step 5: Full verification**

```bash
cd app && npm run build && node verify.mjs && npx oxlint
cd .. && pnpm test
```

Expected: all green, and `verify.mjs` prints no failures with an empty allowlist. That is the definition of done.

- [ ] **Step 6: Visual pass**

```bash
cd app && npx vite preview --port 4173
```

Walk all fourteen pages in both themes. Check for: an orange pixel anywhere, a heading in the old display font, a white flash on reload in dark mode, horizontal scroll at 375px.

- [ ] **Step 7: Commit**

```bash
git add app/src/components app/verify.mjs .github/workflows/pages.yml
git commit -m "feat(site): retire the dither, close the guard, fix the Pages trigger"
```

---

## Not in this plan

- Deleting `site/` and `website/`. Tracked separately. `website/auth/` is a live Cloudflare Worker whose tests run in CI through the root `vitest.config.ts`; it must be relocated, not deleted.
- Any change to the desktop app beyond launching it to take screenshots.
- Social proof of any kind.
