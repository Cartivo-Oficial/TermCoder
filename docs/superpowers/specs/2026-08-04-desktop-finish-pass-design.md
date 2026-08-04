# Desktop finish pass — the token vocabulary the theme system never had

Date: 2026-08-04
Status: approved design, pending implementation plan
Area: `packages/desktop/src/renderer` (`styles.css` and every surface that consumes it)

## Summary

The desktop already has a mature *theme* system — an ember accent, several colour themes, light and dark, density and motion modifiers. What it does not have is a *finish* vocabulary: no spacing scale, no type scale, no elevation ladder, no single focus treatment. The result is 7,293 lines of CSS carrying **84 distinct pixel values, 18 font sizes and 36 box-shadows**.

This pass adds that vocabulary, collapses the existing values onto it, and extracts the four UI patterns that repeat most into primitives. It changes no colour, deletes no theme, and takes no capability away.

The reference for the level of finish is [trysynara.com](https://github.com/Emanuele-web04/synara)'s desktop client. This spec takes its *design standard*, not its code — see *Relationship to Synara*.

## Why

The author compared the desktop against Synara and found ours less finished. The gap is not colour — ours is arguably more flexible, since the accent is user-themeable. The gap is that Synara's spacing, type and elevation come from a system, and ours come from whatever number was typed at the time.

The evidence is in the distribution. The most-used values are `8px` (363×), `12px` (327×), `10px` (260×), `6px` (244×), `4px` (239×) and `5px` (169×). `5px` and `6px` are doing the same job; so are `10px` and `12px`. That is not a system with exceptions — it is the absence of one, and it is why the app reads as less considered than it is.

## Scope

This is the first of three projects the author approved, to run in order:

1. **Finish pass** (this spec) — the token vocabulary and the four primitives.
2. **Dense workspace** — sessions, diff and terminal visible at once, in the spirit of Synara's working surface. Will restructure `IDELayout.tsx`.
3. **Real orchestration** — one protocol adapter per external CLI, replacing today's PATH launcher.

Each ships value alone and gets its own spec.

## Goals

- A spacing scale, a type scale, an elevation ladder and one focus treatment, all as tokens.
- The 84 pixel values, 18 font sizes and 36 shadows collapsed onto those scales.
- Four primitives — `Btn`, `Row`, `Panel`, `Chip` — covering the patterns that actually repeat.
- A guard that fails the build when a value outside the scale appears, so the finish does not regress.
- Every existing theme, density and motion setting still works, unchanged.

## Non-goals

- **No colour change.** `--accent`, the colour themes, light/dark, `data-density` and `data-motion` are untouched. A user on a purple theme stays on a purple theme.
- **No structural refactor.** `IDELayout.tsx` is 2,772 lines and needs splitting, but project 2 rewrites that surface — splitting it now is work thrown away in a week.
- **No new primitives beyond the four.** `Field`, `Toolbar` and `Dialog` are deliberately excluded; project 2 will reveal what else earns its place.
- **No code copied from Synara** in this project (see below).

## Relationship to Synara

`Emanuele-web04/synara` is MIT licensed, copyright T3 Tools Inc. Two things follow.

**What we take here: the standard, not the source.** Design conventions — spacing rhythm, surface hierarchy, restraint in shadows — are not copyrightable expression, and this project writes its own tokens against our own theme system. No attribution obligation arises because nothing is copied.

**What would require attribution:** if a later project lifts a self-contained module of theirs — `file-icons.ts`, `timestampFormat.ts`, `truncateTitle.ts` and `terminalVisualIdentity.ts` are the plausible candidates — MIT requires their copyright and permission notice to travel with it. That is a decision for project 2 or 3, made explicitly, not a side effect.

Worth recording so nobody re-derives it: Synara is a **web app with an Electron wrapper**, not a desktop app. Its UI is `apps/web` — 378 `.tsx` files, 119,041 lines, roughly nine times our whole renderer — and its `apps/desktop` (40,494 lines) is process plumbing. More importantly it is an **orchestrator**: a Node server that spawns Claude Code, Codex, Cursor and five others as subprocesses and streams their structured events. Its density exists to hold eight third-party agents at once. TermCoder *is* the agent. Copying its layout wholesale would build interface for a capability we do not have.

## The token layer

Added to `packages/desktop/src/renderer/styles.css` alongside the existing 28 tokens.

### Spacing

```css
--s-1: 2px;  --s-2: 4px;  --s-3: 6px;   --s-4: 8px;   --s-5: 12px;
--s-6: 16px; --s-7: 24px; --s-8: 32px;  --s-9: 48px;
```

The 84 values collapse onto these. `5px` becomes `--s-2` or `--s-3` and `10px` becomes `--s-4` or `--s-5` depending on the job that space is doing — this is a judgement per site, not a find-and-replace. Where a value genuinely cannot be expressed on the scale (an optical alignment nudge, a hairline), it stays, and gets a comment saying why.

### Type

Only `--mono` is tokenised today; body type is inherited or ad hoc, and one surface still reaches for Georgia.

`--mono` keeps its name — renaming it would touch every call site for no gain.

```css
--sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif;
--fs-1: 11px; --fs-2: 12px; --fs-3: 13px; --fs-4: 15px;
--fs-5: 18px; --fs-6: 24px; --fs-7: 32px;
--fw-regular: 400; --fw-medium: 500; --fw-semibold: 600;
--lh-tight: 1.25; --lh-body: 1.55;
```

18 sizes collapse to 7.

### Elevation

Four steps, each paired with the surface token it belongs on:

```css
--shadow-rgb: 0 0 0;                                   /* per theme; light themes override */
--sh-flat: none;                                       /* on --panel */
--sh-raised: 0 1px 2px rgb(var(--shadow-rgb) / 0.16);  /* on --elev */
--sh-float: 0 8px 24px -8px rgb(var(--shadow-rgb) / 0.32);   /* menus, popovers */
--sh-modal: 0 24px 64px -16px rgb(var(--shadow-rgb) / 0.48); /* dialogs */
```

36 shadows collapse to 4. They compose from `--shadow-rgb` rather than hardcoding black, so a light theme can soften or retint them — a black shadow on a light surface is the giveaway that a dark-first app was ported badly.

### Focus

One `--ring` token and one treatment, replacing 35 scattered `outline` / `focus-visible` declarations. Every interactive element gets a visible, consistent focus indicator — today there is no guarantee they agree.

## The primitives

Four, chosen by measured repetition, in `packages/desktop/src/renderer/ui/`:

| primitive | uses today | what it settles |
| --- | --- | --- |
| `Btn` | 74 | the most-copied element in the app; size and tone variants, one focus treatment |
| `Row` | 42 (`row` + `item` + `list`) | the list line — session, file, connector, deck. Every panel currently reinvents it |
| `Panel` | 27 (`card` + `panel`) | a surface with head, body and border, paired with an elevation step |
| `Chip` | 18 | `.chip` has **12 separate CSS rules** defining it. The clearest case of a pattern that became a dialect |

Each is presentational, takes no effects, and reads only tokens. They wrap existing markup rather than replacing behaviour: a swept surface keeps its handlers and its state, and changes what it renders them into.

## The sweep

By surface, not by file — `App.tsx` and `IDELayout.tsx` each contain several surfaces and are not useful units. Order follows what a user meets first:

1. Home (`Hero.tsx`, `Welcome.tsx`)
2. Composer and chat (`App.tsx`, `MessageParser.tsx`, `ToolCard.tsx`)
3. Rail and sessions (`Rail.tsx`, `SessionsPanel.tsx`, `ViewSwitcher.tsx`)
4. Terminal (`TerminalDeck.tsx`, `TerminalGrid.tsx`, `TerminalPane.tsx`)
5. Settings (`Settings.tsx`)
6. Side panels (`SidePanel.tsx`, `RecipesPanel.tsx`, `ClassroomPanel.tsx`, `ModelBrowser.tsx`, `Study.tsx`)
7. Dialogs and the command palette (`CommandPalette.tsx`, `FilePreview.tsx`)

`IDELayout.tsx` is swept for tokens but not restructured.

## Verification

There is no `verify.mjs` here, so this project builds its own guard — the mechanism that worked on the website, for the same reason: without it, "finish" is an opinion and regresses the following week.

**`packages/desktop/src/renderer/styles.guard.test.ts`** reads `styles.css` and fails on:

- a spacing value in `padding`, `margin` or `gap` that is not on the scale and not annotated. The exemption is a comment on the same line reading `/* off-scale: <reason> */` — the guard requires the reason, so an exemption is always a sentence somebody wrote, never a silent escape
- a `font-size` outside `--fs-1..--fs-7`
- a `box-shadow` that is not one of the four tokens
- an `outline` declaration that bypasses `--ring`

It carries a shrinking allowlist of not-yet-swept surfaces, exactly as the website guard did, and the last task empties it. It runs through the root `vitest.config.ts`, which already includes `packages/*/src/**`.

Per surface, additionally: `pnpm --filter @termcoder/desktop typecheck` clean, `pnpm test` with no new failures against the recorded baseline, and **a visual check in at least one light theme and one dark theme**. The app ships multiple colour themes; changing spacing without looking at light mode is how the website's dither survived three phases unnoticed.

## Risks

| risk | mitigation |
| --- | --- |
| A "collapse to the scale" sweep changes layout somewhere subtly and nobody notices | sweep by surface with a visual check per surface, not one big pass |
| The guard's allowlist becomes permanent | the final task empties it and the guard then covers the whole file, as on the website |
| Primitives drift from the markup they replaced (a lost `aria-label`, a dropped handler) | primitives are presentational only; behaviour stays in the calling component |
| Light themes break because a shadow assumes a dark background | shadows derive from theme colour, and the per-surface check requires one light theme |
| Project 2 invalidates this work on the workspace | `IDELayout.tsx` is deliberately tokenised but not restructured; the tokens survive the rewrite, the layout was never the deliverable |
