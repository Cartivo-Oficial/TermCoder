# Review Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blocking permission modal with a review surface — a non-blocking strip plus the change drawn inline in the editor at its real lines — for the edits the agent proposes.

**Architecture:** The permission request gains an optional positional `patch` (jsdiff `structuredPatch`) beside the readable `detail`, so the renderer can place decorations exactly. The server is untouched: it already broadcasts the whole request object. The desktop keeps a queue of pending changes and answers each with the `permission-decision` message that exists today.

**Tech Stack:** TypeScript strict, vitest (node env), jsdiff (`diff`, already a core dependency), CodeMirror 6, React.

## Global Constraints

- Source files carry NO comments (repo rule). Test files: descriptive names only.
- TypeScript strict with `noUncheckedIndexedAccess: true` — indexed access may be `T | undefined`.
- `patch` is **optional** on `PermissionRequest`: an older desktop ignores it, and a newer desktop must cope with a server that never sends it.
- **Do not modify `packages/server`.** `server.ts:1129` broadcasts `{ type: "permission-request", id, request }` wholesale, so a new request field reaches the renderer on its own.
- `describe()` runs before the permission prompt and **must never throw** — a missing file or an unmatched `oldString` yields no patch, not an exception.
- Accept/reject is **per change**, never per hunk.
- `formatDiff` and the existing `detail` stay exactly as they are; the CLI and the chat cards keep reading them.
- Run core tests with `npx vitest run packages/core/src/<path>` and desktop tests with `npx vitest run packages/desktop/src/<path>`, from the worktree root.
- Commit after every task.

---

### Task 1: A positional patch in the core

**Files:**
- Modify: `packages/core/src/util/diff.ts`, `packages/core/src/permission/permission.ts`
- Test: `packages/core/src/util/diff.test.ts` (extend)

**Interfaces:**
- Produces: `PatchHunk { oldStart, oldLines, newStart, newLines, lines: string[] }` and `filePatch(oldStr: string, newStr: string): PatchHunk[]` from `../util/diff`; `PermissionRequest.patch?: PatchHunk[]`.

- [ ] **Step 1: Write the failing test** (append to `packages/core/src/util/diff.test.ts`)

```ts
import { filePatch } from "./diff";

describe("filePatch", () => {
  const before = "um\ndois\ntres\nquatro\ncinco\nseis\nsete\n";

  it("locates a change by its line number in the new file", () => {
    const after = "um\ndois\ntres\nQUATRO\ncinco\nseis\nsete\n";
    const hunks = filePatch(before, after);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.newStart).toBe(1);
    expect(hunks[0]!.lines).toContain("-quatro");
    expect(hunks[0]!.lines).toContain("+QUATRO");
  });

  it("returns no hunks when the two sides are identical", () => {
    expect(filePatch(before, before)).toEqual([]);
  });

  it("reports two hunks for two separated changes", () => {
    const long = Array.from({ length: 40 }, (_, i) => `linha ${i + 1}`).join("\n") + "\n";
    const edited = long.replace("linha 3", "LINHA 3").replace("linha 38", "LINHA 38");
    const hunks = filePatch(long, edited);
    expect(hunks.length).toBe(2);
    expect(hunks[0]!.newStart).toBeLessThan(hunks[1]!.newStart);
  });

  it("handles an empty original", () => {
    const hunks = filePatch("", "nova\n");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.lines.some((l) => l.startsWith("+"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `npx vitest run packages/core/src/util/diff.test.ts` → FAIL (`filePatch` is not exported).

- [ ] **Step 3: Implement `filePatch`** — add to `packages/core/src/util/diff.ts`, keeping `formatDiff` untouched:

```ts
import { diffLines, structuredPatch } from "diff";

