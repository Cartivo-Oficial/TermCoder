# Desktop Vocabulary and Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the four primitives become usable and get adopted across the six surfaces a user looks at constantly, and a work panel appears beside the chat when the agent has something to show.

**Architecture:** One optional field is added to the `tool-call` event so a diff can reach the renderer without a permission prompt. The primitives gain four small props — nothing is redesigned. The panel's decision (which tab, is it pinned, is it open) is a pure reducer over the session event stream, so it is testable in an environment with no display; the component around it holds no logic. `ViewSwitcher` and the `centerTab` state are deleted, not deprecated.

**Tech Stack:** React 18, Electron (electron-vite), plain CSS with custom properties, vitest from the repository root (`environment: "node"`), TypeScript strict.

## Global Constraints

- **No palette, theme, `data-density` or `data-motion` changes.** A user on a purple theme stays on a purple theme.
- **A primitive never swallows behaviour.** Every `onClick`, `onChange`, `onKeyDown`, `disabled`, `title`, `aria-*`, `role`, `tabIndex`, `type`, `htmlFor` and `id` survives a conversion. A control that was a `<button>` stays a `<button>`.
- **Scope is six surfaces:** chat and composer, sessions and rail, terminal chrome, Settings, and the new panel. The 254 selectors on the style guard's `UNSWEPT` allowlist stay there.
- **`IDELayout.tsx` is not restructured** and the IDE stays a separate mode. The inline review strip is untouched.
- Spacing on `--s-1..--s-9` (2/4/6/8/12/16/24/32/48), type on `--fs-1..--fs-7` (11/12/13/15/18/24/32), elevation on `--sh-flat|raised|float|modal`, focus through `--ring`. Off-scale values need `/* off-scale: <reason> */` on the same line — the style guard enforces this and reads every declaration, not the first per line.
- **Tests run from the repository root.** `environment: "node"` — there is no DOM. Component tests use `renderToStaticMarkup` from `react-dom/server`, which is already a dependency and is verified to work under this config.
- `pnpm test` (whole suite) cannot run on the development machine: `better-sqlite3` is built for Electron's ABI and there is no node-24 prebuild, so anything touching a `SessionStore` fails to load the module. Run the targeted tests each task names. CI runs the full suite on node 22.
- Electron does not open a window in the agent environment. Every task's visual step will fail; report it as not done rather than describing what it would look like.
- Source files carry **no comments** beyond the `/* off-scale: <reason> */` annotations.
- Conventional Commits, lowercase scope. End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## File Structure

**Created**

| path | responsibility |
| --- | --- |
| `packages/desktop/src/renderer/workpanel/decide.ts` | the panel's whole decision: which tab, pinned, open. Pure. |
| `packages/desktop/src/renderer/workpanel/decide.test.ts` | that decision, tested as a function |
| `packages/desktop/src/renderer/workpanel/WorkPanel.tsx` | the panel's chrome: tab strip and the pane it shows. No logic. |
| `packages/desktop/src/renderer/ui/ui.test.tsx` | the primitives render the element they are asked for and keep their attributes |

**Modified**

| path | change |
| --- | --- |
| `packages/core/src/session/session.ts:30,591-598` | `patch?: PatchHunk[]` on the `tool-call` event, forwarded from `describe()` |
| `packages/desktop/src/renderer/ui/Row.tsx` | an `as` prop |
| `packages/desktop/src/renderer/ui/Panel.tsx` | an `as` prop and a `selected` state |
| `packages/desktop/src/renderer/ui/Btn.tsx` | a `strong` tone |
| `packages/desktop/src/renderer/ui/Chip.tsx` | a non-interactive form |
| `packages/desktop/src/renderer/styles.css` | `.u-btn-strong`, `.u-panel.is-selected`, `.work-*` |
| `packages/desktop/src/renderer/App.tsx` | the panel replaces `centerTab` and `ViewSwitcher` |
| `Settings.tsx`, `SessionsPanel.tsx`, `Rail.tsx`, `TerminalDeck.tsx` | adopt the primitives |

**Deleted**

| path | why |
| --- | --- |
| `packages/desktop/src/renderer/ViewSwitcher.tsx` | the panel is the way to see the work; three mechanisms was the complaint |

---

## Phase 0 — The data the panel needs

### Task 1: A patch on the tool-call event

