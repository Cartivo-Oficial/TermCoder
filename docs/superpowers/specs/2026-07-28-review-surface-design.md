# Review surface — reviewing the agent's edits in the editor

Date: 2026-07-28
Status: approved design, pending implementation plan
Package: `@termcoder/desktop` (renderer only)

## Summary

Today, when the agent wants to write a file, the desktop shows a blocking modal with the diff and waits for allow/deny. This replaces that modal with a **review surface**: a non-blocking strip listing the changes waiting on you, and — when the file is open — the diff drawn **inside the editor** as CodeMirror decorations, where you are already reading the code. Accept and reject answer the same permission protocol that exists today.

**No change to `@termcoder/core` or `@termcoder/server`.** The staging point already exists: tools separate `describe()` (which computes the diff) from `run()` (which writes), and nothing is written until the permission gate resolves. This work only changes how the desktop presents that gate.

## Why

The agent already does what Cursor's Composer does — multi-file edits, streaming, diffs, permission prompts, checkpoints. What it lacks is Cursor's *review experience*: the diff arrives as a popup that covers the screen, disconnected from the code it describes. Moving the same information into the editor is the whole difference.

## Goals

- A pending change no longer takes over the screen. It appears as a strip ("1 change waiting") plus the diff in context.
- When the target file is open in the editor, the change renders as inline added/removed line decorations at the right position.
- Accept and reject per change, plus accept-all, answering with the existing `permission-decision` message.
- The queue is a pure, testable module — no React, no CodeMirror — so its behaviour is covered by unit tests.

## Non-goals

- Staging writes in the core so several files can be reviewed as one batch (see "Known limitation").
- Per-hunk accept/reject inside a single file. Accept/reject is per change.
- Touching the CLI, the server, or the permission protocol itself.
- Replacing the chat's tool cards, which keep showing what happened after the fact.

## Existing context (verified)

- `packages/desktop/src/renderer/App.tsx:1261-1267` — on `permission-request`, auto-approves when `autoApprove` is on and the kind is not `network`, otherwise `setPerm({ id, title: e.request.title, detail: e.request.detail })`: **one item at a time**, rendered as a modal.
- `App.tsx:1395` — answers with `{ type: "permission-decision", id, decision }` over the session WebSocket.
- `PermissionRequest` (`packages/core/src/permission/permission.ts`): `{ toolName, kind, title, detail?, target? }`. `target` is the path relative to the workspace root; `detail` already carries the unified diff.
- `packages/core/src/tools/write.ts` — `describe()` returns `{ title, detail: formatDiff(previous, content) }` and only `run()` writes. `edit.ts` follows the same shape. This is why nothing needs to change server-side: the diff exists before the write, and the write waits on the decision.
- `PermissionDecision = "allow" | "deny" | "allow-always"`.
- The editor is CodeMirror 6 (`CodeEditor.tsx`), which the review decorations attach to.

## Architecture

Three units, each with one responsibility:

### 1. `renderer/review/queue.ts` — pure state, no UI

```ts
export interface PendingChange {
  id: string;
  title: string;
  detail: string;
  target?: string;
  kind: string;
}

export interface ReviewQueue {
  items: PendingChange[];
}

export function enqueue(q: ReviewQueue, item: PendingChange): ReviewQueue;
export function resolveItem(q: ReviewQueue, id: string): ReviewQueue;
export function resolveAll(q: ReviewQueue): { next: ReviewQueue; ids: string[] };
export function findByTarget(q: ReviewQueue, target: string): PendingChange | undefined;
```

Immutable updates, no duplicate ids. `findByTarget` is what lets the editor ask "is there a pending change for the file I have open?".

### 2. `renderer/review/diffDecorations.ts` — diff text to editor decorations

```ts
export interface DiffLine {
  kind: "add" | "remove" | "context";
  text: string;
  newLine?: number;
}
export function parseUnifiedDiff(detail: string): DiffLine[];
export function decorationsFor(lines: DiffLine[]): Array<{ from: number; to: number; className: string }>;
```