export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export function filePatch(oldStr: string, newStr: string): PatchHunk[] {
  const patch = structuredPatch("a", "b", oldStr ?? "", newStr ?? "", "", "", { context: 3 });
  return patch.hunks.map((h) => ({
    oldStart: h.oldStart,
    oldLines: h.oldLines,
    newStart: h.newStart,
    newLines: h.newLines,
    lines: h.lines,
  }));
}
```

(The existing `import { diffLines } from "diff";` line becomes the combined import above.)

- [ ] **Step 4: Run it, verify it passes** — `npx vitest run packages/core/src/util/diff.test.ts` → the four new cases green alongside the existing ones.

- [ ] **Step 5: Add the field to `PermissionRequest`** — in `packages/core/src/permission/permission.ts`, import the type and extend the interface:

```ts
import type { PatchHunk } from "../util/diff";
```

```ts
export interface PermissionRequest {
  toolName: string;
  kind: PermissionKind;
  title: string;
  detail?: string;
  target?: string;
  patch?: PatchHunk[];
}
```

- [ ] **Step 6: Export the new symbols** — in `packages/core/src/index.ts`, add `filePatch` and `type PatchHunk` to the export that already carries `formatDiff` from `./util/diff` (if `formatDiff` is not exported there, add a new `export { filePatch, type PatchHunk } from "./util/diff";` line).

- [ ] **Step 7: Typecheck** — `cd packages/core && npx tsc --noEmit` → clean.

- [ ] **Step 8: Commit** — `git add packages/core && git commit -m "feat(core): a positional file patch on the permission request"`

---

### Task 2: write and edit describe a positional change

**Files:**
- Modify: `packages/core/src/tools/write.ts`, `packages/core/src/tools/edit.ts`
- Test: `packages/core/src/tools/tools.test.ts` (extend)

**Interfaces:**
- Consumes: `filePatch`, `PatchHunk` from `../util/diff` (Task 1).
- Produces: `describe()` on both tools returns `{ title, detail, patch }`, where `patch` positions the change **within the file**.

- [ ] **Step 1: Write the failing test** (append to `packages/core/src/tools/tools.test.ts`, following how that file already builds a temp dir and a `ctx`)

```ts
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editTool } from "./edit";
import { writeTool } from "./write";