**Files:**
- Modify: `packages/core/src/session/session.ts:30` and `:591-598`
- Test: `packages/core/src/session/session.test.ts`

**Interfaces:**
- Produces: the `tool-call` session event gains `patch?: PatchHunk[]`, carrying whatever the tool's `describe()` returned. Every later task reads it from there.

Today a patch reaches the renderer only inside a permission request, so an auto-approved edit produces no diff and the panel's diff tab would be empty exactly when the agent is trusted. The value is already computed one line above the event.

- [ ] **Step 1: Write the failing test**

In `packages/core/src/session/session.test.ts`, add it beside `"runs an allowed tool call and feeds the result back"` (line 661), whose harness it copies exactly:

```ts
  it("puts the patch on the tool-call event, not only on the permission request", async () => {
    config.permission.write = "allow";
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "Writing." }],
        finishReason: "tool-calls",
        toolCalls: [
          { toolCallId: "t1", toolName: "write", input: { path: "patched.txt", content: "hi\n" } },
        ],
        responseMessages: [{ role: "assistant", content: "Writing." }],
      },
      {
        chunks: [{ type: "text-delta", text: "Done." }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "Done." }],
      },
    ]);
    const session = makeSession(runner);
    const events = await collect(session, "create patched.txt");

    const call = events.find((e) => e.type === "tool-call");
    expect(call).toMatchObject({ name: "write" });
    expect((call as { patch?: unknown }).patch).toBeDefined();
  });
```

`config.permission.write = "allow"` is the point: with the write auto-approved there is no permission request, so if the patch is not on the event it does not exist anywhere.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run packages/core/src/session/session.test.ts -t "tool-call event"
```

Expected: FAIL — `patch` is `undefined`.

- [ ] **Step 3: Add the field to the type**

`packages/core/src/session/session.ts:30`, add `patch` to the `tool-call` member:

```ts
  | { type: "tool-call"; id: string; name: string; args: unknown; title?: string; detail?: string; patch?: PatchHunk[] }
```

`PatchHunk` is already imported in this file for the permission request. If it is not, import it from `../util/diff`.

- [ ] **Step 4: Forward it**

`packages/core/src/session/session.ts:591-598`, add one line to the yielded event:

```ts
    yield {
      type: "tool-call",
      id: call.toolCallId,
      name: call.toolName,
      args: call.input,
      title: described?.title,
      detail: described?.detail,
      patch: described?.patch,
    };
```

- [ ] **Step 5: Run the test and the neighbours**

```bash
npx vitest run packages/core/src/session packages/core/src/tools
```

Expected: PASS. Nothing else changes — the field is optional and additive.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/session/session.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): the tool-call event carries its patch

A diff only reached the renderer through a permission request, so an
auto-approved edit produced none. The value was already computed a line
above the event and simply was not forwarded.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 1 — The primitives become usable

### Task 2: Four props, and the first tests that render anything

**Files:**
- Modify: `packages/desktop/src/renderer/ui/Row.tsx`, `Panel.tsx`, `Btn.tsx`, `Chip.tsx`
- Modify: `packages/desktop/src/renderer/styles.css` (`.u-btn-strong`, `.u-panel.is-selected`)
- Test: `packages/desktop/src/renderer/ui/ui.test.tsx` (new)

**Interfaces:**
- Produces:
  - `Row({ as?: "div" | "button" | "a", active?: boolean, ... })` — `div` by default.
  - `Panel({ as?: "div" | "button", head?: ReactNode, elevation?: "flat" | "raised", selected?: boolean, ... })`.
  - `Btn({ size?: "sm" | "md", tone?: "quiet" | "solid" | "strong" | "danger", ... })`.
  - `Chip({ on?: boolean, interactive?: boolean, ... })` — a `<span>` with no `aria-pressed` when `interactive` is false.

No file in the renderer imports from `./ui` today. This task is why they will.

- [ ] **Step 1: Write the failing tests**

Create `packages/desktop/src/renderer/ui/ui.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Btn } from "./Btn";
import { Chip } from "./Chip";
import { Panel } from "./Panel";
import { Row } from "./Row";

describe("Row", () => {
  it("is a div by default", () => {
    expect(renderToStaticMarkup(<Row>x</Row>)).toContain("<div");
  });

  it("renders a real button when asked, keeping its attributes", () => {
    const html = renderToStaticMarkup(
      <Row as="button" aria-label="pick" disabled>x</Row>,
    );
    expect(html).toContain("<button");
    expect(html).toContain('aria-label="pick"');
    expect(html).toContain("disabled");
  });
});

