# Review surface — reviewing the agent's edits in the editor

Date: 2026-07-28
Status: approved design, pending implementation plan
Packages: `@termcoder/core` (a positional patch on the permission request), `@termcoder/desktop` (the review UI)

## Summary

Today, when the agent wants to write a file, the desktop shows a blocking modal with a diff and waits for allow/deny. This replaces that modal with a **review surface**: a non-blocking strip listing the changes waiting on you, and — when the file is open — the change drawn **inside the editor** as added/removed line decorations, where you are already reading the code. Accept and reject answer the same permission protocol that exists today.

To place those decorations correctly, the permission request carries a **positional patch** alongside the existing human-readable diff. That is a small, contained addition to the core; the server needs no change at all.

## Why

The agent already does what Cursor's Composer does — multi-file edits, streaming, diffs, permission prompts, checkpoints. What it lacks is Cursor's *review experience*: the diff arrives as a popup that covers the screen, disconnected from the code it describes. Moving the same information into the editor is the whole difference.

## Goals

- A pending change no longer takes over the screen: a strip ("1 change waiting") plus the change shown in context.
- When the target file is open, the change renders as inline added/removed decorations **at the correct lines**.
- Accept and reject per change, plus accept-all, answering with the existing `permission-decision` message.
- The queue and the patch-to-decoration mapping are pure, unit-tested modules — no React, no CodeMirror.

## Non-goals

- Staging writes in the core so several files can be reviewed as one batch (see "Known limitation").
- Per-hunk accept/reject inside a single file. Accept/reject is per change.
- Changing the permission protocol's shape beyond adding one optional field, or touching the CLI.
- Replacing the chat's tool cards, which keep showing what happened after the fact.

## Existing context (verified)

- `packages/desktop/src/renderer/App.tsx:1261-1267` — on `permission-request`, auto-approves when `autoApprove` is on and the kind is not `network`, otherwise `setPerm({ id, title, detail })`: **one item at a time**, rendered as a modal. `App.tsx:1395` answers with `{ type: "permission-decision", id, decision }`.
- `PermissionRequest` (`packages/core/src/permission/permission.ts`): `{ toolName, kind, title, detail?, target? }`. `target` is the path relative to the workspace root.
- `packages/server/src/server.ts:1129` broadcasts `{ type: "permission-request", id, request }` — **the whole request object**, so a new field reaches the renderer with no server change.
- `packages/core/src/util/diff.ts` `formatDiff` produces a **human-readable** diff only: `+`/`-`/two-space prefixes, **no line numbers, no hunk headers**, and it collapses long context into `… (N unchanged lines)`. It is good for reading and useless for positioning — which is why a separate positional patch is needed.
- `write.ts describe()` returns `{ title, detail: formatDiff(previous, args.content) }`, and only `run()` writes. `edit.ts describe()` returns `formatDiff(args.oldString, args.newString)` — a diff of the two fragments, with no reference to where they sit in the file.
- `diff` (jsdiff) is already a core dependency and exposes `structuredPatch`, verified to return `{ oldStart, oldLines, newStart, newLines, lines: [" um", "-dois", "+DOIS", …] }`.
- `PermissionDecision = "allow" | "deny" | "allow-always"`. The editor is CodeMirror 6 (`CodeEditor.tsx`).

## Architecture

### Core — one new helper, two tools enriched

`packages/core/src/util/diff.ts` gains, beside `formatDiff`:

```ts
export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}
export function filePatch(oldStr: string, newStr: string): PatchHunk[];
```

built on `structuredPatch`. `PermissionRequest` gains `patch?: PatchHunk[]`.

- `write.ts describe()` adds `patch: filePatch(previous, args.content)` — it already reads the previous content.
- `edit.ts describe()` becomes positional: read the file, apply the same replacement `run()` would, and return `patch: filePatch(fileContent, newFileContent)`. Its `detail` stays as it is, so the chat and the CLI keep reading the same text.

Everything else in the core is untouched; `detail` remains the human-readable form for permissions that have no file behind them.

### Desktop — three units

**`renderer/review/queue.ts`** — pure state:

```ts
export interface PendingChange {
  id: string;
  title: string;
  detail?: string;
  target?: string;
  kind: string;
  patch?: PatchHunk[];
}
export interface ReviewQueue { items: PendingChange[] }

export function enqueue(q: ReviewQueue, item: PendingChange): ReviewQueue;
export function resolveItem(q: ReviewQueue, id: string): ReviewQueue;
export function resolveAll(q: ReviewQueue): { next: ReviewQueue; ids: string[] };
export function findByTarget(q: ReviewQueue, target: string): PendingChange | undefined;
```

