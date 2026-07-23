# Canvas 2.0 — a richer, explorable agent-run canvas

Date: 2026-07-23
Status: approved design, pending implementation plan
Package: `@termcoder/desktop` (renderer)

## Summary

Upgrade the existing AgentCanvas (a live graph of the agent run) into an
explorable view: **zoom/pan + fit-to-view** navigation, **per-node metrics**
(tokens, duration, tool count) on the card, a **richer inspector** (full tool
I/O with copy, scrollable reasoning, node metrics), and **collapsible
subtrees** with **clear error highlighting**. Balanced scope — the essential
of each direction, nothing exhaustive.

## Goals

- Navigate larger runs: mouse-wheel zoom, drag-to-pan, a fit-to-view button, and zoom +/− / reset.
- See each node's cost at a glance: `↓in ↑out` tokens, duration, and tool count on the card.
- Inspect deeply: a detail panel with node metrics, scrollable reasoning, and each tool's full output with a copy button.
- Tame complex runs: collapse/expand a node's subtree; error nodes and error tools are visually obvious.
- Keep the pure logic (reducer, layout, fit math) unit-tested.

## Non-goals

- No timeline/Gantt, no replay/scrub, no alternative layouts (radial), no cost-in-dollars — deferred (the user chose the balanced set, not the "rich visual" or deep-explore directions).
- No editing/re-running from the canvas; it stays a read-only visualization.
- No persistence of viewport state across sessions.

## Existing context

- `packages/desktop/src/renderer/canvas/runGraph.ts` — `RunGraph`/`RunNode`
  and `reduceGraph(graph, event)`. `RunNode = { id, agent, status, reasoning,
  activity: RunActivity[], parentId?, prompt? }`; `RunActivity = { id, name,
  title?, detail?, output?, isError?, done }`. The `usage` event
  (`{ inputTokens, outputTokens, sourceId }`) is currently ignored; there are
  no timestamps.
- `canvas/layout.ts` — `layoutGraph(graph)` → `{ [id]: {x, y} }`, depth-based
  (depth via `parentId`, one row per depth, centered per level; `COL=220`,
  `ROW=140`).
- `canvas/AgentCanvas.tsx` — renders SVG edges + absolutely-positioned node
  buttons inside `.agent-canvas-scroll`; clicking a node opens an `Inspector`.
  `NODE_W=168`, `NODE_H=92`. Rendered from `App.tsx`:
  `<AgentCanvas graph={graph} hidden={centerTab !== "canvas"} />`.
- Renderer code — `Date.now()` is available (unlike workflow scripts).
- CSS lives in `styles.css` under `.agent-canvas*`, `.agent-node*`,
  `.agent-edge`, `.agent-inspector*`, `.agent-tool*`.

## Architecture

Split the growing `AgentCanvas.tsx` into focused units; keep the reducer and
layout pure and tested.

### Data model — `runGraph.ts`
- Extend `RunNode` with: `tokensIn: number`, `tokensOut: number`,
  `startedAt: number`, `endedAt?: number`. `emptyGraph` seeds the root with
  `tokensIn: 0, tokensOut: 0, startedAt: <now>`.
- `reduceGraph` gains a `now: number` parameter (injected, default
  `Date.now()`) so tests are deterministic: `reduceGraph(graph, event, now)`.
- New handling:
  - `usage` → `node.tokensIn += inputTokens; node.tokensOut += outputTokens`.
  - node creation (`subagent-start`) → `startedAt: now`, `tokensIn/Out: 0`.
  - `done`/`error` (and `subagent-end`) → `endedAt = now`.
- Duration is derived by consumers: `endedAt ?? now) - startedAt`. Tool count
  is `activity.length` (no stored field).

