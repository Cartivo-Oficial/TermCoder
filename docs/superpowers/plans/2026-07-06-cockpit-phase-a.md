# Cockpit Phase A Implementation Plan (shell + data + dashboard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the desktop shell into a cockpit — session cards (status/model/usage), a collapsible dashboard (overview + sparkline + model-mix), a rich status bar, and brand-colored file icons — fed by real per-session token totals.

**Architecture:** Core persists `usage` per session (accumulated from the usage the session already computes) and surfaces it on the summary; the desktop renderer restyles the session rail into cards, adds a right dashboard column that aggregates the summaries, adds a bottom status bar from existing live state, and recolors the file icons. No new dependencies in this phase.

**Tech Stack:** TypeScript, Vitest (core), Electron + React (desktop), `react-icons` (already a dep), CSS custom properties (Ember tokens).

## Global Constraints

- **Comment-free code** (user rule). **No new runtime dependencies** in Phase A.
- **Tokens only, no cost.** Never render a `$` figure.
- Ember tokens + `--mono` chrome are the visual base; new labels get i18n en/pt/es.
- `SessionRecord.usage`/`SessionSummary.usage` are **optional** (retro-compatible: old records → treated as 0).
- Node ≥ 20, ESM, tests colocated, typecheck clean (`noUncheckedIndexedAccess`). Never edit via PowerShell (accented i18n).
- **No version bump, no push** — bundle ships later; hold push for the final review. Suite currently 288 green.
- Desktop verification = `npx tsc --noEmit` + `pnpm --filter @termcoder/desktop build` + launching the app; there are no desktop unit tests.

---

### Task 1: Persist per-session token usage (core)

**Files:**
- Modify: `packages/core/src/storage/storage.ts` (`SessionRecord`, `SessionSummary`, `list()`)
- Modify: `packages/core/src/session/session.ts` (accumulate before persist)
- Test: `packages/core/src/storage/storage.test.ts` (extend/create), `packages/core/src/session/session.test.ts`

**Interfaces:**
- Produces: `SessionRecord.usage?: { tokensIn: number; tokensOut: number }`; `SessionSummary.usage?: { tokensIn: number; tokensOut: number }`; `list()` includes it; a completed turn accumulates the turn's tokens onto `record.usage`.

- [ ] **Step 1: Write the failing tests.** In `storage.test.ts` (create if absent — mirror the file's temp-dir setup; if it exists, extend):

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionStore } from "./storage";

let dir: string;
let store: SessionStore;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-store-"));
  store = new SessionStore(dir);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it("persists and lists per-session usage; absent on a fresh record", () => {
  const rec = store.create({ cwd: dir, model: "termcoderfree/auto" });
  expect(store.list()[0]?.usage).toBeUndefined();
  rec.usage = { tokensIn: 100, tokensOut: 40 };
  store.save(rec);
  expect(store.list()[0]?.usage).toEqual({ tokensIn: 100, tokensOut: 40 });
});
```

(Use the real `store.create` signature — check it; the summary test asserts `list()[0].usage`.)

In `session.test.ts`, add a test that a turn with token usage accumulates onto the record. The scripted runner already returns `usage`; add `usage: Promise.resolve({ inputTokens: 10, outputTokens: 3 })` to a step and assert after `collect(...)` that `session.record.usage` is `{ tokensIn: 10, tokensOut: 3 }`, and a second turn adds to it (20/6). (Mirror the file's existing scripted-runner usage handling; the `usage` field is optional on `ModelStreamResult`.)

- [ ] **Step 2: Run — FAIL.** `npx vitest run packages/core/src/storage/storage.test.ts packages/core/src/session/session.test.ts`

- [ ] **Step 3: Implement.** In `storage.ts`:
  - Add to `SessionRecord` (after `messages`): `usage?: { tokensIn: number; tokensOut: number };`
  - Add to `SessionSummary` (after `messageCount`): `usage?: { tokensIn: number; tokensOut: number };`
  - In `list()`'s pushed summary object, add: `usage: record.usage,`

  In `session.ts`, right before `this.persist();` at ~line 558 (the finish-reason path), accumulate:

```ts
          if (inputTokens || outputTokens) {
            const prev = this.record.usage ?? { tokensIn: 0, tokensOut: 0 };
            this.record.usage = { tokensIn: prev.tokensIn + inputTokens, tokensOut: prev.tokensOut + outputTokens };
          }
          this.persist();
```

(There is exactly one finish path that yields `usage`; if the multi-round loop persists elsewhere, accumulate at each persist that follows a usage tally. Keep it to the one spot the tokens are finalized.)

- [ ] **Step 4: Run — PASS**, typecheck, build core.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/storage/storage.ts packages/core/src/session/session.ts packages/core/src/storage/storage.test.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): persist per-session token usage"
```

