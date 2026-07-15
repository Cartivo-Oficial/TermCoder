# Website rewrite — Astro + Tailwind, refined identity, changelog

Date: 2026-07-15
Status: approved (design)
Scope: the marketing/docs/auth website only. No changes to `packages/*`, the
monorepo, CI for the packages, or the release pipeline.

## Context

The live site is a flat static bundle in `website/` (12 hand-written HTML pages
sharing one `style.css`), deployed to GitHub Pages by `.github/workflows/pages.yml`
(which uploads `website/` verbatim — no build step). It has a working, live
OAuth sign-in: `config.js` (public client IDs + Worker URL), `auth.js` (redirect
flow), `callback.html`, `dashboard.html`, and a Cloudflare Worker in
`website/auth/worker.js` (deployed separately, holds the client secrets). A
guard script `website/tools/verify.mjs` enforces site invariants (no inline
`<style>`, no emoji, no pinned version strings, subscription labelled
experimental, required assets present, download links live).

The site already has an intentional, developer-forward identity — dark, mono,
`--accent #ff7a45`, hairline borders, no gradients/heavy shadows, a "spec sheet"
layout (numbered gutters `00`/`01`, `//` mono eyebrows, `LIVE` tags) and a
terminal-window hero replaying a real recorded session. Two design vocabularies
coexist: the newer `.sys-*` language (index) and the older `.head/.frow/.cmd`
classes (earlier pages). The rewrite is a chance to unify them.

The user chose: **Astro + Tailwind + React islands (shadcn where useful)**,
**refine and elevate the current identity** (keep the dark/mono/terminal soul),
and **incremental migration with OAuth preserved** (the live site never breaks;
deploy switches only at parity). A **Changelog page** (new) is folded in,
generated from the existing `CHANGELOG.md`.

## Goals

- Re-author the site as an Astro project (`site/`) with Tailwind and React
  islands, replacing 12 copy-pasted HTML files with shared components.
- Preserve the exact public URLs (`/features.html`, `/callback.html`, …) and
  the OAuth contract byte-for-byte, so registered redirect URIs and inbound
  links keep working.
- Elevate the existing identity: unify the two vocabularies, tighten the
  typographic scale and spacing, add tasteful micro-motion, keep it dark/mono.
- Add a `/changelog.html` page generated from `CHANGELOG.md`, rendered as a
  version timeline, linked in the nav.
- Keep the live `website/` deploy untouched until the Astro build reaches
  parity, then switch `pages.yml` in one final step.

## Non-goals

- No changes to `packages/*`, `pnpm-workspace.yaml`, package CI, or releases.
  `site/` sits at the repo root, is **not** matched by `packages/*`, and has its
  own `package.json`/lockfile installed only in the Pages workflow.
- No new OAuth apps, no secret changes, no Worker rewrite. `auth/worker.js`
  stays as-is (kept in the repo for reference; deployed separately by the user).
- No content rewrite beyond what parity + the new changelog require. The copy
  stays; the identity and authoring change.
- No custom domain / DNS work.

## Architecture

### Project layout (`site/`)

```
site/
  package.json            # astro, @astrojs/react, react, @tailwindcss/vite, tailwindcss
  astro.config.mjs        # output: static; build.format: 'file' (emits *.html at root)
  tailwind.config is CSS-first (Tailwind v4 @theme) — no JS config needed
  src/
    styles/global.css     # @import "tailwindcss"; @theme tokens; base layer
    layouts/Layout.astro  # <html><head> meta + <Nav/> + <slot/> + <Footer/>
    components/
      Nav.astro  Footer.astro
      Hero.astro                 # terminal window; mounts <TermReplay client:idle/>
      CommandBox.astro           # mounts <CopyButton client:visible/>
      FeatureRow.astro  Steps.astro  Cta.astro  SpecSection.astro
      DownloadCards.tsx (island) # OS detection
      ChangelogTimeline.astro
      react/TermReplay.tsx  CopyButton.tsx  Auth islands as needed
    pages/
      index.astro features.astro study.astro install.astro download.astro
      docs.astro viewer.astro pricing.astro changelog.astro
      login.astro dashboard.astro
    data/changelog.ts     # parses ../../CHANGELOG.md at build into versions[]
  public/
    callback.html         # OAuth callback — verbatim copy, byte-identical
    auth.js config.js     # OAuth client — verbatim copies
    favicon.png mark.png app.png logo.png hero-session.js
    fonts/…
  worker/                 # auth/worker.js + wrangler.toml + README (reference; not served)
  tools/verify.mjs        # rewritten to validate site/dist
```

### URL preservation

`build.format: 'file'` makes Astro emit `features.astro → features.html` at the
output root, matching every current URL. `login`/`dashboard`/`changelog` follow
the same rule. `callback.html`, `auth.js`, `config.js` live in `public/` so they
copy to the output root **unchanged** — the OAuth `redirect_uri`
(`https://<site>/callback.html`) and the `?v=N` cache-bust pattern keep working.
No registered OAuth app changes.

### OAuth strategy (the key risk)

The OAuth machinery is **not rewritten**. `auth.js`, `config.js`, and
`callback.html` are copied verbatim into `public/`. `login.astro` and
`dashboard.astro` reproduce the current markup and load the same
`config.js`/`auth.js` via `<script>` tags (same load order). This keeps the flow
identical while letting the pages share the new `Nav`/`Footer`/`Layout`. The
Cloudflare Worker is untouched.

