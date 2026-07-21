# Desktop shell redesign — Phase 4 (settings visual polish) design

base: 4851f3c (post Phase 3)
status: design (awaiting user review)

## Problem

The Settings panel works and already uses the app's tokens, but it reads as utilitarian and denser than the calm Home + view-switcher just shipped. Phase 4 brings its **visual language into line** with the rest of the redesign — breathing room, a softer nav, clearer row hierarchy — without touching the 1659 lines of settings logic or its tabs.

Decision (user): **visual polish only** — no restructuring of tabs, navigation, or logic.

## Scope

CSS-first refinement of the existing structure:
- `.settings` overlay + `.settings-card.big` (920px row layout)
- `.settings-nav` (left, 200px, grouped tab buttons)
- `.settings-main` → `.settings-head` + `.settings-body` (sections with `h4` labels and rows)
- Controls already themed: `.settings-select`, `.settings-input`, `.switch`, `.settings-btn`

Only CSS, plus the smallest possible markup touch if a settings **row** needs a wrapper to align a title/description/control cleanly (a shared row layout) — and only if the current markup can't be aligned by CSS alone. No change to which settings exist, their order, their tabs, or any handler.

## The polish (what changes)

1. **Card & chrome.** Slightly larger corner radius and a calmer border/shadow so the panel feels like the Home's surfaces. The `.settings-head` becomes lighter (not heavy 700 weight) with the section title reading as a calm display line, and more comfortable padding.
2. **Nav.** Soften the left nav: drop the mono font for the app's UI font, give group labels (the `TABS` group headers) a quiet uppercase treatment with more space, and make the active state calmer (a filled pill or a soft accent, not a hard inset bar). More vertical rhythm between items.
3. **Sections & rows.** More breathing room between sections; `h4` labels quieter and better spaced. Each row (setting title + description + control on the right) gets consistent alignment and spacing so the column of controls lines up and descriptions sit quietly under titles. Increase the gap so it doesn't feel cramped.
4. **Controls.** Keep the existing `.switch`, `.settings-select`, `.settings-input`, `.settings-btn` but harmonize their sizing/radius with the Home's controls (consistent radii, hover states, focus ring) so nothing looks out of place.
5. **Consistency tokens.** Everything derives from existing tokens (`--bg`, `--elev`, `--elev2`, `--border`, `--muted`, `--text`, `--faint`, `--accent`, `--r-*`). No new colors; works across all themes and light/dark.

## What does NOT change

- The list of tabs and settings, their grouping, and their order.
- Any settings handler, state, or logic in `Settings.tsx`.
- The modal-overlay model (it stays a centered `.settings-card.big`).
- The token palette / theme system.

## Components

Primarily `styles.css` (the `.settings*`, `.switch`, and control rules ~627-641, 799-806, 830-832, 785). If a shared row wrapper is warranted, add a small `.settings-row` class and apply it to the repeated title/description/control pattern in `Settings.tsx` — mechanically, without changing any values or handlers. Prefer pure CSS; only touch markup if alignment truly requires it, and report exactly what was wrapped.

## Testing

- No logic change → no unit tests.
- Manual gate (running app, screenshots): open Settings and page through several tabs (General, Providers, Permissions, Behavior) — confirm the calmer, more spacious look, the softer nav and active state, aligned rows, and that every control still works (toggles flip, selects open, inputs accept text, buttons act). Verify light + dark + one alternate color theme, and that nothing overflows or misaligns at the 920px width.

## Out of scope (logged)

- Native menu bar (a separate Phase 4 piece the user deprioritized for now).
- Any settings restructure / new settings / reorganized tabs.
- Turning the modal into a full-page settings route.