Immutable, no duplicate ids. `findByTarget` answers "is there a pending change for the file I have open?".

**`renderer/review/decorations.ts`** — patch to editor ranges, pure and CodeMirror-free:

```ts
export interface ReviewMark { line: number; kind: "add" | "remove" }
export function marksFromPatch(hunks: PatchHunk[]): ReviewMark[];
```

Walks each hunk from `newStart`, advancing the line counter on context and added lines, emitting `add` for `+` lines and `remove` for `-` lines (a removed line marks the position it would have occupied).

**`renderer/review/ReviewStrip.tsx`** — the non-modal strip: count, current title, target path, the readable `detail` when the file is not open, and **Accept** / **Reject** / **Accept all**.

`CodeEditor.tsx` gains a small addition that takes the marks for the open file and paints line decorations (`cm-review-add` / `cm-review-remove`). `App.tsx` swaps its single `perm` for the queue.

## Data flow

```
agent calls write/edit
  → describe() computes detail (readable) and patch (positional); the write waits on permission
  → server broadcasts { type:"permission-request", id, request:{ title, detail, target, kind, patch } }
  → App enqueues it — no modal
  → strip shows "1 change waiting"; if request.target is the open file,
    marksFromPatch(patch) paints the added/removed lines at their real positions
  → Accept → { type:"permission-decision", id, decision:"allow" } → run() writes
    Reject → decision "deny" → nothing is written
  → the item leaves the queue
```

## Error handling

- A request without `patch` (bash, network, or an older server) still enqueues and shows its `detail` in the strip; there is simply nothing to decorate.
- A request whose `target` is not the open file shows its `detail` in the strip.
- `marksFromPatch` on an empty or malformed hunk list returns no marks rather than throwing; a decoration failure never blocks accept or reject.
- If the socket drops with items pending, the queue is cleared on reconnect: the run has ended and stale ids would answer nothing.
- Accept-all sends one decision per id, in order, so each waiting tool call resolves.
- Because the permission request is broadcast to everyone in a live room, the patch reaches guests exactly as the diff already does today. No new class of information leaves the host.

## Known limitation (deliberate)

The agent asks permission **per write and waits**, so with a single agent the queue rarely holds more than one item. The gain in this slice is that the change moves into the editor and stops blocking the screen — not batching. Reviewing five files together needs the core to accumulate writes and apply them at the end, which touches the CLI and the server too; that is a separate slice, and this UI receives it unchanged.

## Testing (vitest, node env)

- `diff.test.ts` (core) — `filePatch` returns a hunk with the right `newStart` for a one-line change in the middle of a file, returns an empty array when the two sides are identical, and marks added and removed lines with `+`/`-` prefixes.
- `edit.test.ts` / `write.test.ts` (core) — `describe()` now includes a `patch` whose hunk positions match where the change lands **in the file**, not in the fragment.
- `queue.test.ts` — enqueue appends and ignores a duplicate id; `resolveItem` removes only that id; `resolveAll` empties the queue and returns every id in order; `findByTarget` matches the path and returns undefined otherwise.
- `decorations.test.ts` — `marksFromPatch` on a hunk starting at `newStart: 10` marks the added line at its real line number; a hunk with several context lines before the change offsets correctly; two hunks in one patch both land right; an empty list yields no marks.
- The strip and the CodeMirror decorations are verified by launching the app.

## File layout

```
packages/core/src/util/diff.ts                        (filePatch + PatchHunk)
packages/core/src/util/diff.test.ts                   (extend)
packages/core/src/permission/permission.ts            (PermissionRequest.patch?)
packages/core/src/tools/write.ts                      (describe adds patch)
packages/core/src/tools/edit.ts                       (describe becomes file-positional)
packages/desktop/src/renderer/review/queue.ts         (+ test)
packages/desktop/src/renderer/review/decorations.ts   (+ test)
packages/desktop/src/renderer/review/ReviewStrip.tsx
packages/desktop/src/renderer/App.tsx                 (queue instead of a single perm)
packages/desktop/src/renderer/CodeEditor.tsx          (paint marks for the open file)
packages/desktop/src/renderer/styles.css              (cm-review-add / cm-review-remove)
```

## Rollout

Single implementation plan: TDD for `filePatch`, the enriched `describe()`s, `queue.ts` and `decorations.ts`; the UI wiring verified by launching the app. Backwards compatible in both directions — `patch` is optional, so an older desktop ignores it and a newer desktop copes with a server that does not send it. Source files carry NO comments (repo rule).