describe("Panel", () => {
  it("marks the selected state", () => {
    expect(renderToStaticMarkup(<Panel selected>x</Panel>)).toContain("is-selected");
  });

  it("renders a button when asked", () => {
    expect(renderToStaticMarkup(<Panel as="button">x</Panel>)).toContain("<button");
  });
});

describe("Btn", () => {
  it("has a tone that fills with the text colour, distinct from the accent one", () => {
    expect(renderToStaticMarkup(<Btn tone="strong">x</Btn>)).toContain("u-btn-strong");
    expect(renderToStaticMarkup(<Btn tone="solid">x</Btn>)).toContain("u-btn-solid");
  });
});

describe("Chip", () => {
  it("is a button that announces its pressed state when interactive", () => {
    const html = renderToStaticMarkup(<Chip interactive on onClick={() => {}}>x</Chip>);
    expect(html).toContain("<button");
    expect(html).toContain('aria-pressed="true"');
  });

  it("is a plain span when it is only a label", () => {
    const html = renderToStaticMarkup(<Chip>x</Chip>);
    expect(html).toContain("<span");
    expect(html).not.toContain("aria-pressed");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run packages/desktop/src/renderer/ui/ui.test.tsx
```

Expected: FAIL — `as`, `selected`, `strong` and `interactive` do not exist yet.

- [ ] **Step 3: Row**

Replace `packages/desktop/src/renderer/ui/Row.tsx`:

```tsx
import type { ComponentPropsWithoutRef, ElementType } from "react";

type RowTag = "div" | "button" | "a";

export function Row<T extends RowTag = "div">({
  as,
  active = false,
  className = "",
  ...rest
}: { as?: T; active?: boolean } & Omit<ComponentPropsWithoutRef<T>, "as">) {
  const Tag = (as ?? "div") as ElementType;
  return <Tag className={`u-row ${active ? "is-active" : ""} ${className}`.trim()} {...rest} />;
}
```

- [ ] **Step 4: Panel**

Replace `packages/desktop/src/renderer/ui/Panel.tsx`:

```tsx
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type PanelTag = "div" | "button";

export function Panel<T extends PanelTag = "div">({
  as,
  head,
  elevation = "flat",
  selected = false,
  className = "",
  children,
  ...rest
}: { as?: T; head?: ReactNode; elevation?: "flat" | "raised"; selected?: boolean } & Omit<
  ComponentPropsWithoutRef<T>,
  "as"
>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={`u-panel u-panel-${elevation} ${selected ? "is-selected" : ""} ${className}`.trim()}
      {...rest}
    >
      {head !== undefined && <div className="u-panel-head">{head}</div>}
      <div className="u-panel-body">{children}</div>
    </Tag>
  );
}
```

- [ ] **Step 5: Btn**

In `packages/desktop/src/renderer/ui/Btn.tsx`, widen the tone union only:

```tsx
}: { size?: "sm" | "md"; tone?: "quiet" | "solid" | "strong" | "danger" } & ButtonHTMLAttributes<HTMLButtonElement>) {
```

- [ ] **Step 6: Chip**

Replace `packages/desktop/src/renderer/ui/Chip.tsx`:

```tsx
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

export function Chip({
  on = false,
  interactive = false,
  className = "",
  ...rest
}: { on?: boolean; interactive?: boolean } & ButtonHTMLAttributes<HTMLButtonElement> &
  HTMLAttributes<HTMLSpanElement>) {
  const cls = `u-chip ${on ? "is-on" : ""} ${className}`.trim();
  if (!interactive) return <span className={cls} {...(rest as HTMLAttributes<HTMLSpanElement>)} />;
  return <button className={cls} aria-pressed={on} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
```

- [ ] **Step 7: The two new CSS rules**

In `packages/desktop/src/renderer/styles.css`, beside the existing `.u-btn-solid` line:

```css
.u-btn-strong { background: var(--text); border-color: var(--text); color: var(--bg); }
.u-btn-strong:disabled { background: var(--elev); border-color: var(--border); color: var(--faint); }
```

And beside the `.u-panel` block:

```css
.u-panel.is-selected { box-shadow: inset 2px 0 0 var(--accent), var(--sh-float); } /* off-scale: a 2px selection rail, not elevation */
```

- [ ] **Step 8: Run the tests, typecheck, and the guard**

```bash
npx vitest run packages/desktop/src/renderer/ui/ui.test.tsx packages/desktop/src/renderer/styles.guard.test.ts
pnpm --filter @termcoder/desktop typecheck
```

Expected: all tests PASS, typecheck clean. The guard must stay green — if it names `.u-btn-strong` or `.u-panel`, the new CSS went off-scale.

- [ ] **Step 9: Commit**

```bash
git add packages/desktop/src/renderer/ui packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): the primitives can be the element they replace

Row and Panel rendered a div, so they could not stand in for a button
without dropping its semantics — which is what six sweeps refused them
for. Btn gains the text-filled tone the app's primary button uses, and
Chip stops announcing a non-interactive label as pressable.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 2 — The panel

### Task 3: The panel's decision, as a pure function

**Files:**
- Create: `packages/desktop/src/renderer/workpanel/decide.ts`
- Test: `packages/desktop/src/renderer/workpanel/decide.test.ts`

**Interfaces:**
- Produces: `type WorkTab = "diff" | "terminal" | "canvas"`; `interface WorkState { open: boolean; tab: WorkTab; pinned: boolean }`; `const closedWork: WorkState`; `reduceWork(s, e): WorkState`; `pinWork(s, tab): WorkState`; `closeWork(s): WorkState`. Task 4 renders this and adds nothing to it.

- [ ] **Step 1: Write the failing tests**

Create `packages/desktop/src/renderer/workpanel/decide.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { closedWork, closeWork, pinWork, reduceWork } from "./decide";

const edit = { type: "tool-call", id: "1", name: "edit", patch: [] } as const;
const bash = { type: "tool-call", id: "2", name: "bash" } as const;
const sub = { type: "subagent-start", sessionId: "s", agent: "explore", prompt: "p" } as const;
const done = { type: "done" } as const;

describe("the work panel's decision", () => {
  it("is absent until there is work", () => {
    expect(closedWork.open).toBe(false);
  });

  it("opens on the diff when a file changes", () => {
    const s = reduceWork(closedWork, edit);
    expect(s.open).toBe(true);
    expect(s.tab).toBe("diff");
  });

  it("shows the terminal when a command runs", () => {
    expect(reduceWork(closedWork, bash).tab).toBe("terminal");
  });

  it("shows the canvas when a sub-agent starts", () => {
    expect(reduceWork(closedWork, sub).tab).toBe("canvas");
  });

  it("follows the newest activity", () => {
    const s = reduceWork(reduceWork(closedWork, edit), bash);
    expect(s.tab).toBe("terminal");
  });

  it("stops following once the user picks a tab", () => {
    const pinned = pinWork(reduceWork(closedWork, edit), "diff");
    expect(reduceWork(pinned, bash).tab).toBe("diff");
  });

  it("resumes following on the next turn", () => {
    const pinned = pinWork(reduceWork(closedWork, edit), "diff");
    const idle = reduceWork(pinned, done);
    expect(idle.pinned).toBe(false);
    expect(reduceWork(idle, bash).tab).toBe("terminal");
  });

  it("stays open once it has opened, so a finished diff is still readable", () => {
    const s = reduceWork(reduceWork(closedWork, edit), done);
    expect(s.open).toBe(true);
  });

  it("closes only when the user closes it", () => {
    expect(closeWork(reduceWork(closedWork, edit)).open).toBe(false);
  });

  it("stays closed for the rest of the turn once dismissed", () => {
    const dismissed = closeWork(reduceWork(closedWork, edit));
    expect(reduceWork(dismissed, bash).open).toBe(false);
  });

  it("may open again on the next turn", () => {
    const dismissed = closeWork(reduceWork(closedWork, edit));
    const next = reduceWork(dismissed, done);
    expect(reduceWork(next, bash).open).toBe(true);
  });

  it("ignores a tool call that carries no patch and is not a command", () => {
    const s = reduceWork(closedWork, { type: "tool-call", id: "3", name: "read" });
    expect(s.open).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run packages/desktop/src/renderer/workpanel/decide.test.ts
```

Expected: FAIL — `Failed to resolve import "./decide"`.

- [ ] **Step 3: Write it**

Create `packages/desktop/src/renderer/workpanel/decide.ts`:

```ts
import type { SessionEventLike } from "../canvas/runGraph";

export type WorkTab = "diff" | "terminal" | "canvas";

export interface WorkState {
  open: boolean;
  tab: WorkTab;
  pinned: boolean;
  dismissed: boolean;
}

export const closedWork: WorkState = { open: false, tab: "diff", pinned: false, dismissed: false };

const COMMAND_TOOLS = new Set(["bash"]);

function tabFor(e: SessionEventLike): WorkTab | null {
  if (e.type === "subagent-start") return "canvas";
  if (e.type !== "tool-call") return null;
  if (COMMAND_TOOLS.has(e.name)) return "terminal";
  const patch = (e as { patch?: unknown }).patch;
  return patch ? "diff" : null;
}

export function reduceWork(s: WorkState, e: SessionEventLike): WorkState {
  // A turn boundary expires both the pin and the dismissal. Carrying either
  // across turns means the panel silently stops working for the rest of the
  // session and the user has no way to know why.
  if (e.type === "done" || e.type === "error") {
    return s.pinned || s.dismissed ? { ...s, pinned: false, dismissed: false } : s;
  }
  if (s.dismissed) return s;
  const tab = tabFor(e);
  if (!tab) return s;
  if (s.pinned) return s.open ? s : { ...s, open: true };
  if (s.open && s.tab === tab) return s;
  return { ...s, open: true, tab };
}

export function pinWork(s: WorkState, tab: WorkTab): WorkState {
  return { open: true, tab, pinned: true, dismissed: false };
}

export function closeWork(s: WorkState): WorkState {
  return { ...s, open: false, pinned: false, dismissed: true };
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run packages/desktop/src/renderer/workpanel/decide.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/workpanel
git commit -m "feat(desktop): the work panel decides which tab, as a function

No display in this environment means the panel's behaviour has to be
provable without one. Which tab, whether the pin holds, and when it
expires are all decided here, over the same events the canvas reads.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 4: The panel replaces the view switcher

**Files:**
- Create: `packages/desktop/src/renderer/workpanel/WorkPanel.tsx`
- Modify: `packages/desktop/src/renderer/App.tsx` (`:403`, `:1300`, `:1772`, `:2064-2072`, `:2369-2376`)
- Modify: `packages/desktop/src/renderer/styles.css` (`.work-*`)
- Delete: `packages/desktop/src/renderer/ViewSwitcher.tsx`

**Interfaces:**
- Consumes: `WorkState`, `reduceWork`, `pinWork`, `closeWork`, `closedWork` from `./decide`; `Btn` and `Chip` from `../ui`.
- Produces: `WorkPanel({ state, onPick, onClose, diff, terminal, canvas })` — it renders a tab strip and whichever of the three nodes the state names. It holds no state and makes no decision.

- [ ] **Step 1: Write the panel**

Create `packages/desktop/src/renderer/workpanel/WorkPanel.tsx`:

```tsx
import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import { Chip } from "../ui/Chip";
import type { WorkState, WorkTab } from "./decide";

const TABS: WorkTab[] = ["diff", "terminal", "canvas"];

export function WorkPanel({
  state, onPick, onClose, diff, terminal, canvas,
}: {
  state: WorkState;
  onPick: (t: WorkTab) => void;
  onClose: () => void;
  diff: ReactNode;
  terminal: ReactNode;
  canvas: ReactNode;
}) {
  const { t } = useI18n();
  if (!state.open) return null;
  return (
    <aside className="work">
      <div className="work-tabs">
        {TABS.map((tab) => (
          <Chip key={tab} interactive on={state.tab === tab} onClick={() => onPick(tab)}>
            {t(`work.${tab}`)}
          </Chip>
        ))}
        <button className="work-close" title={t("work.close")} onClick={onClose}>×</button>
      </div>
      <div className="work-body" hidden={state.tab !== "diff"}>{diff}</div>
      <div className="work-body" hidden={state.tab !== "terminal"}>{terminal}</div>
      <div className="work-body" hidden={state.tab !== "canvas"}>{canvas}</div>
    </aside>
  );
}
```

The three panes are always mounted and hidden by attribute, not unmounted — the terminal must not lose its scrollback when you look at a diff.

- [ ] **Step 2: Add the i18n keys**

In `packages/desktop/src/renderer/i18n.ts`, add `work.diff`, `work.terminal`, `work.canvas` and `work.close` to **every** locale in the file. The app has eleven; a missing key shows a raw key string to that user. Use the existing translations for the same words where the file already has them (the old `ViewSwitcher` keys for terminal and canvas).

- [ ] **Step 3: Wire it into App.tsx**

1. Delete `const [centerTab, setCenterTab] = useState<...>("chat")` at `:403` and add:

```tsx
  const [work, setWork] = useState(closedWork);
```

2. At `:1300`, beside the existing graph reducer, feed the same event to the panel:

```tsx
    setGraph((g) => reduceGraph(g, e as unknown as SessionEventLike));
    setWork((w) => reduceWork(w, e as unknown as SessionEventLike));
```

3. `:1772` — `isHome` no longer depends on a tab:

```tsx
  const isHome = messages.length === 0 && !work.open;
```

4. `:2064-2072` — delete the `<ViewSwitcher …>` block entirely, and delete its import.

5. `:2369-2376` — the terminal deck and the canvas stop being hidden by `centerTab` and become the panel's children. Replace both with a single `<WorkPanel>`:

```tsx
          <WorkPanel
            state={work}
            onPick={(tab) => { if (tab === "terminal") setTermMounted(true); setWork((w) => pinWork(w, tab)); }}
            onClose={() => setWork(closeWork)}
            diff={
              <ReviewStrip
                queue={reviewQueue}
                openFile={openFilePath}
                onAccept={(id) => answer(id, "allow")}
                onReject={(id) => answer(id, "deny")}
                onAlways={(id) => answer(id, "allow-always")}
                onAcceptAll={answerAll}
              />
            }
            terminal={termMounted ? <TerminalDeck cwd={cwd} hidden={false} themeKey={`${theme}:${colorTheme}:${accent}`} /> : null}
            canvas={<AgentCanvas graph={graph} hidden={false} />}
          />
```

Those are `ReviewStrip`'s real props, copied from its existing call site at `App.tsx:2296-2303`. **Leave that existing call site where it is** — it is guarded by `!isGuest` and belongs to the editor, and the spec puts the review strip out of scope. The panel's diff pane mounts a second instance for now; if that reads wrong once someone can look at it, a dedicated diff pane is a follow-up, not an invention to make here.

6. Mount the terminal when the panel first shows it: the `onPick` above handles the user's click, and `reduceWork` opening on `terminal` needs the same. Add an effect:

```tsx
  useEffect(() => { if (work.open && work.tab === "terminal") setTermMounted(true); }, [work.open, work.tab]);
```

- [ ] **Step 4: Delete the switcher**

```bash
git rm packages/desktop/src/renderer/ViewSwitcher.tsx
```

Then confirm nothing still imports it:

```bash
grep -rn "ViewSwitcher" packages/desktop/src
```

Expected: no output.

- [ ] **Step 5: The panel's CSS**

Add to `packages/desktop/src/renderer/styles.css`, on the scale:

```css
.work { display: flex; flex-direction: column; min-width: 0; border-left: 1px solid var(--border); background: var(--panel); }
.work-tabs { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-5); border-bottom: 1px solid var(--border); }
.work-close { margin-left: auto; background: transparent; border: none; color: var(--faint); cursor: pointer; padding: var(--s-1) var(--s-3); font-size: var(--fs-4); line-height: 1; }
.work-close:hover { color: var(--text); }
.work-close:focus-visible { outline: var(--ring); outline-offset: var(--s-1); }
.work-body { flex: 1; min-height: 0; overflow: auto; }
.work-body[hidden] { display: none; }
```

The panel sits beside the chat in the existing `<main>` flex row; give it a sensible share (`flex: 1 1 0` on both, or a `min-width` on the chat) and say in your report what you chose.

- [ ] **Step 6: Typecheck, test, build**

```bash
pnpm --filter @termcoder/desktop typecheck
npx vitest run packages/desktop/src/renderer
pnpm --filter @termcoder/desktop build
```

Expected: clean, all tests pass, build succeeds. The style guard is among those tests and must stay green.

- [ ] **Step 7: Look at it**

```bash
env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev
```

This will not open a window in the agent environment. Make one attempt, report exactly what happened, and move on — do not describe a screen you did not see.

- [ ] **Step 8: Commit**

```bash
git add -A packages/desktop
git commit -m "feat(desktop): the work panel replaces the view switcher

Chat is the session, not one of three views. The terminal, the canvas
and the diff become tabs of a panel that opens itself when the agent
has something to show, and the screen stops sitting empty while it
works.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 3 — Adoption

Each task below follows the same shape. The rule, once:

> Find the surface's hand-rolled controls. Where the markup matches a primitive **as it now is** — with `as`, `selected`, `strong` and the non-interactive chip available — replace it and delete the CSS the primitive now provides. Where it does not, leave it bespoke and say precisely what diverges. Every handler, `disabled`, `title`, `aria-*`, `role`, `tabIndex` and `type` survives. Add a render test for each converted control asserting the element type and one attribute that had to survive.

Do not widen a task to a surface it does not name.

### Task 5: Settings adopts the primitives

**Files:** `packages/desktop/src/renderer/Settings.tsx`, `styles.css`, `packages/desktop/src/renderer/ui/ui.test.tsx`

Task 8 of the finish pass found that after its sweep `.settings-nav button` is declaration-for-declaration identical to `.u-row`. That is the first conversion and the reason `as` exists.

`.settings-btn` has 48 call sites across 11 components; **only the ones inside `Settings.tsx` are yours**. Its `.primary` variant maps to `tone="strong"`, its `.sm` to `size="sm"`.

- [ ] **Step 1** Inventory what is here: `grep -n "className=\"settings-btn\|className=\"srow\|settings-nav" packages/desktop/src/renderer/Settings.tsx`
- [ ] **Step 2** Convert `.settings-nav button` to `<Row as="button" active={…}>`, and the `.settings-btn` call sites in this file to `<Btn>` with the tone and size mapping above.
- [ ] **Step 3** Judge `.srow` against `Row` and say which way you went and why. It is a hairline-separated form line with no hover; `u-row` has hover and a radius. If adopting it means more overrides than it removes, leave it bespoke — that is a real answer.
- [ ] **Step 4** Add a render test per converted control shape to `ui.test.tsx`.
- [ ] **Step 5** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer`
- [ ] **Step 6** `git add -A packages/desktop && git commit -m "feat(desktop): settings uses the primitives"`

### Task 6: Sessions and rail adopt the primitives

**Files:** `SessionsPanel.tsx`, `Rail.tsx`, `styles.css`, `ui/ui.test.tsx`

`.session-card` is the reason `Panel` gained `selected`: its active state is `inset 2px 0 0 var(--accent)` composed with `var(--sh-float)`, which `.u-panel.is-selected` now expresses. The card is a two-row layout with no head/body split, so `head` stays unused — pass children only.

- [ ] **Step 1** Convert `.session-card` to `<Panel selected={…}>`, keeping its own class for the layout it does not share.
- [ ] **Step 2** The rail's icon buttons: judge against `Btn`. They are icon-only and square; if `u-btn`'s padding fights that, leave them bespoke and say so.
- [ ] **Step 3** Add render tests for each converted control.
- [ ] **Step 4** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer`
- [ ] **Step 5** `git add -A packages/desktop && git commit -m "feat(desktop): sessions and rail use the primitives"`

### Task 7: Chat, composer and terminal chrome adopt the primitives

**Files:** `App.tsx`, `ToolCard.tsx`, `TerminalDeck.tsx`, `styles.css`, `ui/ui.test.tsx`

The composer's context pills (`.cpill`) and the terminal's tool chips (`.term-chip`) are the `Chip` candidates — most are one-shot actions or labels, so they take the non-interactive form or `interactive` without `on`. The terminal tab strip is the `Row as="button"` candidate.

- [ ] **Step 1** Convert what matches; for each thing you leave bespoke, name the property that diverges.
- [ ] **Step 2** Add render tests for each converted control.
- [ ] **Step 3** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer && pnpm --filter @termcoder/desktop build`
- [ ] **Step 4** `git add -A packages/desktop && git commit -m "feat(desktop): chat, composer and terminal use the primitives"`

---

## Not in this plan

- The 254 selectors on the style guard's allowlist.
- Restructuring `IDELayout.tsx`, or changing what the IDE does.
- The canvas's own visual redesign — that is project 3 in the agreed queue.
- Parallel orchestration and third-party agents — projects 4 and 5.
- Any palette, theme, density or motion change.
- A dark/light theme change of any kind. Both already work; keep it that way.
