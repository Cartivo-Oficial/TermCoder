# Chat Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** an assistant reply opens with what it did — the files it touched with a count each, how long it took, which checks ran — and only then explains itself.

**Architecture:** The summary is a pure function over the turn's messages, so it is provable in an environment that cannot open a window. The renderer's `Message` type stops discarding the patch it is already handed. The card and the message hierarchy are presentation on top of that.

**Tech Stack:** React 18, TypeScript strict, vitest from the repository root (`environment: "node"`, `renderToStaticMarkup` for component tests), plain CSS with custom properties.

## Global Constraints

- **We report what a command did, never what we guess it meant.** A check is the command's own name and whether it exited clean, taken from `isError`. Do not parse tool output looking for "0 errors" or a green tick — the day that format changes, the UI would lie about a broken build.
- **A reply that did no work gets no card.** "0 files, 0s" is noise.
- No copying from any other project. The standard is taken; the code is ours.
- **`Message` gains exactly two optional fields** — `patch` and `target`. Its roles, storage and replay do not change.
- Scope is the chat surface: the transcript, the message cards, the tool cards. Not the canvas, not the IDE, not the work panel's other tabs, not the composer's behaviour.
- Spacing on `--s-1..--s-9` (2/4/6/8/12/16/24/32/48), type on `--fs-1..--fs-7` (11/12/13/15/18/24/32), elevation on `--sh-*`, focus through `--ring`; off-scale needs `/* off-scale: <reason> */` on the same line. `styles.guard.test.ts` enforces it.
- Source files carry **no comments** beyond those annotations.
- TypeScript strict, `noUncheckedIndexedAccess: true`.
- `pnpm test` (whole suite) cannot run here: `better-sqlite3` is built for Electron's ABI with no node-24 prebuild. 58 core tests fail for that reason before this plan starts; that number must not grow.
- Conventional Commits, lowercase scope. End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## File Structure

**Created**

| path | responsibility |
| --- | --- |
| `packages/desktop/src/renderer/chat/summary.ts` | the turn's summary, as a pure function |
| `packages/desktop/src/renderer/chat/summary.test.ts` | that function |
| `packages/desktop/src/renderer/chat/WorkSummary.tsx` | the card. Renders a summary; computes nothing. |

**Modified**

| path | change |
| --- | --- |
| `packages/desktop/src/renderer/App.tsx:138-145` | `Message` gains `patch` and `target` |
| `packages/desktop/src/renderer/App.tsx:1416-1423` | the `tool-call` handler carries them through |
| `packages/desktop/src/renderer/App.tsx` (transcript) | the card renders at the head of an assistant reply |
| `packages/desktop/src/renderer/ToolCard.tsx` | the tool card, on the hierarchy |
| `packages/desktop/src/renderer/styles.css` | the chat surface's look |

---

## Task 1: The turn's summary, as a function

**Files:**
- Create: `packages/desktop/src/renderer/chat/summary.ts`, `packages/desktop/src/renderer/chat/summary.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface FileChange { path: string; added: number; removed: number }
  export interface CheckRun { command: string; ok: boolean }
  export interface TurnSummary {
    files: FileChange[];
    added: number;
    removed: number;
    checks: CheckRun[];
    didWork: boolean;
  }
  export function countPatch(patch: PatchHunk[]): { added: number; removed: number }
  export function turnSummary(messages: SummaryInput[]): TurnSummary
  ```
  where `SummaryInput` is the subset of the renderer's `Message` this needs: `{ role: string; name?: string; status?: string; text?: string; target?: string; patch?: PatchHunk[] }`. Taking a subset rather than the whole `Message` keeps this file free of the renderer.

`didWork` is what the caller uses to decide whether to render anything at all.

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/src/renderer/chat/summary.test.ts`:

```ts
import { filePatch } from "@termcoder/core";
import { describe, expect, it } from "vitest";
import { countPatch, turnSummary } from "./summary";

const edit = (target: string, before: string, after: string) => ({
  role: "tool",
  name: "edit",
  status: "done",
  target,
  patch: filePatch(before, after),
});

describe("counting a patch", () => {
  it("counts added and removed lines, not context", () => {
    const patch = filePatch("a\nb\nc\n", "a\nB\nc\nd\n");
    const { added, removed } = countPatch(patch);
    expect(added).toBe(2);
    expect(removed).toBe(1);
  });

  it("survives an empty patch", () => {
    expect(countPatch([])).toEqual({ added: 0, removed: 0 });
  });
});