---

### Task 2: Session cards (desktop left rail)

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx` (the `.left` session list, ~L1548-1605)
- Modify: `packages/desktop/src/renderer/styles.css` (`.session-card` + status dot)

**Interfaces:**
- Consumes: the session summaries the App already fetches (now carrying `usage`), the active session's live `busy`/error state, `model`.

- [ ] **Step 1: Confirm the summary type** the renderer uses (grep the `ServerStatus`/sessions fetch in App.tsx and `Settings.tsx`'s `SessionSummary` shape) and extend it with `usage?: { tokensIn: number; tokensOut: number }`.

- [ ] **Step 2: Restyle the list into cards.** Replace the `.session-row`/`.session` markup with a `.session-card` per session:
  - A status dot span: class `dot idle|gen|err` — `gen` for the currently-active session while `busy`, `err` if the active session's last turn errored, else `idle`.
  - Title (mono, truncated) + the existing delete button on hover.
  - A meta row: model chip (`.chip`, mono, `sessionModelShort(s.model)`) + usage `↓{fmtK(s.usage?.tokensIn)} ↑{fmtK(s.usage?.tokensOut)}` (omit when no usage). Add a `fmtK(n)` helper: `n >= 1000 ? (n/1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n ?? 0)`.
  - Active card keeps the ember left-bar + elevated bg.

- [ ] **Step 3: Styles** (`styles.css`):

```css
.session-card { display: flex; flex-direction: column; gap: 5px; padding: 9px 10px; border-radius: 9px; transition: background 0.12s; }
.session-card:hover { background: var(--elev); }
.session-card.active { background: var(--elev2); box-shadow: inset 2px 0 0 var(--accent); }
.session-card .sc-top { display: flex; align-items: center; gap: 7px; }
.session-card .sc-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
.session-card .sc-meta { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 11px; color: var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot.idle { background: var(--faint); }
.dot.gen { background: var(--accent); animation: pulse 1.4s ease-in-out infinite; }
.dot.err { background: var(--bad); }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
```

- [ ] **Step 4: Typecheck.** `cd packages/desktop && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): session cards with status + model + usage"
```

---

### Task 3: Dashboard column (overview + sparkline + model-mix)

**Files:**
- Create: `packages/desktop/src/renderer/Dashboard.tsx`
- Modify: `packages/desktop/src/renderer/App.tsx` (mount the column in `.body`; a toolbar toggle)
- Modify: `packages/desktop/src/renderer/styles.css`, `packages/desktop/src/renderer/i18n.ts`

**Interfaces:**
- Consumes: the sessions summaries array + live `{ tokensIn, tokensOut }` from App; `t()`.
- Produces: `<Dashboard sessions={summaries} liveIn={tokensIn} liveOut={tokensOut} t={t} onNew={...} onSettings={...} />` — a presentational panel.

- [ ] **Step 1: Component** (`Dashboard.tsx`), comment-free:

```tsx
interface Summary { id: string; model: string; usage?: { tokensIn: number; tokensOut: number } }

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export function Dashboard(p: {
  sessions: Summary[];
  liveIn: number;
  liveOut: number;
  t: (k: string) => string;
  onNew: () => void;
  onSettings: () => void;
}) {
  const totalIn = p.sessions.reduce((s, x) => s + (x.usage?.tokensIn ?? 0), 0);
  const totalOut = p.sessions.reduce((s, x) => s + (x.usage?.tokensOut ?? 0), 0);
  const recent = p.sessions.slice(0, 12).reverse();
  const max = Math.max(1, ...recent.map((x) => (x.usage?.tokensIn ?? 0) + (x.usage?.tokensOut ?? 0)));
  const mix = new Map<string, number>();
  for (const s of p.sessions) mix.set(s.model, (mix.get(s.model) ?? 0) + 1);

  return (
    <aside className="dashboard">
      <div className="eyebrow">{p.t("dash.overview")}</div>
      <div className="dash-stats">
        <div className="dash-stat"><span>{p.t("dash.sessions")}</span><b>{p.sessions.length}</b></div>
        <div className="dash-stat"><span>↓ {p.t("dash.tokensIn")}</span><b>{fmtK(totalIn)}</b></div>
        <div className="dash-stat"><span>↑ {p.t("dash.tokensOut")}</span><b>{fmtK(totalOut)}</b></div>
      </div>
      <div className="spark" aria-hidden="true">
        {recent.map((s, i) => {
          const v = (s.usage?.tokensIn ?? 0) + (s.usage?.tokensOut ?? 0);
          return <span key={s.id + i} style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />;
        })}
      </div>
      <div className="eyebrow">{p.t("dash.models")}</div>
      <div className="dash-mix">
        {[...mix.entries()].map(([m, n]) => (
          <span className="chip" key={m}>{m.split("/").pop()} · {n}</span>
        ))}
      </div>
      <div className="eyebrow">{p.t("dash.toolkit")}</div>
      <div className="dash-toolkit">
        <button className="settings-btn" onClick={p.onNew}>{p.t("dash.new")}</button>
        <button className="settings-btn" onClick={p.onSettings}>{p.t("dash.settings")}</button>
      </div>
    </aside>
  );
}
```

(The run buttons — test/build/lint/deploy — arrive in Phase C with the terminal; Phase A ships New + Settings only.)

- [ ] **Step 2: Mount + toggle.** In `App.tsx`, add `const [dashOpen, setDashOpen] = useState(() => localStorage.getItem("tc-dash") !== "0");` and a toolbar icon button that flips it (persist `localStorage.setItem("tc-dash", dashOpen ? "0" : "1")`). Render `{dashOpen ? <Dashboard sessions={sessions} liveIn={tokensIn} liveOut={tokensOut} t={t} onNew={newSession} onSettings={() => setSettingsOpen(true)} /> : null}` as the last child of `.body` (after `.center`). Use the real handler names (grep `newSession`/`createSession`, `sessions` state).

- [ ] **Step 3: Styles + i18n.**

```css
.dashboard { width: 232px; flex-shrink: 0; background: var(--panel2); border-left: 1px solid var(--border); padding: 14px 12px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.dash-stats { display: flex; flex-direction: column; gap: 6px; }
.dash-stat { display: flex; justify-content: space-between; align-items: baseline; font-size: 12.5px; }
.dash-stat span { color: var(--muted); font-family: var(--mono); font-size: 11px; }
.dash-stat b { font-size: 15px; }
.spark { display: flex; align-items: flex-end; gap: 3px; height: 44px; padding: 4px 0; }
.spark span { flex: 1; background: var(--accent); opacity: 0.7; border-radius: 2px 2px 0 0; min-height: 3px; }
.dash-mix { display: flex; flex-wrap: wrap; gap: 5px; }
.dash-toolkit { display: flex; flex-wrap: wrap; gap: 6px; }
```

i18n keys (en/pt/es): `dash.overview` ("Overview"/"Visão geral"/"Resumen"), `dash.sessions` ("Sessions"/"Sessões"/"Sesiones"), `dash.tokensIn` ("in"/"entrada"/"entrada"), `dash.tokensOut` ("out"/"saída"/"salida"), `dash.models` ("Models"/"Modelos"/"Modelos"), `dash.toolkit` ("Toolkit"/"Ferramentas"/"Herramientas"), `dash.new` ("New session"/"Nova sessão"/"Nueva sesión"), `dash.settings` ("Settings"/"Configurações"/"Ajustes").

- [ ] **Step 4: Typecheck. Commit**

```bash
git add packages/desktop/src/renderer/Dashboard.tsx packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/styles.css packages/desktop/src/renderer/i18n.ts
git commit -m "feat(desktop): collapsible cockpit dashboard (overview, sparkline, model-mix)"
```

---

### Task 4: Rich status bar

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx` (add `.statusbar` as the last child of `.shell`), `styles.css`

**Interfaces:**
- Consumes: App state `model`, `agent`, `tokensIn`, `tokensOut`, `lastCtx`, `busy`, `cwd`, and the model's `contextK` (from the catalog).

- [ ] **Step 1: Add the bar.** As the last child of `.shell` (after `.body`):

```tsx
<div className="statusbar">
  <span className="sb-item">{cwd.split(/[\\/]/).pop()}</span>
  <span className="sb-sep">·</span>
  <span className="sb-item mono">{model.split("/").pop()}</span>
  <span className="sb-sep">·</span>
  <span className="sb-item mono">{agent ?? "build"}</span>
  {lastCtx > 0 ? (<><span className="sb-sep">·</span><span className={`sb-item mono ${ctxPct > 70 ? "hot" : ctxPct > 40 ? "warm" : ""}`}>ctx {fmtK(lastCtx)} ({ctxPct}%)</span></>) : null}
  {(tokensIn || tokensOut) ? (<><span className="sb-sep">·</span><span className="sb-item mono">↓{fmtK(tokensIn)} ↑{fmtK(tokensOut)}</span></>) : null}
  <span className="sb-spacer" />
  <span className={`dot ${busy ? "gen" : "idle"}`} />
</div>
```

`ctxPct = lastCtx > 0 ? Math.round((lastCtx / ((catalog.find((c) => c.id === model)?.contextK ?? 128) * 1000)) * 100) : 0;` (reuse the existing ctx% logic if one already exists in App — grep `ctxPct`/`contextK`; the TUI has the same formula). Reuse the existing `fmtK`.

- [ ] **Step 2: Styles.**

```css
.statusbar { display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 12px; border-top: 1px solid var(--border); background: var(--panel); font-family: var(--mono); font-size: 11px; color: var(--muted); flex-shrink: 0; }
.sb-item.mono { color: var(--muted); }
.sb-item.warm { color: var(--warn); }
.sb-item.hot { color: var(--bad); }
.sb-sep { color: var(--faint); }
.sb-spacer { flex: 1; }
```

- [ ] **Step 3: Typecheck. Commit**

```bash
git add packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): rich status bar (model, agent, ctx%, tokens)"
```

---

### Task 5: Brand-colored file icons + verify + launch

**Files:**
- Modify: `packages/desktop/src/renderer/FileIcons.tsx`

**Interfaces:**
- Produces: file icons rendered in their real brand color (no gray blend), broader coverage, consistent size.

- [ ] **Step 1: Drop the mute blend, add brand colors.** In `FileIcons.tsx`, remove the `mute()` desaturation and give each icon a color. Add a `BRAND` map and apply it:

```tsx
const BRAND: Record<string, string> = {
  ts: "#3178C6", tsx: "#3178C6", js: "#F7DF1E", jsx: "#F7DF1E", mjs: "#F7DF1E", cjs: "#F7DF1E",
  py: "#3776AB", rs: "#DEA584", go: "#00ADD8", rb: "#CC342D", php: "#777BB4",
  java: "#EA2D2E", kt: "#7F52FF", swift: "#F05138", c: "#555555", cpp: "#00599C",
  html: "#E34F26", css: "#1572B6", scss: "#CC6699", sass: "#CC6699", vue: "#4FC08D", svelte: "#FF3E00",
  json: "#CBCB41", yaml: "#CB171E", yml: "#CB171E", toml: "#9C4221", md: "#519ABA",
  sh: "#89E051", bash: "#89E051", dockerfile: "#2496ED", sql: "#E38C00", graphql: "#E10098",
  env: "#ECD53F", lock: "#8A8A90",
};
```

Where an icon is rendered, set `style={{ color: BRAND[key] ?? "var(--muted)" }}` (folders/generic keep `var(--muted)` or the folder tone). Keep the existing extension→icon mapping; only the color and any missing entries change. Bump the icon size to a consistent 15. Add any missing common extensions to the existing switch (tsx→SiReact, jsx→SiReact, json→SiJson, env→SiDotenv, Dockerfile→SiDocker, sql→a DB icon from `react-icons/fa` or `bi`, etc. — reuse imports already present, add from the already-installed `react-icons` where needed).

- [ ] **Step 2: Light-theme contrast floor.** Very light brand colors (e.g. JS `#F7DF1E`, env `#ECD53F`) are low-contrast on the `paper` theme. Wrap the applied color so on light themes it darkens: acceptable to leave a small comment-free helper `iconColor(key)` that returns the brand color, and rely on the icon having an outline/enough mass; if a specific one is unreadable on paper, pick a slightly darker brand variant. (Judgment call at implementation; verify in Step 4.)

- [ ] **Step 3: Full verify.**

```bash
cd packages/desktop && npx tsc --noEmit
cd ../.. && pnpm --filter @termcoder/desktop build
pnpm -r typecheck && npx vitest run
```
Expected: clean, build ok, suite green (288 + the new core usage tests). `git status` shows only cockpit files.

- [ ] **Step 4: Live launch** (strip the Electron quirk):

```bash
env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev
```
Run in the background; confirm: session cards show status dot + model + usage; the dashboard column shows overview + sparkline + model-mix + New/Settings; the status bar shows model/agent/ctx/tokens; file icons are brand-colored and readable in both Ember (dark) and Paper (light). Leave it open for the user to inspect.

- [ ] **Step 5: Commit (no push — final review first)**

```bash
git add -A
git commit -m "feat(desktop): cockpit phase A — cards, dashboard, status bar, brand icons"
```

---

## Follow-ups (Phases B & C — separate plans)

- **Phase B:** center tab bar (Chat/Editor/Terminal), Editor tab (CodeMirror + diff of the agent's last-edited file), rich header (editing file + git branch). No new deps.
- **Phase C:** Terminal tab (`node-pty` + `xterm.js` — native deps, packaging per §7 of the spec) + the run-toolkit wired into it.
