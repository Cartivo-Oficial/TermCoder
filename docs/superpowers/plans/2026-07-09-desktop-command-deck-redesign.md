# Desktop "Command Deck" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the desktop app's face — icon rail, collapsible sessions panel, immersive centered chat, floating composer, slide-over side panels — per `docs/superpowers/specs/2026-07-09-desktop-command-deck-redesign-design.md`.

**Architecture:** Renderer-only change in `packages/desktop/src/renderer`. `App.tsx` (2226 lines) sheds its toolbar/left/right/statusbar JSX into new focused components (`Rail.tsx`, `SessionsPanel.tsx`, `SidePanel.tsx`, `ToolCard.tsx`); `styles.css` is rebuilt on a token foundation (3-layer surface system, glow scale, radius scale) where the layer colors **derive from the existing theme vars via `color-mix`**, so all 9 color themes and the light theme keep working without regeneration.

**Tech Stack:** React 18, plain CSS (no new deps), electron-vite. No test harness exists for this renderer package — verification per task is `typecheck` + `build` + visual dev-run checkpoints (tasks 2, 5, 6, 8, 10).

## Global Constraints

- Palette unchanged: accent stays `#FF7A45` (hot variant `#FF9A3D` for text gradients only); green/amber/red for status only; no new hues.
- No animation longer than 250ms; everything killed by `:root[data-motion="off"]` and `@media (prefers-reduced-motion: reduce)`.
- Zero changes outside `packages/desktop/src/renderer/` (no core/server/preload/main edits).
- Every current feature stays reachable: sessions CRUD, share, revert, rename, mic, images, autonomy, mention/command popups, palette, model browser, study, agents, settings, update toast, permission overlay, viewer/editor.
- NEVER edit source files via PowerShell pipelines (`Get-Content`/`Set-Content` mojibake UTF-8 glyphs — this repo has `❯`, `█`, `·` literals). Use the Write/Edit tools only.
- Dev run on this machine: `env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev` (Bash tool), else no window opens.
- Typecheck: `pnpm --filter @termcoder/desktop typecheck` (expect exit 0, no output). Build: `pnpm --filter @termcoder/desktop build`.
- Commit after each task (conventional message given per task).
- Keep code comments to constraints only, matching repo style; don't narrate changes.

## File Structure

| File | Role |
|---|---|
| `packages/desktop/src/renderer/styles.css` | Rewritten in place, task by task: token foundation, then per-component sections replaced. |
| `packages/desktop/src/renderer/Rail.tsx` | **New.** 48px icon rail: logo, Chat/Files/Study/Agents, health dot, Settings. |
| `packages/desktop/src/renderer/SessionsPanel.tsx` | **New.** Collapsible sessions panel (extracted `<aside class="left">`). |
| `packages/desktop/src/renderer/SidePanel.tsx` | **New.** Right slide-over host: files/changes/overview, study, agents. |
| `packages/desktop/src/renderer/ToolCard.tsx` | **New.** Collapsible tool-call card + `DiffBlock` (moved out of App.tsx). |
| `packages/desktop/src/renderer/App.tsx` | Sheds toolbar/left/right/statusbar; new shell = rail + titlebar + body; new `sidePanel` state. |
| `packages/desktop/src/renderer/Hero.tsx` | Rebuilt: gradient wordmark + suggestion chips (`onSuggest` prop). |
| `packages/desktop/src/renderer/Welcome.tsx` | Rebuilt: full-screen over app gradient, glass choice cards. |
| `packages/desktop/src/renderer/Study.tsx` | Gains `inline?: boolean` so SidePanel can host it without its modal wrapper. |
| `packages/desktop/src/renderer/Icons.tsx` | Gains `IconChat`, `IconAgents`. |
| `packages/desktop/src/renderer/i18n.ts` | New keys: `rail.*`, `hero.s1..s3` (en/pt/es; others fall back to en). |
| `packages/desktop/src/renderer/themes.ts` | Untouched (layers derive from `--panel`/`--elev` via `color-mix`). |

---

### Task 1: Token foundation + depth background

**Files:**
- Modify: `packages/desktop/src/renderer/styles.css` (the `:root` block, `body`, and new utility section only — old component classes stay working)

**Interfaces:**
- Produces CSS custom properties consumed by every later task: `--surface`, `--surface-solid`, `--floating`, `--seam`, `--accent-hot`, `--accent-glow`, `--r-sm` (8px), `--r-md` (12px), `--r-lg` (18px), `--t-fast` (140ms), `--t-med` (200ms); utility class `.glass`.

- [ ] **Step 1: Replace the `:root` block** (currently lines 1–19) with:

```css
:root {
  --bg: #0C0B0A;
  --panel: #100F0D;
  --panel2: #0E0D0B;
  --elev: #1A1816;
  --elev2: #232019;
  --border: #232019;
  --text: #ECEAE6;
  --muted: #948F86;
  --faint: #5C5850;
  --ok: #6fb892;
  --warn: #d3aa66;
  --bad: #e08c8c;
  --accent: #FF7A45;
  --accent-hot: #FF9A3D;
  --accent-dim: rgba(255, 122, 69, 0.14);
  /* Layers derive from the theme palette so every color theme keeps working. */
  --surface: color-mix(in srgb, var(--panel) 84%, transparent);
  --surface-solid: var(--panel);
  --floating: var(--elev);
  --seam: color-mix(in srgb, var(--text) 5%, transparent);
  --accent-glow: color-mix(in srgb, var(--accent) 9%, transparent);
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 18px;
  --t-fast: 140ms;
  --t-med: 200ms;
  --mono: ui-monospace, "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace;
  --radius: 10px;
  --ease: cubic-bezier(0.2, 0, 0, 1);
}
```