describe("summarising a turn", () => {
  it("says nothing happened when nothing did", () => {
    const s = turnSummary([{ role: "assistant", text: "Here is what I think." }]);
    expect(s.didWork).toBe(false);
    expect(s.files).toEqual([]);
  });

  it("lists each file once, with its own counts", () => {
    const s = turnSummary([
      edit("src/a.ts", "one\n", "one\ntwo\n"),
      edit("src/b.ts", "x\ny\n", "x\n"),
    ]);
    expect(s.didWork).toBe(true);
    expect(s.files.map((f) => f.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(s.files[0]).toMatchObject({ added: 1, removed: 0 });
    expect(s.files[1]).toMatchObject({ added: 0, removed: 1 });
  });

  it("adds up a file edited twice rather than listing it twice", () => {
    const s = turnSummary([
      edit("src/a.ts", "one\n", "one\ntwo\n"),
      edit("src/a.ts", "one\ntwo\n", "one\ntwo\nthree\n"),
    ]);
    expect(s.files).toHaveLength(1);
    expect(s.files[0]).toMatchObject({ path: "src/a.ts", added: 2 });
  });

  it("totals what it lists", () => {
    const s = turnSummary([edit("a.ts", "1\n", "1\n2\n"), edit("b.ts", "9\n", "")]);
    expect(s.added).toBe(s.files.reduce((n, f) => n + f.added, 0));
    expect(s.removed).toBe(s.files.reduce((n, f) => n + f.removed, 0));
  });

  it("records a command and whether it exited clean, and nothing about its output", () => {
    const s = turnSummary([
      { role: "tool", name: "bash", status: "done", text: "pnpm typecheck" },
      { role: "tool", name: "bash", status: "error", text: "pnpm test" },
    ]);
    expect(s.checks).toEqual([
      { command: "pnpm typecheck", ok: true },
      { command: "pnpm test", ok: false },
    ]);
  });

  it("counts a command as work even with no files touched", () => {
    const s = turnSummary([{ role: "tool", name: "bash", status: "done", text: "pnpm build" }]);
    expect(s.didWork).toBe(true);
  });

  it("ignores a tool that produced no patch, rather than inventing a zero", () => {
    const s = turnSummary([{ role: "tool", name: "read", status: "done", text: "src/a.ts" }]);
    expect(s.files).toEqual([]);
    expect(s.didWork).toBe(false);
  });

  it("ignores a tool still running", () => {
    const s = turnSummary([{ ...edit("a.ts", "1\n", "1\n2\n"), status: "running" }]);
    expect(s.files).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run packages/desktop/src/renderer/chat/summary.test.ts
```

Expected: FAIL — `Failed to resolve import "./summary"`.

- [ ] **Step 3: Write it**

Create `packages/desktop/src/renderer/chat/summary.ts`. `PatchHunk.lines` is an array of strings each beginning `+`, `-` or a space; a line beginning `\` is jsdiff's "no newline at end of file" marker and counts as neither.

The tools that produce a patch are `write` and `edit`. The tool that is a check is `bash`, and its `text` is the command. A message counts only when `status` is `"done"` or `"error"`.

- [ ] **Step 4: Run the tests**

```bash
npx vitest run packages/desktop/src/renderer/chat/summary.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/chat
git commit -m "feat(desktop): a turn knows what it changed

The counts come from the patch the tool already produced, and a check is
the command's own name plus whether it exited clean — never a guess read
out of its output.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: The renderer stops dropping the patch

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx:138-145` and `:1416-1423`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Message` gains `patch?: PatchHunk[]` and `target?: string`. Task 3 reads them.

The event already carries the patch — `tool-call` gained it in 0.13.0 — and the renderer throws it away one line later.

- [ ] **Step 1** Add both fields to the `Message` interface at `:138`. Import `PatchHunk` from `@termcoder/core`, as `review/queue.ts` already does.

- [ ] **Step 2** In the `tool-call` handler at `:1416`, carry them through:

```tsx
        { role: "tool", name: e.name, text: e.title ?? "", status: "running", detail: e.detail, patch: e.patch, target: targetOf(e) },
```

`targetOf` reads the file path from the event's `args` for `write` and `edit` (both take `path`), and returns `undefined` otherwise. Put it beside the handler; it is four lines and does not deserve a module.

- [ ] **Step 3** Confirm the patch survives to where Task 3 will read it — add one assertion to an existing renderer test, or if none covers this path, say so in your report rather than adding a test harness for `App.tsx`, which this codebase does not have.

- [ ] **Step 4** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer`

- [ ] **Step 5** `git add packages/desktop/src/renderer/App.tsx && git commit -m "feat(desktop): a tool message keeps its patch"`

---

## Task 3: The summary card

**Files:**
- Create: `packages/desktop/src/renderer/chat/WorkSummary.tsx`
- Modify: `packages/desktop/src/renderer/App.tsx` (the transcript), `styles.css`
- Test: `packages/desktop/src/renderer/chat/summary.test.ts` (append render tests)

**Interfaces:**
- Consumes: `turnSummary`, `TurnSummary` from `./summary`.
- Produces: `WorkSummary({ summary, seconds })` — renders a `TurnSummary`. It computes nothing.

- [ ] **Step 1** Write render tests first, with `renderToStaticMarkup` from `react-dom/server` (this works under vitest's node environment; `ui/ui.test.tsx` already relies on it). Assert: a summary with `didWork: false` renders nothing; one with two files shows both paths and the totals; a failed check is distinguishable from a passed one in the markup, not only by colour.

- [ ] **Step 2** Write `WorkSummary.tsx`. It shows the totals, then a row per file with its path and `+n −m`, then the elapsed time, then a row per check with the command and its outcome. Use `Panel` from `../ui` if the markup genuinely matches — this is the case the primitive was built for — and say in your report which way you went and why.

- [ ] **Step 3** Track the turn's elapsed time in `App.tsx`: record a timestamp when a turn starts and when it finishes, and pass the difference. If the turn is still running, pass the time so far. Do not put a clock inside `summary.ts`.

- [ ] **Step 4** Render the card at the head of the assistant reply for the turn it belongs to. A turn that did no work renders no card.

- [ ] **Step 5** CSS on the scale. The guard covers this file.

- [ ] **Step 6** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer && pnpm --filter @termcoder/desktop build`

- [ ] **Step 7** `git add -A packages/desktop && git commit -m "feat(desktop): a reply opens with what it did"`

---

## Task 4: The message hierarchy

**Files:**
- Modify: `packages/desktop/src/renderer/ToolCard.tsx`, `styles.css`, and the transcript in `App.tsx`

The transcript is a run of text with dividers. This gives the user's message, the assistant's and the tool cards a real structure: a head that says what it is, a body that says it.

- [ ] **Step 1** Rebuild the tool card: its name, its target, its status, and its detail collapsed by default with the existing expand behaviour preserved. Keep every handler and `aria-*`; a tool card that stops being reachable by keyboard is a regression, and several controls in this surface sit at `opacity: 0` until `:hover` with a `:focus-visible` rule that forces them visible — those must keep working.
- [ ] **Step 2** Give the user's and the assistant's messages a consistent card, on the tokens. The composer's behaviour does not change.
- [ ] **Step 3** Add a render test per shape you change, asserting the element type and one attribute that had to survive.
- [ ] **Step 4** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer && pnpm --filter @termcoder/desktop build`
- [ ] **Step 5** **Look at it**, and this time it matters more than the tests. Launch with `unset ELECTRON_RUN_AS_NODE && pnpm --filter @termcoder/desktop dev`. If no window opens in your environment, say so plainly — but list precisely what a human must check:
  - a reply that edited several files and ran a check, so the card is populated;
  - a reply that only talked, which must show no card;
  - a failed check, which must read as failed without relying on colour alone;
  - a long file path and a long command, neither of which may break the card's width;
  - tab through the transcript with the keyboard and confirm every control is reachable and visibly focused;
  - both themes, and compact density.
- [ ] **Step 6** `git add -A packages/desktop && git commit -m "feat(desktop): the transcript has a hierarchy"`

---

## Not in this plan

- Parsing any tool's output. A check is its command and its exit state.
- The canvas, the IDE, the work panel's other tabs.
- The composer's behaviour, or any change to how messages are stored or replayed.
- Any palette, theme, density or motion change.
- Copying code from another project.
