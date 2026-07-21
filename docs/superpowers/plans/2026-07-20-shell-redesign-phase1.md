# Shell Redesign Phase 1 (Home) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop's empty-session state with a calm, centered Home — faded wordmark, the existing composer centered, quiet on-demand feature chips, and recent sessions — built on the existing theme tokens.

**Architecture:** A new `HomeView` component renders when the active session has no messages. It takes the *existing* composer as a slot (the composer is extracted to a local `const`, not rebuilt), plus recent-session data and open handlers. The center layout centers the Home content when empty and reverts to the normal transcript + bottom-composer when messages exist. No color/theme changes — every new surface reads existing CSS tokens.

**Tech Stack:** React, TypeScript, CSS (existing token system), Vitest.

## Global Constraints

- **No code comments.** Do not add comments to any code you write.
- **Preserve CRLF** on all `packages/desktop/**` files (`core.autocrlf=true`; `git show` renders LF — normal; check working-tree files).
- **Do not change the color palette or theme system.** New surfaces must read existing tokens (`--bg`, `--accent`, `--border`, `--text`, `--muted`, `--faint`, `--elev`, `--r-*`) — never hardcode the ember `#FF7A45`, so all color themes keep working.
- **Do not rebuild or change the composer's behavior.** It is extracted to a local `const` and moved as-is; its state lives in `App` (`input`, refs, handlers), so moving the element does not change behavior.
- **Respect `data-motion="off"` / `prefers-reduced-motion`** for any Home animation (a soft fade at most).
- pnpm workspace. Test: `npx vitest run <name>`. Typecheck: `pnpm --filter @termcoder/desktop typecheck` (build core+server first in a fresh worktree if it complains about `@termcoder/server`). Web build: `pnpm --filter @termcoder/desktop build:web`.

---

### Task 1: `relativeTime` helper + `HomeView` component (standalone)

Build the new pieces in isolation — a tested time helper and a self-contained `HomeView` that takes everything via props. Not wired into `App` yet (Task 2 does the surgery). De-risks by keeping the risky App.tsx changes out of this task.

**Files:**
- Create: `packages/desktop/src/renderer/home/relativeTime.ts`
- Test: `packages/desktop/src/renderer/home/relativeTime.test.ts`
- Create: `packages/desktop/src/renderer/home/HomeView.tsx`

**Interfaces produced:**
- `relativeTime(then: number, now: number): string` — a compact relative label ("agora", "5 min", "2 h", "ontem", "3 d"). Pure.
- `HomeView(props)` where:
  ```ts
  interface HomeRecent { id: string; name: string; meta: string; when: string; }
  interface HomeViewProps {
    composer: React.ReactNode;
    recent: HomeRecent[];
    onOpenSession: (id: string) => void;
    onOpenTerminal: () => void;
    onOpenCanvas: () => void;
    onOpenCommands: () => void;
    project?: React.ReactNode;
  }
  ```

- [ ] **Step 1: Write the failing test** — `packages/desktop/src/renderer/home/relativeTime.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { relativeTime } from "./relativeTime";

const M = 60_000;
const H = 60 * M;
const D = 24 * H;

describe("relativeTime", () => {
  it("labels sub-minute as just now", () => {
    expect(relativeTime(1000 * 30, 1000 * 40)).toBe("agora");
  });
  it("labels minutes and hours", () => {
    expect(relativeTime(0, 5 * M)).toBe("5 min");
    expect(relativeTime(0, 2 * H)).toBe("2 h");
  });
  it("labels yesterday and days", () => {
    expect(relativeTime(0, 1 * D)).toBe("ontem");
    expect(relativeTime(0, 3 * D)).toBe("3 d");
  });
  it("never returns a future label for a future timestamp", () => {
    expect(relativeTime(10 * M, 0)).toBe("agora");
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run relativeTime` → FAIL.

- [ ] **Step 3: Implement `relativeTime.ts`**