(`--radius` and `--accent-dim` stay for classes not yet migrated; App.tsx's `accentDim()` keeps setting `--accent-dim` for custom accents.)

- [ ] **Step 2: Give `body` the depth gradient** — replace the `body { background: var(--bg); ... }` rule's background line with:

```css
body {
  background:
    radial-gradient(1100px 700px at 70% 104%, var(--accent-glow), transparent 62%),
    radial-gradient(800px 500px at -4% -6%, color-mix(in srgb, var(--accent) 4%, transparent), transparent 55%),
    radial-gradient(140% 140% at 50% 42%, var(--bg) 55%, color-mix(in srgb, var(--bg) 78%, #000) 100%);
  background-attachment: fixed;
  color: var(--text);
  font: 13.5px/1.6 ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
  font-size: var(--fs, 14px);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Add the glass utility** right after the scrollbar rules:

```css
/* Dark frosted glass: surface layer of the 3-layer system. */
.glass {
  background: var(--surface);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  box-shadow: inset 0 1px 0 var(--seam);
}
@supports not (backdrop-filter: blur(1px)) {
  .glass { background: var(--surface-solid); }
}
```

- [ ] **Step 4: Add prefers-reduced-motion global kill** next to the existing `data-motion` rule:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
}
```

- [ ] **Step 5: Typecheck + build**

Run: `pnpm --filter @termcoder/desktop typecheck` → exit 0. Run: `pnpm --filter @termcoder/desktop build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): command-deck token foundation (layers, glow, radius, depth bg)"
```

---

### Task 2: Icon rail + thin titlebar (new shell skeleton)

**Files:**
- Create: `packages/desktop/src/renderer/Rail.tsx`
- Modify: `packages/desktop/src/renderer/Icons.tsx` (add `IconChat`, `IconAgents`)
- Modify: `packages/desktop/src/renderer/App.tsx` (shell JSX at ~1495–1562)
- Modify: `packages/desktop/src/renderer/i18n.ts` (keys `rail.chat`, `rail.files`, `rail.study`, `rail.agents` in en/pt/es)
- Modify: `packages/desktop/src/renderer/styles.css` (`.rail` section; `.toolbar` renamed `.titlebar`)

**Interfaces:**
- Produces: `Rail` component —

```tsx
export type RailItem = "chat" | "files" | "study" | "agents";
export function Rail(props: {
  active: RailItem | null;
  busy: boolean;
  connected: boolean;
  onSelect: (item: RailItem) => void;
  onSettings: () => void;
}): JSX.Element;
```

- Consumes: `--surface`, `--seam`, `--accent-glow`, `--t-fast` from Task 1.
- Later tasks rely on App state added here: `const [sidePanel, setSidePanel] = useState<null | "files" | "study" | "agents">(null)` (replaces nothing yet; wired in Task 6).

- [ ] **Step 1: Add icons to `Icons.tsx`** (match the existing feather style — stroke `currentColor`, no fill, 16px):

```tsx
export const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
export const IconAgents = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="7" width="14" height="12" rx="2" />
    <path d="M12 7V4M8 12h.01M16 12h.01M9 16h6" />
  </svg>
);
```

- [ ] **Step 2: Create `Rail.tsx`**:

```tsx
import { Logo } from "./Logo";
import { IconChat, IconFolder, IconStudy, IconAgents, IconGear } from "./Icons";
import { useI18n } from "./i18n";
import type { JSX } from "react";

export type RailItem = "chat" | "files" | "study" | "agents";

const ITEMS: Array<{ id: RailItem; icon: () => JSX.Element; key: string }> = [
  { id: "chat", icon: IconChat, key: "rail.chat" },
  { id: "files", icon: IconFolder, key: "rail.files" },
  { id: "study", icon: IconStudy, key: "rail.study" },
  { id: "agents", icon: IconAgents, key: "rail.agents" },
];

export function Rail({
  active,
  busy,
  connected,
  onSelect,
  onSettings,
}: {
  active: RailItem | null;
  busy: boolean;
  connected: boolean;
  onSelect: (item: RailItem) => void;
  onSettings: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="rail">
      <div className="rail-logo" aria-hidden="true">
        <Logo width={22} height={22} />
      </div>
      {ITEMS.map(({ id, icon: Icon, key }) => (
        <button
          key={id}
          className={`rail-btn ${active === id ? "active" : ""}`}
          title={t(key)}
          onClick={() => onSelect(id)}
        >
          <Icon />
        </button>
      ))}
      <div className="rail-spacer" />
      <span
        className={`dot ${busy ? "gen" : connected ? "on" : "off"}`}
        title={connected ? t("chat.connected") : t("chat.connecting")}
      />
      <button className="rail-btn" title={t("nav.settings")} onClick={onSettings}>
        <IconGear />
      </button>
    </nav>
  );
}
```

- [ ] **Step 3: i18n keys** — in `i18n.ts` add to `en`: `"rail.chat": "Sessions"`, `"rail.files": "Files & changes"`, `"rail.study": "Study"`, `"rail.agents": "Agents"`; `pt`: `"rail.chat": "Sessões"`, `"rail.files": "Arquivos e mudanças"`, `"rail.study": "Estudos"`, `"rail.agents": "Agentes"`; `es`: `"rail.chat": "Sesiones"`, `"rail.files": "Archivos y cambios"`, `"rail.study": "Estudio"`, `"rail.agents": "Agentes"`.

- [ ] **Step 4: Restructure the App shell.** In `App.tsx`:
  - Add state: `const [sidePanel, setSidePanel] = useState<null | "files" | "study" | "agents">(null);` next to `rightOpen` (both coexist until Task 6 removes `rightOpen`).
  - Replace the outer JSX (`<div className="shell">` … `<header className="toolbar">…</header>`) with:

```tsx
<div className="shell">
  <Rail
    active={sidePanel ?? (leftOpen ? "chat" : null)}
    busy={busy}
    connected={connected}
    onSelect={(item) => {
      if (item === "chat") setLeftOpen((v) => !v);
      else setSidePanel((p) => (p === item ? null : item));
    }}
    onSettings={() => setSettingsOpen(true)}
  />
  <div className="app-col">
    <header className="titlebar">
      {/* keep: menu-wrap block, back/forward buttons (tb-left), search pill (tb-center),
          servers popover + theme toggle + win-controls (tb-right).
          DELETE from the old toolbar: the sidebar-toggle button, new-session button,
          right-panel toggle button, dashboard button (all now rail/panel concerns). */}
    </header>
    <div className="body">…existing left/center/right…</div>
  </div>
  …overlays unchanged…
</div>
```

  The `menu-wrap`, `tb-left`, `tb-center`, `tb-right`, `win-controls` blocks move verbatim inside `titlebar`; only the four deleted buttons go. Import `Rail` at top; remove now-unused icon imports (`IconSidebar`, `IconPanelRight`) from the `Icons` import list.

- [ ] **Step 5: CSS.** In `styles.css`, rename the `.toolbar` rules to `.titlebar` (same properties, height 34px, keep `-webkit-app-region: drag` and the `button, .search { no-drag }` rule), make it borderless (`border-bottom: none; background: transparent;`), and add:

```css
.shell { height: 100%; display: flex; }
.app-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }

/* Icon rail — the app skeleton. */
.rail {
  width: 48px; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 0 12px;
  background: color-mix(in srgb, var(--panel2) 72%, transparent);
  border-right: 1px solid var(--border);
  -webkit-app-region: drag;
}
.rail button, .rail .dot { -webkit-app-region: no-drag; }
.rail-logo { color: var(--accent); margin-bottom: 10px; filter: drop-shadow(0 0 6px var(--accent-glow)); }
.rail-btn {
  position: relative; width: 36px; height: 36px; border-radius: var(--r-sm);
  background: transparent; border: none; color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.rail-btn:hover { background: var(--elev); color: var(--text); }
.rail-btn.active { color: var(--text); background: var(--accent-dim); }
.rail-btn.active::before {
  content: ""; position: absolute; left: -6px; top: 8px; bottom: 8px; width: 2px;
  border-radius: 2px; background: var(--accent);
  animation: railIn var(--t-med) var(--ease);
}
@keyframes railIn { from { transform: scaleY(0.4); opacity: 0; } to { transform: none; opacity: 1; } }
.rail-spacer { flex: 1; }
.rail .dot { margin: 6px 0; }
```

Delete the old `.shell { flex-direction: column }` rule (replaced above).

- [ ] **Step 6: Typecheck + visual checkpoint**

Run: `pnpm --filter @termcoder/desktop typecheck` → exit 0.
Run dev (`env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev`): rail on the far left with glow logo, thin borderless titlebar, old 3-column body still functional below. Window drags by titlebar and rail background.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src/renderer
git commit -m "feat(desktop): icon rail + thin titlebar shell (command deck skeleton)"
```

---

### Task 3: SessionsPanel extraction + glass restyle

**Files:**
- Create: `packages/desktop/src/renderer/SessionsPanel.tsx`
- Modify: `packages/desktop/src/renderer/App.tsx` (replace `<aside className="left">` block, lines ~1565–1644)
- Modify: `packages/desktop/src/renderer/styles.css` (`.left` section)

**Interfaces:**
- Produces:

```tsx
export interface SessionCardData {
  id: string; title: string; cwd: string; model: string; messageCount: number;
  usage?: { tokensIn: number; tokensOut: number };
}
export function SessionsPanel(props: {
  sessions: SessionCardData[];
  currentId: string | null;
  busy: boolean;
  project: string;
  cwd: string | null;
  confirmDelete: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onNew: () => void;
  onChooseFolder: () => void;
}): JSX.Element;
```

- Consumes: `.glass` from Task 1. App keeps `leftOpen` state and the Ctrl+B keybind unchanged.

- [ ] **Step 1: Create `SessionsPanel.tsx`.** Move the entire `<aside className="left">` JSX plus the helpers it needs (`sessionLabel`, `shortPath`, `fmtK`, `sessionModelShort` — copy them; they are 1-liners, keep the App.tsx originals only if still referenced elsewhere, otherwise delete from App) into the new component, using `useI18n()` internally and the props above in place of App closures. Keep the same i18n keys (`session.heading`, `session.none`, `session.clearAll`, `session.confirmClear`, `session.confirmOne`, `session.deleteOne`, `nav.newSession`, `nav.chooseFolder`). The `window.confirm` gating moves inside (`if (!confirmDelete || window.confirm(...)) onDelete(id)`).

- [ ] **Step 2: Wire into App:**

```tsx
{leftOpen ? (
  <SessionsPanel
    sessions={sessions}
    currentId={currentId}
    busy={busy}
    project={project}
    cwd={cwd}
    confirmDelete={confirmDelete}
    onOpen={(id) => void openSession(id)}
    onDelete={(id) => void deleteSession(id)}
    onClearAll={() => void clearAllSessions()}
    onNew={() => void newSession()}
    onChooseFolder={() => void chooseFolder()}
  />
) : null}
```

Delete the old aside and the `left-footer` (settings/help now live on the rail; palette stays on Ctrl+K + search pill).

- [ ] **Step 3: CSS restyle** — replace the `.left` block:

```css
.left {
  width: 248px; flex-shrink: 0;
  display: flex; flex-direction: column; padding: 12px 10px; gap: 12px;
  border-right: 1px solid var(--border);
  animation: panelIn var(--t-med) var(--ease);
}
@keyframes panelIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
```

Apply `className="left glass"` on the aside. Session cards get floating-layer polish:

```css
.session-card { border: 1px solid transparent; }
.session-card.active {
  background: var(--elev2); border-color: var(--border);
  box-shadow: inset 2px 0 0 var(--accent), 0 4px 14px rgba(0, 0, 0, 0.25);
}
.new-session { border-radius: var(--r-md); }
.new-session:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
```

(Keep the remaining `.session-card` sub-rules — `sc-top`, `sc-title`, `sc-meta`, `session-del` — as they are.)

- [ ] **Step 4: Typecheck** → exit 0. **Commit:**

```bash
git add packages/desktop/src/renderer
git commit -m "feat(desktop): extract SessionsPanel with glass styling"
```

---

### Task 4: Centered chat column + message + tool-card restyle

**Files:**
- Create: `packages/desktop/src/renderer/ToolCard.tsx`
- Modify: `packages/desktop/src/renderer/App.tsx` (chat-head, transcript, message map; remove `DiffBlock`/`DiffBody` local defs)
- Modify: `packages/desktop/src/renderer/styles.css` (`.center`, `.chat-head`, `.transcript`, `.msg`, `.bubble`, tool styles)

**Interfaces:**
- Produces:

```tsx
// ToolCard.tsx
export function DiffBlock({ text }: { text: string }): JSX.Element; // moved verbatim from App.tsx (with DiffBody)
export function ToolCard(props: {
  name: string;
  text?: string;                       // one-line title/detail from the event
  status: "running" | "done" | "error";
  detail?: string;                     // full output or diff
  defaultOpen: boolean;                // App passes expandTools
}): JSX.Element;
```

- Consumes: `isDiff` regex (copy `const isDiff = (t: string) => /^[+-] /m.test(t);` into ToolCard.tsx). App.tsx keeps importing `DiffBlock` from ToolCard for the permission overlay.

- [ ] **Step 1: Create `ToolCard.tsx`** — move `DiffBlock` + `DiffBody` from App.tsx verbatim, then:

```tsx
export function ToolCard({ name, text, status, detail, defaultOpen }: {
  name: string; text?: string; status: "running" | "done" | "error"; detail?: string; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const mark = status === "error" ? "✗" : status === "done" ? "✓" : "•";
  return (
    <div className={`tool-card ${status}`}>
      <button className="tool-card-head" onClick={() => detail && setOpen((v) => !v)} disabled={!detail}>
        <span className={`status ${status}`}>{mark}</span>
        <span className="toolname">{name}</span>
        {text ? <span className="tool-title">{text}</span> : null}
        {detail ? <span className="tool-caret">{open ? "▾" : "▸"}</span> : null}
      </button>
      {detail && open ? (isDiff(detail) ? <DiffBlock text={detail} /> : <pre className="detail">{detail}</pre>) : null}
    </div>
  );
}
```

- [ ] **Step 2: Use it in App.** Replace the `m.role === "tool"` branch of the message map with `<ToolCard name={m.name} text={m.text} status={m.status} detail={m.detail} defaultOpen={expandTools} />`. Delete the old `tool-wrap` JSX and App's local `DiffBlock`/`DiffBody`; import `{ DiffBlock, ToolCard }` from `./ToolCard` (perm overlay keeps using `DiffBlock`).

- [ ] **Step 3: Center the column.** Wrap the transcript children in an inner column and slim the chat head:

```tsx
<div className="transcript" ref={scrollRef}>
  <div className="transcript-inner">
    …empty state / messages.map / working row (all unchanged children)…
  </div>
</div>
```

Chat head: same children minus the Study button (rail owns Study after Task 6 — remove the button now, rail item already exists). Assistant messages: add a meta row above the markdown body inside `assistant-wrap`:

```tsx
<div className="msg-meta"><span className="msg-spine" />termcoder</div>
```

(No timestamps — the desktop `Message` type doesn't carry them; YAGNI.)

- [ ] **Step 4: CSS.** Replace `.chat-head`, `.transcript`, `.bubble.assistant`, tool styles:

```css
.chat-head {
  display: flex; align-items: center; gap: 8px;
  height: 44px; padding: 0 24px; max-width: 808px; width: 100%; margin: 0 auto;
}
.transcript { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 10px 24px 12px; }
.transcript-inner {
  max-width: 760px; margin: 0 auto; min-height: 100%;
  display: flex; flex-direction: column; gap: 18px;
}
.bubble.user {
  background: var(--surface); backdrop-filter: blur(10px);
  border: 1px solid var(--border); box-shadow: inset 0 1px 0 var(--seam);
  border-radius: var(--r-md); padding: 10px 14px; align-self: flex-end; max-width: 82%;
}
.bubble.assistant { border-left: none; padding-left: 0; }
.msg-meta {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--faint); margin-bottom: 2px;
}
.msg-spine { width: 12px; height: 2px; border-radius: 2px; background: var(--accent); }

.tool-card {
  border: 1px solid var(--border); border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--panel) 60%, transparent); overflow: hidden;
}
.tool-card-head {
  display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left;
  background: transparent; border: none; color: var(--text);
  padding: 7px 10px; font-family: var(--mono); font-size: 12.5px;
}
.tool-card-head:disabled { cursor: default; }
.tool-card-head:not(:disabled):hover { background: var(--elev); }
.tool-title { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.tool-caret { color: var(--faint); font-size: 10px; }
.tool-card .detail, .tool-card .diff { border-radius: 0; margin: 0; border-top: 1px solid var(--border); }
```

Delete the old `.tool-wrap`/`.tool` rules. Keep `.status.done/.error/.running`, `.detail`, `.diff*`. Also update `.bubble.assistant.streaming` to `border-left: none; padding-left: 0;`.

- [ ] **Step 5: Typecheck** → exit 0. **Commit:**

```bash
git add packages/desktop/src/renderer
git commit -m "feat(desktop): centered chat column, spine messages, collapsible tool cards"
```

---

### Task 5: Floating composer + status line, statusbar removed

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx` (dock JSX ~1836–2047; delete statusbar IIFE ~2212–2223; delete `.working` row from transcript)
- Modify: `packages/desktop/src/renderer/styles.css` (`.dock`, `.composer`, `.selectors` → `.composer-actions`; delete `.statusbar`, `.working*`)

**Interfaces:**
- Consumes: existing App state — `busy`, `connected`, `lastCtx`, `tokensIn`, `tokensOut`, `catalog`, `model`, `agent`, `workingLabel`, `workingDetail`, `workingTokens`, `studentMode`.
- Produces: the dock structure later tasks leave alone.

- [ ] **Step 1: Restructure the dock JSX** to:

```tsx
<div className="dock">
  <div className="dock-inner">
    {/* mention-pop / cmd-pop / cmd-preview / img-strip stay as-is, first children here */}
    <div className={`composer ${busy ? "busy" : ""}`} onDragOver=… onDrop=… onPaste=…>
      <div className="composer-status">
        <span className={`dot ${busy ? "gen" : connected ? "on" : "off"}`} />
        {busy ? (
          <span className="cs-working">
            {workingLabel}
            {workingDetail ? <span className="muted"> · {workingDetail}</span> : null}
            {workingTokens > 0 ? <span className="cs-tok">{fmtTokens(workingTokens)} tok</span> : null}
          </span>
        ) : (
          <>
            {(() => {
              const ctxPct = lastCtx > 0 ? Math.round((lastCtx / ((catalog.find((c) => c.id === model)?.contextK ?? 128) * 1000)) * 100) : 0;
              return lastCtx > 0 ? (
                <span className={`cs-item ${ctxPct > 70 ? "hot" : ctxPct > 40 ? "warm" : ""}`}>ctx {fmtTokens(lastCtx)} ({ctxPct}%)</span>
              ) : null;
            })()}
            {tokensIn || tokensOut ? <span className="cs-item">↓{fmtTokens(tokensIn)} ↑{fmtTokens(tokensOut)}</span> : null}
          </>
        )}
      </div>
      <textarea …unchanged handlers/props… />
      <div className="composer-actions">
        {!studentMode ? <div className="menu-wrap">…agent chip + mode-pop, moved verbatim from .selectors…</div> : null}
        <button className="chip model" …>{model} ▾</button>
        <span className="ca-spacer" />
        <button className="attach" …attach files…><IconPlus /></button>
        <button className="attach" …autonomy bolt…><IconBolt /></button>
        <button className="attach mic …" …mic…><IconMic /></button>
        {busy ? <button className="send stop" …><IconStop /></button> : <button className="send" …><IconSend /></button>}
      </div>
    </div>
  </div>
</div>
```

Notes: the old `❯` prompt-glyph is removed (status dot takes its place); the settings chip is removed (rail has Settings); the old `.selectors` row is deleted; the `.working` block in the transcript is deleted (status line shows it); the statusbar IIFE at the bottom of the shell is deleted; `mention-pop`/`cmd-preview` CSS `left/right: 16px` becomes `left: 0; right: 0;` (now positioned inside `.dock-inner`).

- [ ] **Step 2: CSS** — replace `.dock`/`.composer` section; delete `.statusbar`, `.sb-*`, `.working`, `.working-*`, `.prompt-glyph`, `.selectors` rules:

```css
.dock { padding: 8px 24px 20px; }
.dock-inner { max-width: 760px; margin: 0 auto; position: relative; }

.composer {
  display: flex; flex-direction: column; gap: 2px;
  background: var(--floating);
  border: 1px solid var(--border); border-radius: var(--r-lg);
  padding: 10px 14px 10px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 var(--seam);
  transition: border-color var(--t-med), box-shadow var(--t-med);
}
.composer:focus-within {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--accent-glow), 0 0 28px var(--accent-glow), inset 0 1px 0 var(--seam);
}
.composer.busy { animation: composerGlow 2.4s ease-in-out infinite; }
@keyframes composerGlow {
  0%, 100% { box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), 0 0 14px var(--accent-glow), inset 0 1px 0 var(--seam); }
  50% { box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), 0 0 34px var(--accent-glow), inset 0 1px 0 var(--seam); }
}

.composer-status {
  display: flex; align-items: center; gap: 10px; min-height: 18px;
  font-family: var(--mono); font-size: 11px; color: var(--muted);
}
.cs-item { font-variant-numeric: tabular-nums; }
.cs-item.warm { color: var(--warn); }
.cs-item.hot { color: var(--bad); }
.cs-working { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--text); }
.cs-tok { margin-left: auto; color: var(--muted); }

.composer textarea {
  resize: none; min-height: 44px; max-height: 200px; width: 100%;
  background: transparent; color: var(--text); border: none; outline: none; font: inherit; padding: 6px 2px;
}
.composer-actions { display: flex; align-items: center; gap: 6px; }
.ca-spacer { flex: 1; }
.send { background: var(--accent); color: #1a0d06; }
.send:hover { background: var(--accent-hot); }
```

(Keep `.send:disabled`, `.send.stop`, `.attach*`, `.chip*` rules; `.chip` stays for agent/model.)

- [ ] **Step 3: Typecheck + visual checkpoint.** Run dev: floating composer glows on focus, pulses while busy, status line swaps between metrics and working label, orange send button, no statusbar, no gray selectors row.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer
git commit -m "feat(desktop): floating composer with status line; statusbar absorbed"
```

---

### Task 6: SidePanel slide-over (files/changes/overview, study, agents); right column removed

**Files:**
- Create: `packages/desktop/src/renderer/SidePanel.tsx`
- Modify: `packages/desktop/src/renderer/Study.tsx` (add `inline` prop)
- Modify: `packages/desktop/src/renderer/App.tsx` (delete `<aside className="right">`, `rightOpen`/`rightTab`/`studyOpen` state; wire `sidePanel`; Esc + Ctrl+J)
- Modify: `packages/desktop/src/renderer/styles.css` (`.side-panel`, `.side-scrim`; delete `.right`, `.right-tabs`)

**Interfaces:**
- Produces:

```tsx
export function SidePanel(props: {
  kind: "files" | "study" | "agents";
  onClose: () => void;
  cwd: string | null;
  status: Record<string, string>;
  changes: number;
  changedFiles: Array<[string, string]>;
  onOpenFile: (p: string) => void;
  onOpenDiff: (p: string) => void;
  onOpenAllDiffs: () => void;
  sessions: SessionCardData[];
  port: number;
  agents: Array<{ name: string; description: string; builtin: boolean; readOnly: boolean; mode?: string }>;
  currentAgent: string;
  onPickAgent: (name: string) => void;
  onManageAgents: () => void;
}): JSX.Element;
```

- Consumes: `Dashboard`, `FileTree`, `Study` (with new `inline`), `SessionCardData` from Task 3.

- [ ] **Step 1: Study `inline` prop.** In `Study.tsx` change the signature to `{ port, onClose, inline }: StudyProps & { inline?: boolean }` and in BOTH return branches wrap conditionally:

```tsx
const body = ( …the current settings-card inner content… );
if (inline) return <div className="study-inline">{body}</div>;
return <div className="settings" onClick={onClose}><div className="settings-card" …>{body}</div></div>;
```

(Concretely: extract each branch's inner `<div style={{ padding … }}>` content into a variable, then wrap. The overlay path stays for compatibility until this task removes its only caller — then keep `inline` optional anyway; the overlay wrapper is dead code eliminated in Task 10 if unreferenced.)

- [ ] **Step 2: Create `SidePanel.tsx`:**

```tsx
import { useEffect, useState } from "react";
import { FileTree } from "./FileTree";
import { Dashboard } from "./Dashboard";
import { Study } from "./Study";
import { useI18n } from "./i18n";
import type { SessionCardData } from "./SessionsPanel";

export function SidePanel(props: /* interface above */) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"changes" | "files" | "overview">("files");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <div className="side-scrim" onClick={props.onClose} />
      <aside className="side-panel glass">
        <div className="side-head">
          <span className="eyebrow">
            {props.kind === "files" ? t("right.allFiles") : props.kind === "study" ? t("rail.study") : t("rail.agents")}
          </span>
          <button className="icon sm" onClick={props.onClose}>✕</button>
        </div>
        {props.kind === "files" ? (
          <>
            <div className="right-tabs">
              <button className={tab === "changes" ? "active" : ""} onClick={() => setTab("changes")}>{props.changes} {t("right.changes")}</button>
              <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>{t("right.allFiles")}</button>
              <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>{t("dash.overview")}</button>
            </div>
            {tab === "overview" ? <Dashboard sessions={props.sessions} t={t} />
              : tab === "files" ? <FileTree root={props.cwd} status={props.status} onOpen={props.onOpenFile} />
              : /* changes list — moved verbatim from the old right aside */ null}
          </>
        ) : props.kind === "study" ? (
          <Study port={props.port} onClose={props.onClose} inline />
        ) : (
          <div className="agents-panel">
            {props.agents.filter((a) => a.mode !== "subagent").map((a) => (
              <button key={a.name} className={`srow agent-row ${a.name === props.currentAgent ? "active" : ""}`} onClick={() => props.onPickAgent(a.name)}>
                <div><div className="srow-title">{a.name}</div><div className="srow-desc">{a.description}</div></div>
                {a.name === props.currentAgent ? <span className="check">✓</span> : null}
              </button>
            ))}
            <button className="settings-btn" onClick={props.onManageAgents}>{t("agents.manage")}</button>
          </div>
        )}
      </aside>
    </>
  );
}
```

(The `changes` tab branch is the exact JSX from the old right aside — `view-all` button + `changedFiles.map` rows.)

- [ ] **Step 3: Wire in App.** Delete `rightOpen`, `rightTab`, `studyOpen` state and the whole `<aside className="right">` block and `{studyOpen ? <Study … /> : null}`. After `</main>` render:

```tsx
{sidePanel ? (
  <SidePanel
    kind={sidePanel}
    onClose={() => setSidePanel(null)}
    cwd={cwd} status={status} changes={changes} changedFiles={changedFiles}
    onOpenFile={(p) => void openFile(p)} onOpenDiff={(p) => void openDiff(p)} onOpenAllDiffs={() => void openAllDiffs()}
    sessions={sessions} port={port}
    agents={agents} currentAgent={agent}
    onPickAgent={(name) => setAgent(name)}
    onManageAgents={() => { setSidePanel(null); setSettingsTab("agents"); setSettingsOpen(true); }}
  />
) : null}
```

Update every other `setRightOpen`/`setRightTab`/`setStudyOpen` reference (toolbar remnants, palette items, keybind handler `toggleFiles`) to `setSidePanel("files")` / `setSidePanel((p) => (p === "files" ? null : "files"))` / `setSidePanel("study")` — grep for `setRightOpen|setRightTab|setStudyOpen|rightTab|studyOpen` and fix all hits.

- [ ] **Step 4: CSS** — delete `.right {…}` block, keep `.right-tabs` (used inside panel), add:

```css
.side-scrim {
  position: absolute; inset: 0; z-index: 24;
  background: rgba(0, 0, 0, 0.35);
  animation: fadeIn var(--t-fast) var(--ease);
}
.side-panel {
  position: absolute; top: 0; right: 0; bottom: 0; z-index: 25;
  width: min(420px, 92vw);
  display: flex; flex-direction: column;
  border-left: 1px solid var(--border);
  box-shadow: -24px 0 60px rgba(0, 0, 0, 0.35);
  animation: slideIn var(--t-med) var(--ease);
}
@keyframes slideIn { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
.side-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 6px; }
.study-inline { overflow-y: auto; padding: 8px 16px 16px; }
.agents-panel { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; overflow-y: auto; }
.agent-row { text-align: left; cursor: pointer; }
.agent-row.active { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
```

The scrim/panel are positioned against `.body` — give `.body { position: relative; }`.

- [ ] **Step 5: Typecheck + visual checkpoint.** Dev run: rail Files/Study/Agents slide the panel in over the chat with scrim; Esc closes; Ctrl+J toggles files; agent picking works; Study generate/review works inside the panel.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/renderer
git commit -m "feat(desktop): right column becomes slide-over side panel (files/study/agents)"
```

---

### Task 7: Hero + empty state (the screenshot screen)

**Files:**
- Modify: `packages/desktop/src/renderer/Hero.tsx` (rebuild)
- Modify: `packages/desktop/src/renderer/App.tsx` (empty-state block ~1730–1754)
- Modify: `packages/desktop/src/renderer/i18n.ts` (`hero.s1..s3` en/pt/es)
- Modify: `packages/desktop/src/renderer/styles.css` (`.hero*`, `.empty`, `.upgrade-card` → chip)

**Interfaces:**
- Produces: `export function Hero({ onSuggest }: { onSuggest: (text: string) => void }): JSX.Element;`

- [ ] **Step 1: i18n.** en: `"hero.s1": "Explain this repository"`, `"hero.s2": "Fix a bug for me"`, `"hero.s3": "Create flashcards to study"`; pt: `"Explique este repositório"`, `"Corrija um bug para mim"`, `"Crie flashcards para estudar"`; es: `"Explica este repositorio"`, `"Arregla un bug por mí"`, `"Crea flashcards para estudiar"`.

- [ ] **Step 2: Rebuild `Hero.tsx`** — keep the block-glyph wordmark + starfield, add gradient + suggestion chips:

```tsx
import { useMemo } from "react";
import { useI18n } from "./i18n";

const TERM = `…existing block glyphs unchanged…`;
const CODER = `…existing block glyphs unchanged…`;
const GLYPHS = ["·", "+", "✦", "*"];

export function Hero({ onSuggest }: { onSuggest: (text: string) => void }) {
  const { t } = useI18n();
  const stars = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    id: i, glyph: GLYPHS[i % GLYPHS.length]!,
    left: `${Math.random() * 96}%`, top: `${Math.random() * 90}%`, delay: `${Math.random() * 3.2}s`,
  })), []);
  return (
    <div className="hero">
      <div className="stars" aria-hidden="true">
        {stars.map((s) => <b key={s.id} style={{ left: s.left, top: s.top, animationDelay: s.delay }}>{s.glyph}</b>)}
      </div>
      <div className="hero-art" aria-hidden="true">
        <pre className="hero-t">{TERM}</pre>
        <pre className="hero-c">{CODER}</pre>
      </div>
      <div className="hero-tag">your terminal coding agent</div>
      <div className="hero-suggest">
        {(["hero.s1", "hero.s2", "hero.s3"] as const).map((k) => (
          <button key={k} className="suggest-chip" onClick={() => onSuggest(t(k))}>{t(k)}</button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: App empty state.** `<Hero onSuggest={(text) => { setInput(text); inputRef.current?.focus(); }} />`. Downgrade the upgrade-card to a chip: replace its JSX with

```tsx
<button className="free-hint" onClick={() => { setSettingsTab("providers"); setSettingsOpen(true); }}>
  {t("upgrade.title")} →
</button>
```

(keep the same gating conditions; drop the dismiss button — it's now one unobtrusive chip; delete `upgrade.*`-card CSS in Step 4 but keep the i18n keys used).

- [ ] **Step 4: CSS:**

```css
.empty { margin: auto; }
.hero-t {
  background: linear-gradient(180deg, var(--accent-hot), var(--accent));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 18px var(--accent-glow));
}
.hero-c { color: var(--text); }
.hero-art pre { font-size: 10px; }
.hero-suggest { display: flex; gap: 8px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
.suggest-chip {
  background: var(--surface); backdrop-filter: blur(10px);
  border: 1px solid var(--border); border-radius: 999px;
  color: var(--muted); padding: 7px 14px; font-size: 12.5px;
  transition: color var(--t-fast), border-color var(--t-fast), box-shadow var(--t-med);
}
.suggest-chip:hover { color: var(--text); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); box-shadow: 0 0 18px var(--accent-glow); }
```

Delete `.upgrade-card`, `.upgrade-actions` rules.

- [ ] **Step 5: Typecheck** → exit 0. **Commit:**

```bash
git add packages/desktop/src/renderer
git commit -m "feat(desktop): hero empty state with gradient wordmark + suggestion chips"
```

---

### Task 8: Welcome full-screen redesign

**Files:**
- Modify: `packages/desktop/src/renderer/Welcome.tsx`
- Modify: `packages/desktop/src/renderer/styles.css` (`.welcome-*`)

**Interfaces:**
- Consumes: existing `onChoose: (mode: "code" | "study") => void` prop and `welcome.*` i18n keys — both unchanged (check `Welcome.tsx` current props before rewriting; keep signature identical).

- [ ] **Step 1: Rebuild `Welcome.tsx`** — full-screen, no centered card; wordmark + starfield (reuse the same star pattern as Hero) + two glass choice cards. Keep the exact same i18n keys the current file uses (`welcome.title`/`welcome.sub`/`welcome.code*`/`welcome.study*`/`welcome.start`/`welcome.foot` — read the current file first and preserve every key).

- [ ] **Step 2: CSS** — replace `.welcome-overlay`/`.welcome-card` with:

```css
.welcome-overlay {
  position: fixed; inset: 0; z-index: 50;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  background:
    radial-gradient(1000px 600px at 50% 115%, color-mix(in srgb, var(--accent) 13%, transparent), transparent 60%),
    radial-gradient(140% 140% at 50% 40%, var(--bg) 55%, color-mix(in srgb, var(--bg) 75%, #000) 100%);
}
.welcome-inner { width: min(680px, 92vw); text-align: center; animation: wc-in 0.28s var(--ease) both; position: relative; }
```

Keep/adapt `.welcome-logo`, `.welcome-sub`, `.welcome-choices`, `.welcome-choice` (add `glass` class on choices, radius `var(--r-lg)`), `.wc-*`, `.welcome-foot` — same hover lift/glow behavior as today.

- [ ] **Step 3: Typecheck + visual checkpoint** (clear `localStorage tc-onboarded` in devtools to see it). **Commit:**

```bash
git add packages/desktop/src/renderer
git commit -m "feat(desktop): full-screen welcome over the app gradient"
```

---

### Task 9: Overlay reskin (palette, model browser, permission, viewer, settings, toast, crash)

**Files:**
- Modify: `packages/desktop/src/renderer/styles.css` only

**Interfaces:** none new — pure CSS on existing class names.

- [ ] **Step 1: Floating-layer treatment.** Update these selectors to the new system (radius `var(--r-lg)`, `background: var(--floating)`, `box-shadow: 0 24px 80px rgba(0,0,0,.5), inset 0 1px 0 var(--seam)`, backdrop overlays get `backdrop-filter: blur(6px)` with the `@supports` fallback pattern): `.palette-card`, `.model-browser`, `.perm-card`, `.viewer-card`, `.settings-card`, `.update-toast`, `.crash-card`, `.menu`. Their scrims (`.palette`, `.settings`, `.viewer`, `.perm`) get `background: rgba(0,0,0,0.45); backdrop-filter: blur(6px);`.

- [ ] **Step 2: Active-item accent.** `.palette-item.active`, `.mb-item.active`, `.mention-item.active`, `.settings-nav button.active` gain `box-shadow: inset 2px 0 0 var(--accent);` on top of their current background.

- [ ] **Step 3: Fix stale var references.** Grep `styles.css` and `Study.tsx` for `var(--line` and `var(--fg` (old token names in `.update-toast`, Study inline styles) → replace with `var(--border)` / `var(--text)`.

- [ ] **Step 4: Typecheck + build** → exit 0. **Commit:**

```bash
git add packages/desktop/src/renderer
git commit -m "feat(desktop): overlays on the floating glass layer"
```

---

### Task 10: Themes, degradation, cleanup, full verification

**Files:**
- Modify: `packages/desktop/src/renderer/styles.css` (light theme + compact density touch-ups, dead-rule removal)
- Modify: `packages/desktop/src/renderer/App.tsx` / others (dead code removal)

- [ ] **Step 1: Light theme pass.** Under `:root[data-theme="light"]` the derived layers work automatically, but verify contrast: add overrides if glow reads muddy —

```css
:root[data-theme="light"] {
  /* existing var overrides stay */
  --seam: color-mix(in srgb, #000 4%, transparent);
  --accent: #E8632C;
  --accent-hot: #F07B3F;
}
```

(Light accent `#E8632C` matches the Paper theme's accent — same hue family, darker for contrast on white. The old light theme set `--accent: #18181b`; that made the send button/glow gray — replace it.)

- [ ] **Step 2: Compact density.** Point the `data-density="compact"` rules at the new classes: `.transcript-inner { gap: 10px; }`, keep `.bubble.user`/`.session-card`/`.srow` paddings, add `.composer { padding: 6px 10px; }`.

- [ ] **Step 3: Dead code sweep.** Grep for and delete if unreferenced: `.toolbar` leftovers, `.statusbar`, `.sb-*`, `.working*`, `.prompt-glyph`, `.selectors`, `.tool-wrap`, `.upgrade-card`, `.left-footer`, `.dash-*` (Dashboard still uses them — keep), `IconSidebar`/`IconPanelRight`/`IconDashboard` imports, Study's non-inline overlay branch if no caller remains, `rightOpen`-era palette items. `pnpm --filter @termcoder/desktop typecheck` after each removal.

- [ ] **Step 4: Full verification walk** (dev run via `env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev`):
  - Welcome (clear `tc-onboarded`) → choose Code.
  - Empty chat: hero + chips; chip fills composer.
  - Send a message (free model): composer pulses, status line shows working verb + tokens, reply renders with spine meta, tool cards collapse/expand.
  - Rail: sessions toggle (and Ctrl+B), files panel (and Ctrl+J) with changes/files/overview tabs, study panel (generate + review), agents panel (pick + manage), settings.
  - Palette Ctrl+K, model browser, share menu, rename, revert, permission prompt (run a bash tool without auto-approve), image attach, mic button states.
  - Toggle light theme, Paper theme, one dark color theme (Midnight), compact density, reduce-motion, font size slider.
  - `pnpm --filter @termcoder/desktop build:web` → open via `node packages/server/dist/serve.js`, confirm layout + blur fallback in a browser.
  - Repo suite still green: `pnpm vitest run` at root (desktop renderer untested, must not regress others).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop
git commit -m "feat(desktop): command-deck redesign polish — themes, density, dead code"
```

---

## Self-review notes

- Spec coverage: rail (T2), collapsible sessions (T3), centered chat + spine messages + tool cards (T4), floating composer + statusbar absorption (T5), slide-overs incl. Study/Agents (T6), hero + suggestion chips + upgrade chip (T7), welcome (T8), overlays/glass (T9), light theme + fallback + cleanup + web build (T10). Depth background + tokens (T1). Motion ≤250ms enforced via `--t-*` tokens.
- No renderer test harness exists; per-task gates are typecheck/build + visual checkpoints — stated in header.
- Type consistency: `SessionCardData` defined in T3, consumed in T6; `RailItem` in T2; `ToolCard`/`DiffBlock` exports in T4 consumed by App (perm overlay).
