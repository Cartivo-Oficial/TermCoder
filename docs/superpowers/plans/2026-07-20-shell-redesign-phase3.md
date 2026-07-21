# Shell Redesign Phase 3 (quiet view switcher) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stamped in-session CHAT/TERMINAL/CANVAS tab bar with a quiet, compact view switcher.

**Architecture:** Delete the `.center-tabs` bar; add a self-contained `ViewSwitcher` dropdown (current-view icon + chevron → menu of the three views) into the persistent top strip, shown only in-session. View mounting and behavior are unchanged — only the switching affordance changes.

**Tech Stack:** React, TypeScript, CSS (existing tokens).

## Global Constraints

- **No code comments.** Do not add comments to any code you write.
- **Preserve CRLF** on all `packages/desktop/**` files (`core.autocrlf=true`; `git show` renders LF — normal; check working-tree files).
- **No color/theme changes.** New CSS reads existing tokens (`--elev`, `--elev2`, `--border`, `--muted`, `--text`, `--accent`) — never hardcode the ember.
- **Do not change how the views work.** `TerminalDeck`/`AgentCanvas` stay mounted and overlay via `hidden={centerTab !== …}`. Only the switcher changes. The `onSelect` effects must exactly match the removed buttons: chat → `setCenterTab("chat")`; terminal → `setTermMounted(true); setCenterTab("terminal")`; canvas → `setCenterTab("canvas")`.
- Reuse existing i18n keys: `tab.chat`, `tab.terminal`, `canvas.tab`. No new keys.
- pnpm workspace. Typecheck: `pnpm --filter @termcoder/desktop typecheck` (build core+server first in a fresh worktree if it complains). Web build: `pnpm --filter @termcoder/desktop build:web`.

---

### Task 1: `ViewSwitcher` component + CSS

Build the switcher in isolation. Verified by typecheck.

**Files:**
- Create: `packages/desktop/src/renderer/ViewSwitcher.tsx`
- Modify: `packages/desktop/src/renderer/styles.css`

**Interfaces produced:**
- `ViewSwitcher({ view, onSelect }: { view: "chat" | "terminal" | "canvas"; onSelect: (v: "chat" | "terminal" | "canvas") => void })`.

- [ ] **Step 1: Create `ViewSwitcher.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n";
import { IconAgents, IconChat, IconServer } from "./Icons";

type View = "chat" | "terminal" | "canvas";

function ViewIcon({ v }: { v: View }) {
  if (v === "terminal") return <IconServer />;
  if (v === "canvas") return <IconAgents />;
  return <IconChat />;
}

export function ViewSwitcher({ view, onSelect }: { view: View; onSelect: (v: View) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label: Record<View, string> = {
    chat: t("tab.chat"),
    terminal: t("tab.terminal"),
    canvas: t("canvas.tab"),
  };
  const views: View[] = ["chat", "terminal", "canvas"];

  return (
    <div className="view-switcher" ref={ref}>
      <button className="vs-trigger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <ViewIcon v={view} />
        <span>{label[view]}</span>
        <svg className="vs-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="view-menu">
          {views.map((v) => (
            <button
              key={v}
              className={`vs-item ${v === view ? "sel" : ""}`}
              onClick={() => {
                onSelect(v);
                setOpen(false);
              }}
            >
              <ViewIcon v={v} />
              <span>{label[v]}</span>
              {v === view ? (
                <svg className="vs-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l5 5L20 6" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

If `IconChat`/`IconServer`/`IconAgents` are not all exported from `./Icons`, check the real export names (grep `export const Icon` in `Icons.tsx`) and substitute the closest existing icons — report the substitution.

- [ ] **Step 2: Add CSS**

Append to `styles.css`:
```css
.view-switcher { position: relative; margin-left: auto; }
.vs-trigger { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 8px; background: transparent; border: 1px solid transparent; color: var(--muted); font-size: 12px; cursor: pointer; }
.vs-trigger:hover, .vs-trigger[aria-expanded="true"] { color: var(--text); background: var(--elev); border-color: var(--border); }
.vs-trigger > svg { width: 14px; height: 14px; }
.vs-chev { width: 12px; height: 12px; opacity: 0.6; }
.view-menu { position: absolute; top: calc(100% + 6px); right: 0; min-width: 172px; background: var(--elev); border: 1px solid var(--border); border-radius: 10px; padding: 5px; box-shadow: 0 12px 30px -12px #000000aa; z-index: 30; }
.vs-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 7px 9px; border-radius: 7px; background: transparent; border: none; color: var(--text); font-size: 12.5px; cursor: pointer; }
.vs-item:hover { background: var(--elev2); }
.vs-item > svg { width: 14px; height: 14px; }
.vs-item.sel { color: var(--accent); }
.vs-check { margin-left: auto; width: 13px; height: 13px; }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @termcoder/desktop typecheck` (build core+server first if it fails resolving `@termcoder/server`).
Expected: no errors. `ViewSwitcher` is unused until Task 2 — fine.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer/ViewSwitcher.tsx packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): ViewSwitcher component for quiet in-session view switching"
```