```ts
export function relativeTime(then: number, now: number): string {
  const diff = now - then;
  const M = 60_000;
  const H = 60 * M;
  const D = 24 * H;
  if (diff < M) return "agora";
  if (diff < H) return `${Math.floor(diff / M)} min`;
  if (diff < D) return `${Math.floor(diff / H)} h`;
  if (diff < 2 * D) return "ontem";
  return `${Math.floor(diff / D)} d`;
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run relativeTime` → PASS.

- [ ] **Step 5: Create `HomeView.tsx`**

```tsx
import type { ReactNode } from "react";
import { useI18n } from "../i18n";

export interface HomeRecent {
  id: string;
  name: string;
  meta: string;
  when: string;
}

export interface HomeViewProps {
  composer: ReactNode;
  recent: HomeRecent[];
  onOpenSession: (id: string) => void;
  onOpenTerminal: () => void;
  onOpenCanvas: () => void;
  onOpenCommands: () => void;
  project?: ReactNode;
}

export function HomeView({
  composer,
  recent,
  onOpenSession,
  onOpenTerminal,
  onOpenCanvas,
  onOpenCommands,
  project,
}: HomeViewProps) {
  const { t } = useI18n();
  return (
    <div className="home">
      <div className="home-stage">
        <div className="home-wordmark" aria-hidden="true">
          term<b>coder</b>
        </div>
        <div className="home-center">
          <div className="home-composer">{composer}</div>
          {project ? <div className="home-project">{project}</div> : null}
          <div className="home-views">
            <button className="home-view" onClick={onOpenTerminal}>
              {t("nav.terminal")}
            </button>
            <button className="home-view" onClick={onOpenCanvas}>
              {t("canvas.tab")}
            </button>
            <button className="home-view" onClick={onOpenCommands}>
              {t("palette.title")}
              <kbd>⌘K</kbd>
            </button>
          </div>
        </div>
      </div>
      {recent.length ? (
        <div className="home-recent">
          <h3>{t("home.recent")}</h3>
          {recent.map((r) => (
            <button key={r.id} className="home-sess" onClick={() => onOpenSession(r.id)}>
              <span className="home-sess-t">
                <span className="home-sess-name">{r.name}</span>
                <span className="home-sess-meta">{r.meta}</span>
              </span>
              <span className="home-sess-when">{r.when}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Add i18n keys**

In `packages/desktop/src/renderer/i18n.ts`, add to each of the three locale blocks (find `nav.terminal`, `canvas.tab`, `palette.title` — reuse those if present; only add missing ones):
```ts
  "home.recent": "Recent sessions",   // pt: "Sessões recentes"   es: "Sesiones recientes"
```
If `nav.terminal` / `palette.title` do not exist, add them too (en "Terminal"/"Commands", pt "Terminal"/"Comandos", es "Terminal"/"Comandos"). Use the per-locale values; do not leave the trailing comments in the file.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @termcoder/desktop typecheck` (build core+server first if it fails resolving `@termcoder/server`).
Expected: no errors. `HomeView` is unused until Task 2 — that is fine.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src/renderer/home packages/desktop/src/renderer/i18n.ts
git commit -m "feat(desktop): HomeView component and relativeTime helper"
```

---

### Task 2: Wire the Home into the empty state + styling + manual gate

The integration surgery in `App.tsx` (extract the composer to a `const`, render `HomeView` on the empty state, hide the chat header there) plus the Home CSS. Verified by typecheck, web build, and the manual gate.

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx`
- Modify: `packages/desktop/src/renderer/styles.css`

**Interfaces consumed:** `HomeView`, `HomeRecent` from `./home/HomeView`; `relativeTime` from `./home/relativeTime`.

- [ ] **Step 1: Extract the composer to a local const**

In `App.tsx`, read the composer block: the element `<div className={\`composer ${busy ? "busy" : ""}\`} ...>` (opens ~line 2089) through its matching closing `</div>` (~line 2262). **Do not change anything inside it.** Move that entire JSX block into a `const composerEl = ( ... );` declared just above the component's main `return (` (the `return` at ~line 1708). Where the composer block used to sit, the surrounding structure will now render `{composerEl}` (wired in Step 2). Confirm by reading that the block you cut is balanced (its own `<div>`…`</div>`).

- [ ] **Step 2: Build the recent list and render HomeView on the empty state**

