# Website redesign — a monochrome, light-first site in the Synara mould

Date: 2026-08-01
Status: approved design, pending implementation plan
Area: `app/` (the site that ships to GitHub Pages), plus one line in `.github/workflows/pages.yml`

## Summary

The public site is rebuilt around a single reference: [trysynara.com](https://www.trysynara.com/) — clean, light, airy, screenshot-led. That means a new design system (pure greyscale, neutral sans, larger radii, more vertical air), a small marketing component kit, a home page rewritten into Synara's section flow, and the same treatment propagated across all fourteen pages. Light is the default; a toggle in the nav keeps a dark theme that is *also* monochrome.

The orange/teal identity, the pixel display font, and the dithered texture are removed on purpose. This is a deliberate trade of personality for clarity, made with the trade named out loud.

## Why

The site today is dense, dark and brutalist-terminal: fourteen tight sections on the home page, a warm dither behind every page, orange for *build* and teal for *study*. It is distinctive, but it reads as a wall — and pages like `docs.tsx` (660 lines of hand-rolled typography) are expensive to maintain because no layout primitives exist.

Synara solves the same problem — sell a developer tool to developers — with room to breathe, product screenshots doing the explaining, and colour reserved for the product itself. Adopting that shape makes the page easier to read and the codebase easier to change.

## Which site

The repository contains three site folders. Only one ships:

| folder | what it is | status |
| --- | --- | --- |
| `app/` | React 19 + Vite, SSR entry + `prerender.mjs`, Tailwind 4, shadcn primitives | **live** — `pages.yml` builds it and publishes `app/dist` |
| `site/` | an Astro rewrite | dead |
| `website/` | the original static HTML | dead |

All work in this spec happens in `app/`.

## Goals

- Light-first, monochrome, generously spaced — the Synara read.
- A dark theme that is equally monochrome, toggled from the nav, with no flash of the wrong theme on load.
- The home page restructured into Synara's flow, ending in an FAQ and a single clear CTA.
- Five real product screenshots, shot as one series.
- A component kit so the fourteen pages stop re-declaring layout by hand.
- `npm run build && node verify.mjs` green at the end of every phase.

## Non-goals

- No social-proof section. The repository has 1 star and 0 forks; testimonials and counters would have to be invented, and they will not be.
- No redesign of the desktop app itself — this is the website only.
- No deletion of `site/` and `website/` in this work (see *Out of scope*).
- No copy translation. The site stays in English.

## Decisions

Each was chosen explicitly during design:

| question | decision |
| --- | --- |
| how far to follow Synara | full aesthetic — light, airy, clean sans; terminal only inside screenshots |
| scope | all fourteen pages |
| palette | pure monochrome; colour survives only inside screenshots |
| dark theme | kept, monochrome, toggled from the nav; light is the default |
| content | home rewritten into Synara's section flow |
| proof | technical proof (MIT, tool count, provider count, local-first) instead of social proof |
| large visuals | new screenshots captured from the running app |
| type | neutral sans everywhere; mono restricted to code |
| execution | home first as a pilot, then propagate |

## Design system

### Colour

Two neutral ramps, no hue.

| role | light | dark |
| --- | --- | --- |
| background | `#ffffff` | `#0a0a0a` |
| subtle surface | `#fafafa` | `#141414` |
| border | `#e6e6e6` | `rgba(255,255,255,.10)` |
| foreground | `#0a0a0a` | `#f5f5f5` |
| muted foreground | `#6b6b6b` | `#a0a0a0` |
| primary button | black on white | white on black |

Removed from `app/src/index.css`: the orange `--primary`, `--study`, `--study-soft`, `--build-soft`.

Retained: one green and one red, used **only where they encode state** — the `✓ passed` / `✗ 2 type errors` of the autonomous loop, and validation errors on the login and dashboard forms. Nowhere else in the site chrome. The build/study distinction is carried by words and position instead of by hue.

### Type

- **Sans:** Geist, via `@fontsource-variable/geist` — already a dependency in `app/package.json` and never imported. One variable file covers every weight and replaces the two Inter `woff2` files.
- **Mono:** the system stack (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`). No mono webfont ships.
- Headings at weight 600 with tight tracking; body at 400 / 1.6; measure capped near 68ch.
- Scale: `13 · 14 · 16 · 18 · 21 · 28 · 40 · 56 · 72`, with `clamp()` on the top three.

Funnel Display and Departure Mono leave the CSS. Departure Mono may remain in the wordmark alone, at the author's discretion — this is the one place the pixel identity is allowed to survive.

### Space and form

- Container `1120px`.
- Section rhythm rises from `80px` to `112px` of vertical padding on desktop.
- `--radius` rises from `0.375rem` to `0.75rem`; buttons at `8px`.
- Shadows near-invisible. The orange glow utilities (`shadow-primary/70`, `shadow-primary/60`) are deleted.

### Theme toggle

A button in the nav writes the choice to `localStorage` and toggles `class="dark"` on `<html>`. Because the site is prerendered to static HTML, an inline script in the `<head>` of `app/index.html` must read that preference **before first paint** — without it, a dark-theme visitor sees a white flash on every navigation. The current hardcoded `class="dark"` on `<html>` is removed.

## Component kit

New, in `app/src/components/site/`:

| component | role |
| --- | --- |
| `Section` | vertical rhythm, container, optional top rule |
| `Eyebrow` | the small label above a heading (replaces the orange `❯ Cmd`) |
| `Heading` / `Lead` | the two heading sizes and the opening paragraph |
| `Screenshot` | frame, caption, fixed aspect ratio, `loading="lazy"` |
| `FeatureBlock` | text + visual pair, alternating sides |
| `CardGrid` | responsive card grid (providers, tools, connectors) |
| `FAQ` | native `<details>`, no JavaScript |
| `Prose` | running-text typography, for docs and the legal pages |
| `ThemeToggle` | the theme button |

`ui/button`, `ui/card` and `ui/badge` survive, losing their colour variants and taking the new radius. `CopyButton`, `Mark`, `DownloadCards`, `ConnectorsPanel`, `LicencePanel` and `SettingsPanel` keep their behaviour and change skin only.

`components/dither.tsx` is deleted along with the CSS that supports it.

Measured surface of the change: **94 lines carrying a coloured token** across the pages, `<Dither>` on **11 of 14** pages, and six components with colour hardcoded (`site/nav`, `ui/button`, `ui/badge`, `mark`, `docs`, `licence-panel`).

## The home page

| # | block | content | screenshot |
| --- | --- | --- | --- |
| 1 | Hero | headline, subhead, two CTAs, fact line (MIT · 12 providers · 16 tools · Win·mac·Linux · no telemetry) | — |
| 2 | Anchor shot | the app open, full width | yes |
| 3 | Providers | twelve, as cards — *use the model you already pay for, or none at all*; absorbs model routing as a note | — |
| 4 | The builder | read → plan → edit → run → verify, plus the struck-through "to start you need" list | yes |
| 5 | A real shell | chat, editor and terminal in one window; CLI chips detected on `PATH` | yes |
| 6 | Memory + retrieval | what it remembers; `symbols` and `repomap` without embeddings | yes |
| 7 | Autonomous | a goal and a verify command; it loops until the command exits zero | yes |
| 8 | Secondary | four cards: agents/skills/commands/recipes · MCP connectors · the tutor · classrooms and live rooms | — |
| 9 | Security is a feature | local-first, no telemetry, direct-to-provider, no account, per-tool permission | — |
| 10 | Technical proof | MIT · 16 tools · 12 providers · 0 servers holding your code, plus a link to the source | — |
| 11 | FAQ | six questions: API key? free? offline? Windows? where does my data go? how does it differ from Claude Code? | — |
| 12 | Final CTA | install command with copy, two buttons | — |

## The other thirteen pages

**Group A — marketing (5):** `features` `study` `pricing` `download` `install`. Rewritten on the kit, same treatment as home. They hold 40 of the 94 tinted lines; `study.tsx` and `pricing.tsx` are the most tinted. `pricing.tsx` carries the Paddle checkout — the reskin must not touch checkout behaviour.

**Group B — running text (5):** `docs` `changelog` `privacy` `terms` `refunds`. These move onto `Prose`, which is where it pays for itself: `docs.tsx` is 660 lines of manual typography. Docs gains a sticky side index; the three legal pages become little more than content inside `Prose`.

**Group C — app surfaces (3):** `dashboard` `viewer` `login`. Not marketing, and they do not take the Synara flow. They are reskinned through the tokens, plus adjustments to `licence-panel`, `settings-panel` and `connectors-panel`. `login` gets extra care: it is the seam between site and app, and the seam is visible there.

Order: home (pilot, reviewed) → Group A → Group B → Group C. One commit per group.

## Screenshots

Five images, shot as one series so they read as a set rather than as stray captures.

- The desktop app must launch with `ELECTRON_RUN_AS_NODE` stripped from the environment — otherwise no window opens on this machine.
- Fixed 1440×900 viewport at 2×, the same window and the same sample project across all five.
- States: app on open · a build session with a diff · the Terminal tab running tests · memory and retrieval · an autonomous run.
- Saved as WebP in `app/src/assets/`, with explicit `width`/`height` on `Screenshot` to prevent layout shift, and `loading="lazy"` below the fold.
- Dark app screenshots sit on the light page inside a bordered frame with a faint shadow, as Synara does.

**Declared fallback:** if a state cannot be produced presentably, that block falls back to a coded artefact instead of an image, and the substitution is reported — not made silently.

## What is deliberately lost

Named here so none of it reads as an oversight:

- **The orange→teal hero gradient.** *"One terminal. Two minds."* keeps its words; the contrast becomes weight and size.
- **The dither texture.** It exists to grain a dark background amber. In an airy light layout, background texture works against the air.
- **Departure Mono in headings and labels**, and Funnel Display entirely.
- **The "seam" section** (*"Same engine. Different mind."*). Synara's flow has no slot for it; the build→study transition is carried by the secondary cards. It can be reinstated between blocks 7 and 8 if missed.
- **Colour as a build/study signal** throughout the navigation.

## Verification

At the end of every phase:

```bash
cd app && npm run build && node verify.mjs && npx vitest run && npx oxlint
```

`verify.mjs` is an existing and strict guard: it requires at least 11 generated pages by name, the OAuth files (`auth.js`, `config.js`, `callback.html`), and that `callback.html` still loads both scripts and calls `handleCallback`. A broken route fails the deploy instead of publishing a broken site.

Beyond the commands: a visual pass over both themes on every page, and a reload test in dark mode to confirm no flash.

## In scope, additionally

`.github/workflows/pages.yml` triggers on `site/**` but builds `app/` — editing the dead Astro folder currently fires a production deploy. The trigger paths are corrected and the stale header comment (which still claims it publishes `website/`) updated.

## Out of scope

Deleting `site/` and `website/`. They are dead — roughly 900 and 1,500 lines that nothing builds — and after this redesign they will confuse anyone arriving at the repository. Removing two directories is the author's call, and is tracked separately.

## Risks

| risk | mitigation |
| --- | --- |
| Monochrome + neutral sans lands as generic rather than clean | home is built first as a pilot and reviewed before the other thirteen pages are touched |
| A screenshot state cannot be produced presentably | that block falls back to a coded artefact, reported explicitly |
| The reskin disturbs the Paddle checkout on `pricing` | checkout behaviour is left untouched; only presentation changes, verified against `verify.mjs`'s pricing checks |
| Theme flash on prerendered pages | inline pre-paint script in `<head>`, tested by reloading in dark mode |
| Removing the colour misses a line and leaves an orange artefact | grep for `ff7a45`, `31d0b4`, `text-study`, `text-primary`, `shadow-primary` is part of each phase's verification |