---

### Task 2: Wire the switcher in + remove the stamped bar

Replace the `.center-tabs` bar with the switcher in the top strip. Verified by typecheck, web build, and the manual gate.

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx`
- Modify: `packages/desktop/src/renderer/styles.css` (retire `.center-tabs` rules)

**Interfaces consumed:** `ViewSwitcher` from `./ViewSwitcher`.

- [ ] **Step 1: Import and remove the stamped bar**

In `App.tsx`, add `import { ViewSwitcher } from "./ViewSwitcher";` with the other renderer imports. Then delete the entire `.center-tabs` block — the `<div className="center-tabs"> … </div>` currently spanning ~lines 2039-2058 (three buttons: chat, terminal, canvas). Read it and remove exactly that div.

- [ ] **Step 2: Put the switcher in the persistent top strip**

The session-tabs strip currently renders only when there are open tabs:
```tsx
{openTabs.length ? (
  <div className="session-tabs">
    {openTabs.map((id) => { ... })}
    <button className="stab-new" ...>+</button>
  </div>
) : null}
```
Change the condition so the strip also renders in-session with no open tabs, and add the switcher right-aligned (shown only in-session, not on the Home):
```tsx
{openTabs.length || !isHome ? (
  <div className="session-tabs">
    {openTabs.map((id) => { ... })}
    <button className="stab-new" ...>+</button>
    {!isHome ? (
      <ViewSwitcher
        view={centerTab}
        onSelect={(v) => {
          if (v === "terminal") {
            setTermMounted(true);
            setCenterTab("terminal");
          } else {
            setCenterTab(v);
          }
        }}
      />
    ) : null}
  </div>
) : null}
```
Keep the existing `{openTabs.map(...)}` and `stab-new` markup exactly as they are — only the outer condition changes and the `ViewSwitcher` is appended. (`ViewSwitcher`'s `.view-switcher` has `margin-left: auto`, so it sits at the right of the flex row.)

- [ ] **Step 3: Retire `.center-tabs` CSS**

In `styles.css`, remove the now-unused `.center-tabs` rules (the `.center-tabs`, `.center-tabs button`, `.center-tabs button:hover`, `.center-tabs button.active` block, ~lines 991-994). If Phase 1 added `.shell.home .center-tabs { display: none; }`, remove that stale reference too (the element no longer exists).

- [ ] **Step 4: Typecheck + web build**

Run: `pnpm --filter @termcoder/desktop typecheck` then `pnpm --filter @termcoder/desktop build:web`.
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): replace the stamped center tabs with the quiet view switcher"
```

- [ ] **Step 6: Manual gate (controller drives in the running app)**

Cannot be automated in-plan. The controller will:
- In a session (with messages, so not the Home), confirm the stamped CHAT/TERMINAL/CANVAS bar is gone and a quiet switcher shows the current view (Chat).
- Open the switcher → the three views listed, a check on Chat.
- Select Terminal → the terminal view opens and the switcher now reads Terminal; from there, open the switcher and select Chat → back to the conversation.
- Select Canvas → canvas view; switcher reads Canvas.
- Confirm the keyboard terminal-toggle and ⌘K palette still switch views and the switcher reflects the current view.
- Confirm the Home is unaffected: its quiet Terminal/Canvas/Commands chips still work and no switcher shows there.
- Verify light + dark + one alternate color theme (nothing hardcoded the ember).

---

## Self-Review

**Spec coverage:**
- Remove stamped `.center-tabs` bar → Task 2 Steps 1, 3. ✅
- Quiet `ViewSwitcher` (icon + chevron → menu with check) → Task 1. ✅
- Lives in persistent top strip, right-aligned, in-session only → Task 2 Step 2 (`!isHome`, `margin-left:auto`). ✅
- `onSelect` effects match the removed buttons → Task 2 Step 2 (terminal sets `termMounted`). ✅
- Strip renders in-session even with no tabs → `openTabs.length || !isHome`. ✅
- Keyboard/⌘K unchanged; switcher reflects `centerTab` → `view={centerTab}` prop, no shortcut changes. ✅
- Home unaffected (switcher hidden) → `!isHome` guard. ✅
- Componentize (ViewSwitcher out of App.tsx) → Task 1. ✅
- Reuse existing i18n keys → Task 1 uses `tab.chat`/`tab.terminal`/`canvas.tab`. ✅

**Placeholder scan:** Complete code for the new component + CSS; the App.tsx changes are precise reference-based edits to a known block.

**Type consistency:** `ViewSwitcher({view, onSelect})` with `View = "chat"|"terminal"|"canvas"` matches `centerTab`'s type and the `setCenterTab` calls. `onSelect` in Task 2 matches the prop signature.

**Risk:** small and contained. The only App.tsx surgery is removing one div and extending one condition — far lower risk than Phase 1. The manual gate confirms switching + the return-to-chat path from terminal/canvas.