Near the other derived values before the return, compute the recent list from the already-loaded `sessions` state (`SessionSummary[]`, has `id`, `title`, `messageCount`, `cwd`, and an updated timestamp — inspect the type for the exact time field; use `sessionLabel(s)` for the name):
```tsx
  const recent: HomeRecent[] = sessions
    .filter((s) => s.messageCount > 0)
    .slice(0, 6)
    .map((s) => ({
      id: s.id,
      name: sessionLabel(s),
      meta: `${s.messageCount} ${t("home.turns")}`,
      when: relativeTime(sessionTime(s), Date.now()),
    }));
```
Add imports at the top: `import { HomeView, type HomeRecent } from "./home/HomeView";` and `import { relativeTime } from "./home/relativeTime";`. Define a small `sessionTime(s)` inline using whatever timestamp field `SessionSummary` exposes (e.g. `updatedAt`); if none, use `Date.now()` so the label is "agora". Add `home.turns` i18n (en "turns", pt "turnos", es "turnos").

Then, in the chat view, replace the empty branch. Currently (`~1957`):
```tsx
{messages.length === 0 ? (
  <div className="empty"> <Hero .../> ... </div>
) : null}
{messages.map(...)}
```
Change so that when `messages.length === 0` the center renders `HomeView` (with the composer slot) instead of the transcript+bottom-composer, and when non-empty it renders the transcript with `{composerEl}` at the bottom as before. Concretely, wrap the chat body:
```tsx
{centerTab === "chat" && messages.length === 0 ? (
  <HomeView
    composer={composerEl}
    recent={recent}
    onOpenSession={(id) => void openSession(id)}
    onOpenTerminal={() => { setTermMounted(true); setCenterTab("terminal"); }}
    onOpenCanvas={() => setCenterTab("canvas")}
    onOpenCommands={() => setPaletteOpen(true)}
    project={/* the existing project/branch element, if one is handy; else omit */ undefined}
  />
) : (
  <>
    {/* existing chat-head + transcript + {composerEl} as they are today, with the composer block replaced by {composerEl} */}
  </>
)}
```
Ensure `{composerEl}` is rendered in exactly one place at a time (inside `HomeView` when empty, at its normal bottom position when non-empty) so it is never mounted twice. Keep `chat-head` out of the empty branch (the Home has no title bar). Terminal/Canvas views (`centerTab !== "chat"`) are unchanged.

- [ ] **Step 3: Typecheck + web build**

Run: `pnpm --filter @termcoder/desktop typecheck` then `pnpm --filter @termcoder/desktop build:web`.
Expected: both clean. Fix any type errors from the extraction (e.g. a variable used only inside the composer that is now out of scope — it should still be in scope since `composerEl` is declared inside the component).

- [ ] **Step 4: Add the Home CSS**

