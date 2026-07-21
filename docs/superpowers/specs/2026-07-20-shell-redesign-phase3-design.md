# Desktop shell redesign — Phase 3 (features as options) design

base: e02068a (post Phase 1)
status: design (awaiting user review)

## Problem

In-session, the three views (Chat / Terminal / Canvas) are switched by a stamped `.center-tabs` bar — three uppercase mono buttons always plastered across the top of the center pane (`App.tsx` ~2039-2058). This is the "estampado" chrome the user wants gone. Phase 1 already hides this bar on the Home and offers quiet chips there; Phase 3 removes it **in-session** too.

Decision (user): replace the stamped bar with a **quiet, compact view switcher** — a single control showing the current view's icon plus a small menu to switch, present in every view so returning to chat is always possible.

## Approach

Delete the `.center-tabs` bar. Add a `ViewSwitcher` — one compact, low-emphasis control (current-view icon + chevron) that opens a small menu listing Chat · Terminal · Canvas with a check on the active one. It lives in the persistent top strip of the center (the session-tabs row), right-aligned, and renders only in-session (on the Home, the existing quiet chips already handle terminal/canvas, so the switcher is hidden there). Keyboard shortcuts and the ⌘K palette continue to switch views — the switcher complements them, it doesn't replace them.

Nothing about how the views themselves work changes: `TerminalDeck` and `AgentCanvas` stay mounted and overlay the chat when active (`hidden={centerTab !== …}`), exactly as today. Only the switching affordance changes.

## Components

### `packages/desktop/src/renderer/ViewSwitcher.tsx` (new)

A self-contained dropdown, chipping another piece out of the 2449-line `App.tsx`.

```ts
type View = "chat" | "terminal" | "canvas";
interface ViewSwitcherProps {
  view: View;
  onSelect: (view: View) => void;
}
```

- Renders a compact button: the current view's icon (`IconChat` / `IconServer` / `IconAgents`) + a small label of the current view + a chevron.
- On click, opens a small menu with the three views, each an icon + label, a check on `view`. Selecting calls `onSelect` and closes.
- Closes on outside click / Escape. Quiet styling (reads existing tokens; de-emphasized until hover/open).

### `App.tsx` (modify)

- Remove the `.center-tabs` block (~2039-2058).
- Render `<ViewSwitcher view={centerTab} onSelect={…} />` right-aligned inside the top strip (the `.session-tabs` row), shown only when `!isHome`. `onSelect` maps: `chat` → `setCenterTab("chat")`; `terminal` → `setTermMounted(true); setCenterTab("terminal")`; `canvas` → `setCenterTab("canvas")` (same effects the removed buttons had).
- Ensure the top strip renders in-session even with no open session tabs, so the switcher always has a home: render the strip when `openTabs.length || !isHome`. The session tabs themselves still render only when `openTabs.length`.

### CSS (`styles.css`)

- Remove/retire the `.center-tabs` rules (or leave them unused — retiring is cleaner).
- Add `.view-switcher` (the trigger: compact, quiet, icon + label + chevron; hover/open raises emphasis) and `.view-menu` (a small dropdown of items with a check), styled from existing tokens (`--elev`, `--border`, `--muted`, `--text`, `--accent` for the active check). No hardcoded colors.
- The strip lays the session tabs on the left and the switcher on the right (`justify-content: space-between` or a spacer).

## Data flow

`App` owns `centerTab` / `setCenterTab` / `setTermMounted` → passes `centerTab` + an `onSelect` to `ViewSwitcher` → `ViewSwitcher` is stateless except its own open/closed menu state. No change to view mounting, session protocol, or the views themselves.

## Edge cases

- **Return-to-chat from terminal/canvas:** guaranteed — the switcher is in the persistent strip, present in all in-session views. This is the role the removed bar played.
- **Home:** switcher hidden (Home's quiet chips cover terminal/canvas; chat is the Home itself).
- **Keyboard shortcut** (`toggleTerminal`) and ⌘K palette: unchanged; they set `centerTab` and the switcher reflects the new current view.
- **No open tabs in-session:** the strip still renders (via `openTabs.length || !isHome`) so the switcher is present.

## Testing

- Presentational; no new pure logic. If a tiny helper is added (e.g. mapping a view to its icon/label), unit-test it; otherwise no unit test.
- Manual gate (running app, screenshots): in a session, the stamped CHAT/TERMINAL/CANVAS bar is gone; the quiet switcher shows the current view; opening it lists the three with a check on the current; selecting Terminal opens the terminal view and the switcher updates; from terminal, the switcher returns to Chat; Canvas likewise; the keyboard terminal-toggle and ⌘K still switch and the switcher reflects it; the Home is unaffected (its chips still work, no switcher); light + dark + one alternate color theme.

## Out of scope (logged — later)

- Phase 4 (settings redesign + native menu).
- Any change to the views themselves (terminal grid, canvas, chat).
- Turning terminal/canvas into side/bottom panels instead of full overlays (a different model; not requested).
