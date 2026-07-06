# Desktop Redesign — "Terminal Soul" — Design

**Status:** approved (brainstorming) — ready for an implementation plan.
**Date:** 2026-07-06
**Bundle:** "O Motor" mega update. Goal: the desktop stops looking like OpenCode and becomes unmistakably termcoder, by bringing the CLI/site identity in with desktop-grade polish.

## Diagnosis

The desktop's default theme is "Mono": cold neutral charcoal with a **near-white accent** (`#e6e6e7`), system sans everywhere, no brand element. The termcoder identity (TUI + website) — ember orange `#ff7a45`, monospace-as-identity, twinkling starfield, two-tone block TERM/CODER wordmark, `❯` prompt glyph — never reached the desktop. This is a deep reskin, not a relayout.

## Decisions

- **One direction, executed fully:** warm charcoal + ember accent + dual-type system + three signature elements.
- **Structure untouched:** sidebar → chat → panels layout, all flows/features, i18n keys, keyboard shortcuts survive unchanged.
- **Theme system kept:** `COLOR_THEMES` stays; a new **Ember** theme becomes the default (`id: "default"` is replaced — see Migration); the old Mono look remains selectable.
- **Comment-free code** (user rule). No new runtime dependencies; starfield is CSS/JS in the renderer, honoring `prefers-reduced-motion`.

## 1. Tokens (styles.css `:root` — the new default)

| Var | New value | Today |
|---|---|---|
| `--bg` | `#0C0B0A` | `#0b0b0c` (cold) |
| `--panel` | `#100F0D` | `#0e0e0f` |
| `--panel2` | `#0E0D0B` | `#0c0c0d` |
| `--elev` | `#1A1816` | `#161617` |
| `--elev2` | `#232019` | `#1d1d1f` |
| `--border` | `#232019` | `#1c1c1f` |
| `--text` | `#ECEAE6` | `#e6e6e7` |
| `--muted` | `#948F86` | `#8a8a90` |
| `--faint` | `#5C5850` | `#57575d` |
| `--accent` | `#FF7A45` | `#e6e6e7` (near-white!) |
| `--accent-dim` | `rgba(255,122,69,.14)` | (new — hover/selection washes) |
| `--ok / --warn / --bad` | unchanged | soft status colors stay |
| `--radius`, `--ease` | unchanged | |

New: `--mono: ui-monospace, "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace;`

Contrast floor: all text-on-bg pairs stay ≥ 4.5:1; `--accent` on `--bg` is used for glyphs/borders/highlights, not long text.

## 2. Type system (the personality move)

- **Chrome = monospace** (`--mono`, 11–12.5px): sidebar section headers, tab labels, badges/chips, timestamps, status bar, button labels in the chrome (Settings nav, model chip, agent chip), Settings section titles.
- **Conversation = sans** (existing stack): chat bubbles, inputs, settings body copy — readability untouched.
- **Eyebrow pattern** (from the site): sidebar/Settings section headers become mono, uppercase, letter-spaced, `--faint`, with a `//` prefix — e.g. `// SESSIONS`, `// PROVIDERS`. One shared CSS class (`.eyebrow`).

## 3. Signature elements (three, no more)

1. **Prompt spine:** the composer input gets a `❯` glyph in `--accent` at its left (mono, vertically centered), mirroring the CLI. Focus ring on the composer uses `--accent` at 40% instead of today's neutral.
2. **Hero empty state:** the chat empty state becomes the CLI/site hero — two-tone block TERM (ember) / CODER (warm-white) wordmark rendered as text-shadow-free `<pre>` blocks (same glyph art as the site), over a subtle starfield (absolutely-positioned twinkling glyph spans, CSS `@keyframes` opacity, ~20 stars, disabled under `prefers-reduced-motion`; implementation mirrors `website/index.html`'s `.stars`). Existing empty-state content (free-hint button, upgrade card) sits beneath it.
3. **Custom titlebar:** the window is already `frame: false`; add a slim (36px) drag-region titlebar: 16px brand mark (existing `Logo.tsx`), mono lowercase `termcoder` title, and min/max/close window controls (wired through the existing preload IPC if present; add the three IPC handlers in main if absent). `-webkit-app-region: drag` on the bar, `no-drag` on controls.

## 4. Theme system changes (`themes.ts`)

- New default: `{ id: "default", name: "Ember", dark: true, accent: "#FF7A45", vars: {} }` — the `:root` values ARE Ember, so its `vars` stay empty.
- The old look is preserved as `{ id: "mono", name: "Mono", dark: true, accent: "#e6e6e7", vars: { …today's cold charcoal values… } }`.
- `paper` (light) keeps its structure but its accent becomes `#E8632C` (ember darkened for light-bg contrast). Other themes unchanged.
- `THEME_VARS` gains `--accent-dim`; each theme may override it (Ember's default dim derives from the accent; for other themes compute `rgba(accent, .14)` inline in the theme entries).
- **Migration:** users who had `theme: "default"` saved simply get Ember (intended — the redesign IS the default). No config migration needed since `mono` is a new id.

## 5. Component-level touches (all reskin, no behavior change)

- `App.tsx`: titlebar mount; empty-state hero; composer `❯`; sidebar eyebrows; status-bar strip to mono.
- `Welcome.tsx`: recolor to ember tokens (its gradient glows already orange-ish — align to `#FF7A45`), mono eyebrows.
- `Settings.tsx`: nav labels + section titles to mono/eyebrow; no structural change.
- `Study.tsx`, `ModelBrowser.tsx`, `CommandPalette.tsx`: inherit tokens automatically; spot-check chips/badges pick up `--mono`.
- `index.html` (renderer): preload the mono font stack only via system fonts — no webfont download (CSP + offline).

## 6. Out of scope

- Structural relayout, new panels, feature changes.
- The TUI and website (already carry the identity).
- Light-theme redesign beyond the Paper accent swap.
- New settings UI for themes (the picker already exists).

## 7. Verification

- `cd packages/desktop && npx tsc --noEmit` clean; `pnpm --filter @termcoder/desktop build` succeeds.
- Launch the dev app (strip `ELECTRON_RUN_AS_NODE` per the known launch quirk) and screenshot: empty state (hero + starfield), a chat in progress (prompt spine, mono chrome), Settings (eyebrows), theme picker showing Ember default + Mono legacy, Paper light theme.
- Reduced-motion check: starfield static when the OS setting is on.
- i18n untouched: en/pt/es render unchanged strings.