Append to `styles.css` (all colors from tokens; no hardcoded ember):
```css
.home { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; padding: 24px; }
.home-stage { position: relative; flex: 1; min-height: 420px; display: flex; align-items: center; justify-content: center; }
.home-wordmark { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%); font-weight: 800; font-size: clamp(80px, 15vw, 190px); letter-spacing: -0.05em; line-height: 1; white-space: nowrap; pointer-events: none; user-select: none; color: color-mix(in srgb, var(--text) 3%, transparent); }
.home-wordmark b { font-weight: 800; color: color-mix(in srgb, var(--accent) 9%, transparent); }
.home-center { position: relative; width: 100%; max-width: 660px; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.home-composer { width: 100%; }
.home-project { font-size: 12.5px; color: var(--muted); }
.home-views { display: flex; gap: 6px; }
.home-view { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 12px; border-radius: 8px; color: var(--faint); font-size: 12px; cursor: pointer; background: transparent; border: 1px solid transparent; }
.home-view:hover { color: var(--text); background: var(--elev); border-color: var(--border); }
.home-view kbd { font-family: var(--mono, ui-monospace, monospace); font-size: 10px; color: var(--faint); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; }
.home-recent { width: 100%; max-width: 660px; margin: 20px auto 0; }
.home-recent h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.13em; color: var(--faint); font-weight: 600; margin: 0 0 8px 4px; }
.home-sess { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 10px 12px; border-radius: 10px; cursor: pointer; background: transparent; border: 1px solid transparent; }
.home-sess:hover { background: var(--elev); border-color: var(--border); }
.home-sess-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.home-sess-name { font-size: 13.5px; color: var(--text); }
.home-sess-meta { font-size: 11.5px; color: var(--faint); font-family: var(--mono, ui-monospace, monospace); }
.home-sess-when { font-size: 11.5px; color: var(--faint); }
```
On the empty Home, reduce chrome: hide the wide sessions panel so the composition is centered. Add a rule scoped to when the Home is present — if `.center` has a `home` descendant is not selectable in CSS, so instead: in `App.tsx`, when `messages.length === 0 && centerTab === "chat"`, add a class to the `.shell` root (e.g. `shell home`), and add:
```css
.shell.home .left { display: none; }
```
(Use the actual class of the wide sessions panel — inspect the left panel's className near `leftOpen`; if it differs from `.left`, target that. Keep the thin rail nav visible.)

- [ ] **Step 5: Typecheck + web build again** — both clean.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/styles.css packages/desktop/src/renderer/i18n.ts
git commit -m "feat(desktop): calm Home on the empty session"
```

- [ ] **Step 7: Manual gate (controller drives in the running app)**

Cannot be automated in-plan. The controller will:
- Open the app to an empty session → the Home shows: faded wordmark, centered composer, quiet Terminal/Canvas/Commands chips, recent sessions; the wide sessions panel is hidden for a calm centered look.
- Type into the composer (still empty session) → draft persists, no layout jump.
- Send the first message → layout reverts to the normal transcript + bottom composer; the composer works exactly as before (send, model chip, attach, mic).
- Click a recent session → it opens.
- Click Terminal/Canvas chips → the respective view opens; ⌘K/Commands opens the palette.
- Verify light and dark themes, and one alternate color theme (confirm nothing hardcoded the ember).
- Verify `data-motion="off"` (Settings) disables any Home animation.

---

## Self-Review

**Spec coverage:**
- Ghost wordmark → Task 1 (HomeView markup) + Task 2 Step 4 (`.home-wordmark`). ✅
- Composer centered, reused not rebuilt → Task 2 Step 1 (extract to const) + HomeView `composer` slot. ✅
- Quiet feature chips (Terminal/Canvas/Commands) → HomeView `home-views` + `.home-view` CSS. ✅
- Recent sessions → HomeView `home-recent` + Task 2 Step 2 (`recent` list) + `relativeTime`. ✅
- Project·branch line → HomeView `project` slot (optional; wired if handy). ✅
- Chrome reduction on Home → Task 2 Step 4 (`.shell.home .left { display:none }`). ✅
- No color/theme change; tokens only → CSS uses `var(--*)` / `color-mix` on `--text`/`--accent`; verified in manual gate across themes. ✅
- Componentize (HomeView extracted; composer NOT extracted into its own component) → Task 1 (HomeView) + Task 2 (composer stays a const in App). ✅
- Reverts to transcript + bottom composer when non-empty → Task 2 Step 2 conditional. ✅

**Placeholder scan:** Complete code for all new pieces (relativeTime, HomeView, CSS). The composer extraction and the empty-branch rewrite are described as reference-based surgery on existing code (moving a known block, not authoring new logic) with exact anchor lines — appropriate for moving a large existing block rather than reproducing ~170 lines.

**Type consistency:** `HomeViewProps`/`HomeRecent` defined in Task 1 and consumed in Task 2 match. `relativeTime(then, now)` signature consistent. `sessionLabel`, `sessions`, `openSession`, `setCenterTab`, `setPaletteOpen`, `setTermMounted` are existing App symbols referenced in Task 2.

**Risk flagged:** the composer extraction + empty-branch rewrite is delicate surgery in a 2449-line file. The implementer must read the real boundaries (composer ~2089-2262; empty branch ~1957) rather than trust line numbers blindly, keep `{composerEl}` mounted in exactly one place, and confirm via typecheck + the manual gate that the composer behaves identically after moving.
