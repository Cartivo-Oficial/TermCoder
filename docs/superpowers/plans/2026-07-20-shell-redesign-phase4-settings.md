# Settings Visual Polish (Redesign Phase 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Settings panel's visual language in line with the calm redesigned Home — breathing room, softer nav, clearer rows — via CSS only, changing no settings logic.

**Architecture:** Pure CSS refinement of the existing `.settings*` / `.srow` / `.switch` rules in `styles.css`. No markup, no handlers, no tabs change.

**Tech Stack:** CSS (existing token system).

## Global Constraints

- **No code comments.** Do not add comments to any code you write.
- **Preserve CRLF** on `packages/desktop/src/renderer/styles.css` (`core.autocrlf=true`; check the working-tree file).
- **CSS only.** Do not edit `Settings.tsx` or any handler/state/tab. Do not add or reorder settings.
- **Tokens only** — every value from `--bg`/`--elev`/`--elev2`/`--border`/`--muted`/`--text`/`--faint`/`--accent`/`--r-*`. Never hardcode the ember; all themes must keep working.
- Do not break the 920px row layout or the modal-overlay model.
- pnpm workspace. Typecheck: `pnpm --filter @termcoder/desktop typecheck` (build core+server first if needed). Web build: `pnpm --filter @termcoder/desktop build:web`.

---

### Task 1: Refine the settings CSS

**Files:**
- Modify: `packages/desktop/src/renderer/styles.css`

The current rules to refine live at ~629-641 (`.settings-head`, `.settings-body`, `section`, `h4`), ~799-806 (`.settings-card.big`, `.settings-nav`, nav buttons), ~830-832 (`.switch`), plus `.srow*` and `.sn-group` (search for them). Read each before replacing so you match the real current declaration.

- [ ] **Step 1: Refine the card + head + body + sections**

Replace the current `.settings-head`, `.settings-body`, `.settings-body section`, `.settings-body h4` rules with:

```css
.settings-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 18px; letter-spacing: -0.01em; }
.settings-body { overflow-y: auto; padding: 8px 24px 24px; }
.settings-body section { padding: 20px 0; border-bottom: 1px solid var(--border); }
.settings-body section:last-child { border-bottom: none; }
.settings-body h4 { margin: 0 0 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--faint); font-weight: 600; }
```

And refine `.settings-card.big` (found ~799) — keep its width/height/flex-direction, just soften the container. Replace with:
```css
.settings-card.big { width: min(940px, 94%); height: 84vh; flex-direction: row; border-radius: var(--r-lg); }
```

- [ ] **Step 2: Soften the nav**

Replace the `.settings-nav`, `.settings-nav button`, `.settings-nav button:hover`, `.settings-nav button.active` rules (~800-804), and add/refine `.sn-group`:

```css
.settings-nav { width: 208px; flex-shrink: 0; border-right: 1px solid var(--border); padding: 14px 12px; display: flex; flex-direction: column; gap: 1px; overflow-y: auto; }
.sn-group { font-size: 10px; text-transform: uppercase; letter-spacing: 0.13em; color: var(--faint); font-weight: 600; padding: 14px 12px 6px; }
.settings-nav > div:first-child .sn-group { padding-top: 2px; }
.settings-nav button { display: flex; align-items: center; gap: 10px; text-align: left; background: transparent; border: none; color: var(--muted); border-radius: 8px; padding: 8px 12px; font-family: inherit; font-size: 13px; cursor: pointer; transition: background .12s ease, color .12s ease; }
.settings-nav button:hover { background: var(--elev); color: var(--text); }
.settings-nav button.active { background: var(--elev2); color: var(--text); box-shadow: none; }
```
(The active state becomes a calm filled pill; the hard inset accent bar is dropped.)

- [ ] **Step 3: Refine the rows**

Find the `.srow`, `.srow-text`, `.srow-title`, `.srow-desc`, `.srow-ctl` rules (search `.srow`). Replace them (or add if missing) with:

```css
.srow { display: flex; align-items: center; gap: 20px; padding: 14px 0; }
.srow + .srow { border-top: 1px solid color-mix(in srgb, var(--border) 55%, transparent); }
.srow-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.srow-title { font-size: 13.5px; color: var(--text); }
.srow-desc { font-size: 12px; color: var(--muted); line-height: 1.45; max-width: 62ch; }
.srow-ctl { flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
```

- [ ] **Step 4: Harmonize controls**

Refine `.settings-select` and `.settings-input` radii/padding to match, and leave `.switch` as-is if it already looks right. Replace the `.settings-select` and `.settings-input` base rules with:
```css
.settings-select { background: var(--elev); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 8px 11px; font: inherit; outline: none; cursor: pointer; }
.settings-input { background: var(--elev); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 8px 11px; font: inherit; outline: none; min-width: 220px; transition: border-color .12s ease; }
.settings-input:focus, .settings-select:focus { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
```
Keep any specialized `.settings-select { width: 100% }` / `.settings-input { flex: 1 }` overrides that exist elsewhere (do not remove them) — only refine the base rule shown here.

- [ ] **Step 5: Typecheck + web build**

Run: `pnpm --filter @termcoder/desktop typecheck` then `pnpm --filter @termcoder/desktop build:web`.
Expected: both clean (CSS-only, so typecheck is unaffected; build confirms valid CSS).

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/renderer/styles.css
git commit -m "style(desktop): calmer, more spacious settings panel to match the redesign"
```

- [ ] **Step 7: Manual gate (controller drives in the running app)**

Cannot be automated in-plan. The controller will open Settings and page through several tabs (General, Providers, Permissions, Behavior), confirming:
- The panel reads calmer and more spacious; the nav is softer with a filled-pill active state and quiet group labels; section rows are aligned with descriptions sitting quietly under titles.
- Every control still works: toggles flip, selects open and change, inputs accept text, buttons act.
- Nothing overflows or misaligns at the ~940px width; the body scrolls cleanly.
- Light + dark + one alternate color theme all look right (nothing hardcoded the ember).

---

## Self-Review

**Spec coverage:**
- Card & chrome calmer → Step 1 (`.settings-card.big` radius, `.settings-head` lighter). ✅
- Nav softened (UI font, quiet group labels, calm active) → Step 2. ✅
- Sections & rows more breathing room, aligned → Steps 1, 3. ✅
- Controls harmonized → Step 4. ✅
- Tokens only, all themes → every value is a token / `color-mix` on tokens. ✅
- No logic/tab change; CSS only → only `styles.css` touched. ✅

**Placeholder scan:** Complete CSS in every step; no TBD.

**Type consistency:** N/A (CSS only). Class names (`.settings-head`, `.settings-body`, `.settings-nav`, `.sn-group`, `.srow`, `.srow-text`, `.srow-title`, `.srow-desc`, `.srow-ctl`, `.settings-card.big`, `.settings-select`, `.settings-input`) all match the real markup in `Settings.tsx` (`Row` renders `.srow`/`.srow-text`/`.srow-title`/`.srow-desc`/`.srow-ctl`; nav renders `.sn-group`).

**Risk:** low — pure CSS on an existing structure. The only care needed is preserving specialized control overrides (Step 4 note) and matching the real current declarations before replacing. The manual gate confirms no misalignment and that controls still work.