### Islands (interactivity)

Only these ship JS, via `client:*` directives:
- `TermReplay` — types the recorded `window.HERO_SESSION` into the hero terminal
  (ports `hero.js`, honoring `prefers-reduced-motion`). `client:idle`.
- `CopyButton` — copy-to-clipboard on command boxes. `client:visible`.
- `DownloadCards` — detects the visitor's OS and highlights the right installer.
  `client:load`.
- Auth: `login`/`dashboard` keep the existing plain `auth.js` (not a React
  island) to stay byte-compatible — no rewrite.

### Deploy cutover (zero downtime)

`website/` keeps deploying (current `pages.yml`) through phases A–D. Only in
phase E does `pages.yml` change to: checkout → setup-node → `cd site && npm ci
&& npm run build` → upload `site/dist`. Before flipping, parity + OAuth are
verified. The old `website/` dir is removed in the same cutover commit (or kept
one release as a fallback — decided at cutover).

## Design system

Port the current tokens into a Tailwind v4 `@theme` block in `global.css`:
`--color-bg #0b0b0c`, `--color-panel #0f0f11`, `--color-line #232327`,
`--color-fg #e7e7ea`, `--color-muted #9a9aa3`, `--color-faint #5c5c64`,
`--color-accent #ff7a45`, mono + sans font families. Components use Tailwind
utilities + a thin `@layer components` for the recurring primitives
(`.eyebrow`, `.spec-section`, `.term`, `.cmd`, `.btn`). "Refine and elevate"
means: one unified vocabulary (fold the old `.head/.frow` pages onto the `.sys`
spec-sheet language), a tighter type scale, consistent section rhythm, subtle
scroll/hover micro-motion (respecting `prefers-reduced-motion`), and a
distinctive changelog timeline — not a new palette.

## Changelog

`src/data/changelog.ts` reads `../../CHANGELOG.md` at build time and parses it
into `{ version, title?, body }[]` (splitting on `## <version>` headings; the
release notes stay authored in `CHANGELOG.md`). `changelog.astro` renders a
vertical **timeline**: each version is a node (version tag in accent mono, its
title, the body prose). A "Changelog" link is added to `Nav`. Future releases
only edit `CHANGELOG.md`.

## Migration phases (each independently reviewable)

- **Phase A — Foundation + index at parity.** Scaffold `site/` (Astro + Tailwind
  v4 + React island), port tokens into `global.css`, build `Layout`/`Nav`/
  `Footer`, port the hero (`TermReplay` island + `hero-session.js`), and migrate
  `index.html` → `index.astro` at refined visual parity. `npm run build`
  succeeds; index renders. Deploy NOT switched.
- **Phase B — Marketing pages.** Migrate features, study, install, download
  (`DownloadCards` island), docs, viewer, pricing to Astro components at refined
  parity. Extract shared primitives (`CommandBox`, `FeatureRow`, `Steps`,
  `Cta`, `SpecSection`).
- **Phase C — Changelog.** `changelog.ts` parser + `ChangelogTimeline` +
  `changelog.astro` + nav link, from `CHANGELOG.md`.
- **Phase D — OAuth pages.** `login.astro`, `dashboard.astro`, and the verbatim
  `public/` OAuth files (`callback.html`, `auth.js`, `config.js`), preserving
  the flow. Local smoke: config loads, callback page resolves, unconfigured
  buttons fall through to the dashboard preview (as today).
- **Phase E — Cutover.** Rewrite `tools/verify.mjs` to validate `site/dist`
  (same invariants), switch `pages.yml` to build Astro, verify full parity +
  OAuth live, remove/retire `website/`.

## Verification strategy

- **Per page:** build `site/dist`, serve it locally, and compare each page
  against the current live page in the Browser pane (structure + visual parity),
  using the established before/after screenshot method. The refined identity may
  intentionally differ; note deliberate changes.
- **verify.mjs (phase E):** same invariants as today, run against `site/dist`:
  no emoji, no pinned versions outside code, subscription=experimental, required
  assets present, `--links` checks the real installer URLs return 200.
- **OAuth (phase D/E):** confirm `config.js` is present and unchanged, the
  callback page loads, and the sign-in buttons behave (configured → redirect;
  unconfigured → dashboard preview). Full end-to-end login is the user's to
  confirm against the live Worker after cutover.
- **No package tests affected:** `site/` is outside the pnpm workspace; the
  existing `pnpm vitest run` suite is untouched.

## Risks / open items

- **OAuth breakage** is the top risk; mitigated by verbatim `public/` passthrough
  + URL preservation (`build.format: 'file'`) + a pre-cutover smoke test.
- **Visual parity vs "elevate":** each deliberate design change is called out in
  review so parity checks don't flag intended improvements.
- **Build in CI:** the Pages workflow gains a Node build step; pin Node 20 and
  commit `site/package-lock.json` for reproducible `npm ci`.
- **Tailwind v4** is CSS-first (`@theme`, `@tailwindcss/vite`); if the toolchain
  proves troublesome, fall back to Tailwind v3 + `@astrojs/tailwind` (noted so
  the implementer doesn't churn).
- **`website/` retirement:** keep it one release as a fallback or remove at
  cutover — decided with the user at phase E.
