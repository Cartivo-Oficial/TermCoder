# Desktop "Command Deck" redesign — design spec

**Date:** 2026-07-09
**Scope:** `packages/desktop` renderer only (visual + layout). No core/server/preload changes.
**Goal:** a completely new face for the desktop app — reference-quality, screenshot-worthy — while keeping the existing orange/charcoal palette and every existing feature.

Decisions made with the user:

- Identity: **totally new look, same palette** (warm charcoal + orange `#FF7A45`).
- Scope: **full** — layout, navigation, and every component.
- Layout concept: **Command Deck** (icon rail + collapsible sessions + immersive centered chat + floating composer).
- Finish: **controlled cinematic** (subtle glows, deep gradients, glass overlays, soft motion — no neon circus).

## 1. Layout architecture

Today: 38px toolbar on top, three fixed columns (sessions 248px · chat · files 290px), 26px statusbar.

New:

```
┌──┬─────────────────────────────────────────────┐
│  │ thin drag titlebar ················· ─ □ ✕  │
│R │                                             │
│A │  ┌───────────┐                              │
│I │  │ Sessions  │        IMMERSIVE CHAT        │
│L │  │ (collaps- │   (centered column ~760px)   │
│  │  │  ible,    │                              │
│48│  │  Ctrl+B)  │   ╭──────────────────────╮   │
│px│  └───────────┘   │  FLOATING COMPOSER   │   │
│  │                  │ (elevated glow card) │   │
│⚙ │                  ╰──────────────────────╯   │
└──┴─────────────────────────────────────────────┘
```

1. **Icon rail (48px, always visible)** — the app skeleton. Top-to-bottom: termcoder logo (subtle glow), Chat, Files, Study, Agents; bottom: model-health dot, Settings. Tooltips on hover; active item marked by a sliding orange indicator bar. Replaces the button-crowded toolbar. (Rail "Agents" opens the agent manager — the Agents settings tab as a slide-over; *switching* the active agent stays on the composer chip.)
2. **Sessions panel is collapsible** (Ctrl+B), sliding next to the rail. Open by default; the app must look great with it closed (full-bleed chat).
3. **The fixed right column dies.** Files / editor / dashboard become a **slide-over** panel (~420px) that slides in from the right over the chat when its rail icon is clicked, with the chat dimmed/blurred behind. Esc closes.
4. **Chat is a centered document column** (max ~760px), no longer left-anchored. The **floating composer card** is the app's signature piece — border lights up orange on focus.
5. **The statusbar disappears as a gray bar.** Model, agent, ctx%, tokens move to a discreet mono status line above the composer; the health dot lives in the rail.

Nothing is removed — every current feature stays reachable, only reorganized.

## 2. Visual language

**Background with real depth.** The whole app sits on a deep radial gradient: a very subtle orange glow emanating from the composer corner and active rail item, over charcoal that darkens toward the window edges (vignette). No flat `#0C0B0A` anywhere.

**Three-layer surface system:**

- **Base** — the gradient background; chat lives directly on it, panel-less.
- **Surface** — panels (sessions, slide-over): semi-translucent + `backdrop-filter: blur`, hairline border with a top light seam (`inset 0 1px` white at ~4%) — dark frosted glass. Solid-color fallback when blur is unavailable (web mode / GPU off).
- **Floating** — composer, modals, palette: lighter, deep shadow + a 1px orange glow on the border when active. The focused composer lights up like a terminal cursor.

**Palette kept, extended in range:** orange `#FF7A45` stays the only accent, now with 4 intensities (glow 8% · dim 14% · normal · hot `#FF9A3D` for text gradients). Green/amber/red for status only. No new hues.

**Typography with real hierarchy:** session titles and headers at weight ~650 with tight tracking; mono (`Cascadia Code` stack) is the "chrome" signature — labels, metrics, `// ` eyebrows — while conversation stays sans. All numbers (tokens, ctx%) tabular.

**Radius + density contrast:** large radius on floating pieces (16–20px), small on list items (8px). Chat spacing generous; panel spacing dense.

**Light theme** regenerated on the same principles (orange glow works on light too). `data-density="compact"` and `data-motion="off"` keep working.

## 3. Key screens and components

- **Welcome (first run):** same Code vs Study choice, now full-screen over the app gradient (no centered card): large gradient "termcoder" wordmark, subtle animated starfield behind, the two choice cards in the new frosted glass with per-accent glow (blue Code / orange Study).
- **Empty chat (the screenshot screen):** centered hero — block wordmark + tagline + 3 first-prompt suggestion chips ("Explain this repo", "Fix a bug", "Create flashcards" — i18n'd). The current upgrade card becomes a discreet chip below. Floating composer already prominent center-bottom.
- **Messages:** user = right-aligned bubble on glass surface. Assistant = no gray left border; a short (12px) orange spine marker at top + small mono name/time; text flows directly on the background, document-like. Tool calls become **compact collapsible cards** (tool icon + title + colored status; click expands output/diff) instead of today's loose mono text.
- **Composer (signature piece):** floating card with a status line above (model · agent · ctx% in mono + health dot), the textarea, and an action row below — agent/model chips left, mic/attach/autonomy/send right. Send button solid orange (today it's white). Focus = border lights + glow. The working state pulses the composer glow almost imperceptibly (replaces the orb).
- **Slide-overs (right):** Files, editor, dashboard, Study slide in from the right (~420px, glass + blur, chat dimmed). Esc closes. The CodeMirror editor fills the whole slide-over.
- **Palette / modals / settings:** command palette and model browser get the floating glass + glow. Settings keeps its current side-nav structure (it works), reskinned: nav integrated into the glass, `srow` cards on the new surface.

## 4. Motion system

One short, consistent system:

- Panels slide with soft easing (~200ms); slide-overs enter from the right with the chat dimming behind.
- New messages rise 6px with fade (kept from today).
- Composer glow pulses subtly while the agent works.
- The rail's active indicator slides between icons.
- Nothing above ~250ms. `data-motion="off"` and `prefers-reduced-motion` kill everything.

## 5. Implementation shape

95% renderer:

- `styles.css` rewritten on new tokens: layer system (base/surface/floating), glow scale, radius scale, motion scale.
- `App.tsx` (2226 lines) reorganized — extract **`Rail.tsx`**, **`SessionsPanel.tsx`**, **`SidePanel.tsx`** (slide-over host) so App stays manageable.
- `Hero.tsx` / `Welcome.tsx` rebuilt.
- Statusbar markup absorbed into the composer status line.
- `themes.ts` color themes + light theme regenerated over the new tokens.
- i18n: only new strings (suggestion chips, rail tooltips) added to `i18n.ts` (en/pt/es minimum, others fall back).
- Zero changes to core/server/preload. The web build (`vite.web.config.ts`) shares the renderer, so the redesign carries over; blur fallback must be verified there.

## 6. Error handling / graceful degradation

- `backdrop-filter` unavailable → solid panel fallback (feature-queried in CSS).
- Reduced motion / `data-motion="off"` → all animation off (existing mechanism kept).
- ErrorBoundary crash screen restyled to the new tokens (must not reference removed classes).

## 7. Verification

- Run dev app (strip `ELECTRON_RUN_AS_NODE` — see desktop-dev-launch memory).
- Walk the showcase screens: welcome, empty chat, active chat with tools/diffs, slide-overs (files/editor/dashboard/study), settings, palette, model browser, permission overlay.
- Check light theme, compact density, motion-off, and the web build.
- Existing vitest suite stays green (it does not cover the desktop renderer).