describe("describe() carries a positional patch", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-patch-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("write positions the patch against the previous file", () => {
    writeFileSync(join(dir, "a.txt"), "um\ndois\ntres\n", "utf8");
    const out = writeTool.describe!({ path: "a.txt", content: "um\nDOIS\ntres\n" }, { cwd: dir } as never);
    expect(out.patch).toBeDefined();
    expect(out.patch!.some((h) => h.lines.includes("+DOIS"))).toBe(true);
  });

  it("edit positions the patch by where the fragment sits in the file, not in the fragment", () => {
    const body = Array.from({ length: 30 }, (_, i) => `linha ${i + 1}`).join("\n") + "\n";
    writeFileSync(join(dir, "b.txt"), body, "utf8");
    const out = editTool.describe!(
      { path: "b.txt", oldString: "linha 20", newString: "LINHA 20", replaceAll: false },
      { cwd: dir } as never,
    );
    expect(out.patch).toBeDefined();
    const hunk = out.patch![0]!;
    expect(hunk.newStart).toBeGreaterThan(10);
    expect(hunk.lines).toContain("+LINHA 20");
  });

  it("edit describes without a patch when the file is missing, and does not throw", () => {
    const out = editTool.describe!(
      { path: "nope.txt", oldString: "a", newString: "b", replaceAll: false },
      { cwd: dir } as never,
    );
    expect(out.patch).toBeUndefined();
    expect(out.title).toContain("nope.txt");
  });

  it("edit describes without a patch when oldString is not in the file", () => {
    writeFileSync(join(dir, "c.txt"), "conteudo\n", "utf8");
    const out = editTool.describe!(
      { path: "c.txt", oldString: "ausente", newString: "x", replaceAll: false },
      { cwd: dir } as never,
    );
    expect(out.patch).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `npx vitest run packages/core/src/tools/tools.test.ts` → FAIL (`patch` is undefined on both).

- [ ] **Step 3: Add the patch to `write.ts`** — replace its `describe`:

```ts
  describe(args, ctx) {
    const abs = resolveInside(ctx.cwd, args.path);
    const rel = relative(ctx.cwd, abs).split("\\").join("/");
    const exists = existsSync(abs);
    const previous = exists ? readFileSync(abs, "utf8") : "";
    return {
      title: `${exists ? "Overwrite" : "Create"} ${rel}`,
      detail: formatDiff(previous, args.content),
      patch: filePatch(previous, args.content),
    };
  },
```

and extend its import: `import { formatDiff, filePatch } from "../util/diff";`

- [ ] **Step 4: Make `edit.ts` describe positionally** — replace its `describe`, mirroring exactly the replacement `run()` performs, but tolerant:

```ts
  describe(args, ctx) {
    const abs = resolveInside(ctx.cwd, args.path);
    const rel = relative(ctx.cwd, abs).split("\\").join("/");
    const base = { title: `Edit ${rel}`, detail: formatDiff(args.oldString, args.newString) };
    if (!existsSync(abs)) return base;
    let original: string;
    try {
      original = readFileSync(abs, "utf8");
    } catch {
      return base;
    }
    if (!original.includes(args.oldString)) return base;
    const updated = args.replaceAll
      ? original.split(args.oldString).join(args.newString)
      : original.replace(args.oldString, args.newString);
    return { ...base, patch: filePatch(original, updated) };
  },
```

and extend its imports: `import { formatDiff, filePatch } from "../util/diff";` plus `existsSync` alongside the `readFileSync`/`writeFileSync` it already imports from `node:fs`.

- [ ] **Step 5: Run it, verify it passes** — `npx vitest run packages/core/src/tools/tools.test.ts` → the four new cases green, existing ones untouched.

- [ ] **Step 6: Typecheck** — `cd packages/core && npx tsc --noEmit` → clean.

- [ ] **Step 7: Commit** — `git add packages/core && git commit -m "feat(core): write and edit describe where the change lands in the file"`

---

### Task 3: The review queue and the decoration marks

**Files:**
- Create: `packages/desktop/src/renderer/review/queue.ts`, `packages/desktop/src/renderer/review/queue.test.ts`, `packages/desktop/src/renderer/review/decorations.ts`, `packages/desktop/src/renderer/review/decorations.test.ts`

**Interfaces:**
- Consumes: `PatchHunk` (type only) from `@termcoder/core` (Task 1).
- Produces:
  - `PendingChange { id, title, detail?, target?, kind, patch? }`, `ReviewQueue { items }`, `enqueue`, `resolveItem`, `resolveAll`, `findByTarget`
  - `ReviewMark { line: number; kind: "add" | "remove" }`, `marksFromPatch(hunks: PatchHunk[]): ReviewMark[]`

- [ ] **Step 1: Write the failing tests**

`packages/desktop/src/renderer/review/queue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { enqueue, resolveItem, resolveAll, findByTarget, type ReviewQueue } from "./queue";

const empty: ReviewQueue = { items: [] };
const a = { id: "1", title: "Overwrite a.ts", kind: "write", target: "src/a.ts" };
const b = { id: "2", title: "Edit b.ts", kind: "edit", target: "src/b.ts" };

describe("review queue", () => {
  it("appends in arrival order", () => {
    const q = enqueue(enqueue(empty, a), b);
    expect(q.items.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("ignores an id already queued", () => {
    const q = enqueue(enqueue(empty, a), { ...a, title: "outro" });
    expect(q.items).toHaveLength(1);
    expect(q.items[0]!.title).toBe("Overwrite a.ts");
  });

  it("does not mutate the queue it is given", () => {
    const start = enqueue(empty, a);
    enqueue(start, b);
    expect(start.items).toHaveLength(1);
  });

  it("resolveItem removes only that id", () => {
    const q = resolveItem(enqueue(enqueue(empty, a), b), "1");
    expect(q.items.map((i) => i.id)).toEqual(["2"]);
  });

  it("resolveAll empties the queue and returns every id in order", () => {
    const { next, ids } = resolveAll(enqueue(enqueue(empty, a), b));
    expect(ids).toEqual(["1", "2"]);
    expect(next.items).toEqual([]);
  });

  it("findByTarget matches a path and returns undefined otherwise", () => {
    const q = enqueue(enqueue(empty, a), b);
    expect(findByTarget(q, "src/b.ts")?.id).toBe("2");
    expect(findByTarget(q, "src/z.ts")).toBeUndefined();
  });
});
```

`packages/desktop/src/renderer/review/decorations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { marksFromPatch } from "./decorations";

describe("marksFromPatch", () => {
  it("marks an added line at its real line number", () => {
    const marks = marksFromPatch([
      { oldStart: 10, oldLines: 3, newStart: 10, newLines: 4, lines: [" a", " b", "+novo", " c"] },
    ]);
    expect(marks).toEqual([{ line: 12, kind: "add" }]);
  });

  it("marks a removed line at the position it would occupy", () => {
    const marks = marksFromPatch([
      { oldStart: 1, oldLines: 3, newStart: 1, newLines: 2, lines: [" a", "-velho", " b"] },
    ]);
    expect(marks).toEqual([{ line: 2, kind: "remove" }]);
  });

  it("handles a replacement as a remove plus an add", () => {
    const marks = marksFromPatch([
      { oldStart: 5, oldLines: 3, newStart: 5, newLines: 3, lines: [" a", "-antes", "+depois", " b"] },
    ]);
    expect(marks).toEqual([
      { line: 6, kind: "remove" },
      { line: 6, kind: "add" },
    ]);
  });

  it("keeps both hunks of a patch at their own offsets", () => {
    const marks = marksFromPatch([
      { oldStart: 1, oldLines: 2, newStart: 1, newLines: 3, lines: [" a", "+um" ] },
      { oldStart: 30, oldLines: 2, newStart: 31, newLines: 3, lines: [" z", "+dois"] },
    ]);
    expect(marks).toEqual([
      { line: 2, kind: "add" },
      { line: 32, kind: "add" },
    ]);
  });

  it("returns nothing for an empty patch", () => {
    expect(marksFromPatch([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them, verify they fail** — `npx vitest run packages/desktop/src/renderer/review` → FAIL (both modules missing).

- [ ] **Step 3: Write `queue.ts`**

```ts
import type { PatchHunk } from "@termcoder/core";

export interface PendingChange {
  id: string;
  title: string;
  detail?: string;
  target?: string;
  kind: string;
  patch?: PatchHunk[];
}

export interface ReviewQueue {
  items: PendingChange[];
}

export function enqueue(q: ReviewQueue, item: PendingChange): ReviewQueue {
  if (q.items.some((i) => i.id === item.id)) return q;
  return { items: [...q.items, item] };
}

export function resolveItem(q: ReviewQueue, id: string): ReviewQueue {
  return { items: q.items.filter((i) => i.id !== id) };
}

export function resolveAll(q: ReviewQueue): { next: ReviewQueue; ids: string[] } {
  return { next: { items: [] }, ids: q.items.map((i) => i.id) };
}

export function findByTarget(q: ReviewQueue, target: string): PendingChange | undefined {
  return q.items.find((i) => i.target === target);
}
```

- [ ] **Step 4: Write `decorations.ts`**

```ts
import type { PatchHunk } from "@termcoder/core";

export interface ReviewMark {
  line: number;
  kind: "add" | "remove";
}

export function marksFromPatch(hunks: PatchHunk[]): ReviewMark[] {
  const marks: ReviewMark[] = [];
  for (const hunk of hunks ?? []) {
    let line = hunk.newStart;
    for (const raw of hunk.lines ?? []) {
      const sign = raw.charAt(0);
      if (sign === "+") {
        marks.push({ line, kind: "add" });
        line += 1;
      } else if (sign === "-") {
        marks.push({ line, kind: "remove" });
      } else {
        line += 1;
      }
    }
  }
  return marks;
}
```

- [ ] **Step 5: Run them, verify they pass** — `npx vitest run packages/desktop/src/renderer/review` → 11 passing.

- [ ] **Step 6: Typecheck** — `cd packages/desktop && npx tsc --noEmit` → clean. (Requires `@termcoder/core` built: run `pnpm --filter @termcoder/core build` first if the type import does not resolve.)

- [ ] **Step 7: Commit** — `git add packages/desktop && git commit -m "feat(desktop): review queue and patch-to-line marks"`

---

### Task 4: The strip, the editor decorations and the wiring

**Files:**
- Create: `packages/desktop/src/renderer/review/ReviewStrip.tsx`
- Modify: `packages/desktop/src/renderer/App.tsx` (state at `:399`, the handler at `:1261-1267`, the answer at `:1395-1396`, the reset at `:1089`, the render at `:2199`), `packages/desktop/src/renderer/CodeEditor.tsx`, `packages/desktop/src/renderer/styles.css`

**Interfaces:**
- Consumes: `enqueue`, `resolveItem`, `resolveAll`, `findByTarget`, `PendingChange`, `ReviewQueue` from `./review/queue`; `marksFromPatch`, `ReviewMark` from `./review/decorations` (Task 3).
- Produces: `<ReviewStrip queue onAccept onReject onAcceptAll />`.

This task has no unit test: it is React and CodeMirror wiring, verified by typecheck, build and launching the app.

- [ ] **Step 1: Write `ReviewStrip.tsx`**

```tsx
import type { ReviewQueue } from "./queue";

export function ReviewStrip({
  queue,
  openFile,
  onAccept,
  onReject,
  onAcceptAll,
}: {
  queue: ReviewQueue;
  openFile?: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
}) {
  const current = queue.items[0];
  if (!current) return null;
  const inEditor = Boolean(current.target && current.target === openFile && current.patch?.length);
  return (
    <div className="review-strip">
      <div className="review-strip-head">
        <span className="review-strip-count">
          {queue.items.length === 1 ? "1 change waiting" : `${queue.items.length} changes waiting`}
        </span>
        <span className="review-strip-title">{current.title}</span>
      </div>
      {!inEditor && current.detail && <pre className="review-strip-diff">{current.detail}</pre>}
      <div className="review-strip-actions">
        <button className="review-accept" onClick={() => onAccept(current.id)}>
          Accept
        </button>
        <button className="review-reject" onClick={() => onReject(current.id)}>
          Reject
        </button>
        {queue.items.length > 1 && (
          <button className="review-accept-all" onClick={onAcceptAll}>
            Accept all
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap the single permission for the queue in `App.tsx`**

Replace the state at `:399`:
```tsx
  const [reviewQueue, setReviewQueue] = useState<ReviewQueue>({ items: [] });
```
importing `import { enqueue, resolveItem, resolveAll, type ReviewQueue } from "./review/queue";` and `import { ReviewStrip } from "./review/ReviewStrip";`.

Replace the handler body at `:1261-1267` (keeping the auto-approve branch exactly as it is):
```tsx
    if (e.type === "permission-request") {
      if (autoApproveRef.current && e.request.kind !== "network") {
        wsRef.current?.send(JSON.stringify({ type: "permission-decision", id: e.id, decision: "allow" }));
        return;
      }
      setReviewQueue((q) =>
        enqueue(q, {
          id: e.id,
          title: e.request.title,
          detail: e.request.detail,
          target: e.request.target,
          kind: e.request.kind,
          patch: e.request.patch,
        }),
      );
      return;
    }
```

Replace the answer path at `:1395-1396` with one function per action:
```tsx
  const answer = (id: string, decision: "allow" | "deny") => {
    wsRef.current?.send(JSON.stringify({ type: "permission-decision", id, decision }));
    setReviewQueue((q) => resolveItem(q, id));
  };
  const answerAll = () => {
    setReviewQueue((q) => {
      const { next, ids } = resolveAll(q);
      for (const id of ids) {
        wsRef.current?.send(JSON.stringify({ type: "permission-decision", id, decision: "allow" }));
      }
      return next;
    });
  };
```

At `:1089`, where `setPerm(null)` cleared the pending prompt on a new run or a dropped socket, clear the queue instead: `setReviewQueue({ items: [] });`.

At `:2199`, replace the `{perm && !isGuest ? (…modal…) : null}` block with:
```tsx
          {!isGuest ? (
            <ReviewStrip
              queue={reviewQueue}
              openFile={openFilePath}
              onAccept={(id) => answer(id, "allow")}
              onReject={(id) => answer(id, "deny")}
              onAcceptAll={answerAll}
            />
          ) : null}
```
where `openFilePath` is the workspace-relative path of the file currently open in the editor — the same value the editor already tracks; pass it through if it is not already in scope.

- [ ] **Step 3: Paint the marks in `CodeEditor.tsx`** — accept a `marks?: ReviewMark[]` prop and turn it into line decorations:

```tsx
import { Decoration, type DecorationSet, EditorView, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { marksFromPatch, type ReviewMark } from "./review/decorations";

const setReviewMarks = StateEffect.define<ReviewMark[]>();

const reviewField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setReviewMarks)) {
        const builder = new RangeSetBuilder<Decoration>();
        const total = tr.state.doc.lines;
        for (const m of e.value) {
          if (m.line < 1 || m.line > total) continue;
          const line = tr.state.doc.line(m.line);
          builder.add(
            line.from,
            line.from,
            Decoration.line({ class: m.kind === "add" ? "cm-review-add" : "cm-review-remove" }),
          );
        }
        return builder.finish();
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});
```

Add `reviewField` to the editor's extensions, and in the effect that already reacts to prop changes dispatch `view.dispatch({ effects: setReviewMarks.of(marks ?? []) })` whenever `marks` changes. In `App.tsx`, compute the prop as `marksFromPatch(findByTarget(reviewQueue, openFilePath ?? "")?.patch ?? [])`.

- [ ] **Step 4: Style the strip and the marks** — append to `packages/desktop/src/renderer/styles.css`:

```css
.review-strip { border-bottom: 1px solid var(--border); background: var(--bg-raised); padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
.review-strip-head { display: flex; align-items: baseline; gap: 10px; }
.review-strip-count { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
.review-strip-title { font-size: 13px; color: var(--fg); }
.review-strip-diff { max-height: 220px; overflow: auto; margin: 0; font-size: 12px; line-height: 1.5; color: var(--muted); }
.review-strip-actions { display: flex; gap: 8px; }
.review-strip-actions button { border: 1px solid var(--border); background: transparent; color: var(--fg); border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
.review-accept { border-color: color-mix(in srgb, var(--accent) 50%, transparent) !important; }
.cm-review-add { background: color-mix(in srgb, #3fb950 16%, transparent); }
.cm-review-remove { background: color-mix(in srgb, #f85149 16%, transparent); }
```

- [ ] **Step 5: Typecheck and build** — `pnpm --filter @termcoder/core build` then `pnpm --filter @termcoder/desktop typecheck` (clean) and `pnpm --filter @termcoder/desktop build` (succeeds).

- [ ] **Step 6: Launch and verify by hand** — `unset ELECTRON_RUN_AS_NODE` then `pnpm --filter @termcoder/desktop dev`. Open a project, ask the agent to change one file, and check: the strip appears instead of a modal; with that file open the changed lines are tinted in place; Accept applies the change and the strip disappears; Reject leaves the file untouched. (Note: `predev` rebuilds better-sqlite3 for Electron's ABI, so `pnpm install` is needed before running node tests again.)

- [ ] **Step 7: Commit** — `git add packages/desktop && git commit -m "feat(desktop): review changes in the editor instead of a modal"`

---

## Self-review notes

- Spec coverage: `filePatch` + `PermissionRequest.patch` (T1); both tools describing positionally, tolerantly (T2); the pure queue and the patch-to-mark mapping with their tests (T3); the strip, the editor decorations, the `App.tsx` wiring and the CSS (T4). The server is untouched throughout, as the spec requires. Backwards compatibility holds because `patch` is optional and every consumer guards on it.
- No placeholders: every step carries its code or an exact command. Task 4 states plainly that it has no unit test and how it is verified instead.
- Types consistent: `PatchHunk` is defined in T1 and consumed by T2, T3 and T4; `PendingChange`/`ReviewQueue` come from T3's `queue.ts` and are used by T4; `ReviewMark`/`marksFromPatch` likewise. `answer(id, decision)` and `answerAll()` are the only two callers of the WebSocket message.
- The `describe()`-must-not-throw constraint is honoured by T2's early returns, and covered by the missing-file and unmatched-`oldString` tests.