`parseUnifiedDiff` reads the `formatDiff` output the core already produces (hunk headers `@@ -a,b +c,d @@`, then `+`/`-`/space lines) and tracks the new-file line numbers. `decorationsFor` maps those to line ranges with `cm-review-add` / `cm-review-remove` classes. Both are pure and unit-tested; neither imports CodeMirror.

### 3. `renderer/review/ReviewStrip.tsx` — the UI

A non-modal strip above the editor: the count, the current change's title, its target path, the diff (for the case where the file is not open), and **Accept** / **Reject** / **Accept all** buttons. Rendering the decorations inside `CodeEditor` is a small addition there that reads the queue and applies `decorationsFor`.

### Wiring in `App.tsx`

`setPerm` (single) becomes the queue. The `permission-request` branch enqueues instead of replacing; the answer path resolves one id (or all) and sends a `permission-decision` per id. Auto-approve keeps its current behaviour, ahead of the queue.

## Data flow

```
agent calls write/edit
  → core describe() computes the diff, permission gate opens
  → server broadcasts { type: "permission-request", id, request:{ title, detail, target, kind } }
  → App enqueues it (no modal)
  → strip shows "1 change waiting"; if request.target is the open file,
    CodeEditor paints the added/removed lines inline
  → user clicks Accept  → { type:"permission-decision", id, decision:"allow" } → core run() writes
             or Reject  → decision "deny" → nothing is written
  → item leaves the queue
```

## Error handling

- A request without `detail` (a bash or network permission, say) still enqueues and shows its title; there is simply nothing to decorate.
- A request whose `target` is not the open file shows its diff in the strip instead of the editor.
- A malformed diff makes `parseUnifiedDiff` return the lines it understood; decoration failure never blocks accept or reject.
- If the socket drops with items pending, the queue is cleared on reconnect — the agent's run has ended, and stale ids would answer nothing.
- Accept-all sends one decision per id, in order, so the server resolves each waiting tool call.

## Known limitation (deliberate)

The agent asks permission **per write and waits**, so with a single agent the queue rarely holds more than one item. The gain in this slice is that the diff moves into the editor and stops blocking the screen — not batching. Reviewing five files together needs the core to accumulate writes and apply them at the end, which touches the CLI and server too; that is a separate slice, and this UI is built to receive it unchanged.

## Testing (vitest, node env)

- `queue.test.ts` — enqueue appends and ignores duplicate ids; `resolveItem` removes only that id; `resolveAll` empties the queue and returns every id in order; `findByTarget` matches the path and returns undefined otherwise.
- `diffDecorations.test.ts` — `parseUnifiedDiff` on a real `formatDiff` output classifies add/remove/context and assigns the right new-file line numbers across two hunks; a diff with no hunk header yields no decorations rather than throwing; `decorationsFor` emits one range per added and removed line with the expected class.
- The strip and the CodeMirror decorations are verified by running the app.

## File layout

```
packages/desktop/src/renderer/review/queue.ts             (pure queue)
packages/desktop/src/renderer/review/queue.test.ts
packages/desktop/src/renderer/review/diffDecorations.ts   (diff -> decorations, pure)
packages/desktop/src/renderer/review/diffDecorations.test.ts
packages/desktop/src/renderer/review/ReviewStrip.tsx      (the strip)
packages/desktop/src/renderer/App.tsx                     (queue instead of a single perm)
packages/desktop/src/renderer/CodeEditor.tsx              (apply decorations for the open file)
packages/desktop/src/renderer/styles.css                  (cm-review-add / cm-review-remove)
```

## Rollout

Single implementation plan: TDD for `queue.ts` and `diffDecorations.ts`, then the UI wiring verified by launching the app. Additive and reversible — the permission protocol is untouched, so an older desktop keeps working against the same server. Source files carry NO comments (repo rule).