### Layout — `layout.ts`
- `layoutGraph(graph, collapsed: Set<string> = new Set())`. A node is HIDDEN
  if any ancestor (walk `parentId`) is in `collapsed`. Hidden nodes get no
  position; depth-grouping and centering run over visible nodes only. Signature
  stays backward compatible (empty set = today's behavior).

### Navigation — `useZoomPan.ts` (new hook)
- `useZoomPan(contentSize)` returns `{ scale, tx, ty, onWheel, onPointerDown,
  fit, zoomIn, zoomOut, reset, bind }`.
- State: `scale` (clamped 0.25–2), `tx`, `ty`. Wheel adjusts `scale` about the
  cursor; pointer-drag on the background pans (`tx/ty`). `fit(bounds, viewport)`
  computes `scale = clamp(min(vw/bw, vh/bh) * 0.9)` and centers via `tx/ty` —
  this is the pure function that gets a unit test. `reset` → identity.
- The hook is presentation-agnostic (pure math + handlers); AgentCanvas applies
  `transform: translate(tx,ty) scale(scale)` to the inner content layer.

### Presentation
- `NodeCard.tsx` — one node button: name, status pill, current activity, plus a
  metrics row (`↓{in} ↑{out}` · `{duration}` · `{n} tools`, tabular-nums). Adds
  an `error` visual when `status === "error"`, and a collapse chevron when the
  node has children (calls back to toggle).
- `Inspector.tsx` — the detail panel: header (agent name + close); a metrics
  strip (status · duration · `↓in ↑out` · tool count); the prompt; reasoning in
  a scrollable block; then each tool as a row with name, an error flag, the full
  `output` in a scrollable `<pre>`, and a copy button (`navigator.clipboard`).
- `AgentCanvas.tsx` — orchestrator: holds `selected`, `collapsed: Set`, wires
  `useZoomPan`, computes visible layout, renders the edges + `NodeCard`s inside
  the transformed layer, the toolbar (fit / + / − / reset), and the `Inspector`.
- A small helpers module `format.ts` — `formatDuration(ms)` (`"1.2s"`,
  `"340ms"`, `"2m 05s"`) and `formatTokens(n)` (`"1.2k"`), unit-tested.

### Toolbar
- A floating control cluster (bottom-right of the canvas): `fit`, `zoom in`,
  `zoom out`, `reset`. Icon buttons, our tokens, `-webkit-app-region: no-drag`
  not needed here (inside content, not titlebar).

## Data flow

```
session events --reduceGraph(graph,event,now)--> RunGraph (now with tokens + timestamps)
AgentCanvas: layoutGraph(graph, collapsed) -> positions of visible nodes
  useZoomPan -> transform(tx,ty,scale) on the content layer
  NodeCard per visible node (metrics derived: duration = (endedAt??now)-startedAt, tools = activity.length)
  click node -> Inspector(node)  ; chevron -> toggle collapsed
  toolbar fit -> useZoomPan.fit(bounds(positions), viewportRect)
```

## Error handling

- Collapsing a selected node's ancestor hides it; if the currently-`selected`
  node becomes hidden, keep the inspector open (selection by id is still valid)
  — no crash, and expanding restores it. (Simpler than clearing selection.)
- `navigator.clipboard` may reject (focus/permissions); the copy button catches
  and briefly shows a "copy failed" state — never throws.
- Empty graph / single root: fit and layout handle a 1-node graph (bounds = that
  node); no division by zero (guard `bw||1`, `bh||1`).

## Testing

Pure-logic unit tests (vitest):
- `runGraph.test.ts` (extend existing): `usage` accumulates tokens on the right
  node by `sourceId`; `subagent-start` stamps `startedAt`; `done`/`error`/
  `subagent-end` stamp `endedAt`; injected `now` is used.
- `layout.test.ts` (extend): a node under a collapsed ancestor gets no position;
  siblings re-center over visible nodes; empty collapsed set == prior output.
- `useZoomPan` fit math: `fit(bounds, viewport)` returns a scale that fits and a
  translate that centers; clamps to [0.25, 2]; 1-node/zero-size guarded.
- `format.test.ts`: duration and token formatting cases.

Source files carry NO comments (repo rule). Follow existing renderer patterns.

## File layout

```
packages/desktop/src/renderer/canvas/
  runGraph.ts          (extend model + reducer; +tests)
  layout.ts            (collapse-aware; +tests)
  useZoomPan.ts        (new hook; fit math +test)
  format.ts            (new; duration/token format +test)
  NodeCard.tsx         (new)
  Inspector.tsx        (new; extracted + enriched)
  AgentCanvas.tsx      (slimmed to orchestrator)
packages/desktop/src/renderer/styles.css   (.agent-canvas* additions)
```

## Rollout

Single implementation plan, TDD per unit. Additive to the existing canvas tab;
no changes outside `canvas/` and the canvas CSS block.
