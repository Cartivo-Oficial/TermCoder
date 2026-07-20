# Agent Canvas — Phase 1 (live run visualization) design

base: b458dbf (0.11.2 in progress)
status: design (awaiting user review) — SPEC ONLY, not scheduled for implementation yet

## Vision and decomposition

The user wants a node canvas where agents appear as cards that visibly work, you can connect them, and you can see an agent's "brain." That is too large for one spec, so it is split:

- **Phase 1 (this spec) — see the brain:** a canvas that *observes* a live run. The primary agent and every sub-agent it spawns appear as connected nodes, laid out automatically; selecting a node shows its live reasoning and tool timeline. Built on the existing event stream plus one enabling change (sub-event forwarding). No manual wiring.
- **Phase 2 (future spec) — author flows:** drag agent nodes, connect them into a pipeline, save and run. Needs a graph *execution engine*; builds on Phase 1's rendering. Out of scope here.

## The core constraint this design solves

Today a sub-agent (`task` tool, `packages/core/src/agent/subagent.ts`) runs its own `Session` and consumes that session's events **internally** — the parent stream sees only a `tool-call` ("task") when it starts and a `tool-result` (summary) when it ends. The sub-agent's reasoning and tool-calls are swallowed. So a canvas built on the current stream could show the primary agent's brain live but sub-agents only as "running → done."

Phase 1's enabling change is to **forward** a sub-agent's session events onto the parent stream, tagged with the sub-session id, so every node gets a live brain.

## Architecture

### 1. Sub-event forwarding (core)

`SessionEvent` (`session.ts:25-33`) today:
```
text-delta | reasoning-delta | reasoning-end | tool-call | tool-result | usage | done | error
```

Additions:
- Every event gains an optional `sourceId?: string`. Absent/empty = the primary agent. Present = the sub-session that emitted it. (Non-breaking: existing consumers ignore it.)
- Two new variants for graph structure:
  - `{ type: "subagent-start"; sessionId: string; agent: string; prompt: string; parentToolCallId?: string }`
  - `{ type: "subagent-end"; sessionId: string; status: "done" | "error" }`

Mechanism — a tool emit channel:
- `ToolContext` (`tools/types.ts:5`, currently `{ cwd }`) gains `emit?: (event: SessionEvent) => void`.
- The session, when it invokes a tool, passes an `emit` that pushes the event onto the session's own output stream (interleaved with the model events it already yields). This gives any tool a way to surface live sub-events, not just a final result.
- `createSubagentTool.run` uses it: on start, `ctx.emit({ type: "subagent-start", sessionId: sub.record.id, agent, prompt, parentToolCallId: ctx.toolCallId })`; for each event from `sub.prompt(...)`, `ctx.emit({ ...event, sourceId: sub.record.id })` (in addition to the existing text/tools collection for the returned summary); on completion, `ctx.emit({ type: "subagent-end", sessionId, status })`. The returned `ToolResult` (summary) is unchanged, so non-canvas consumers are unaffected.
- `ctx.toolCallId` — the session must pass the current tool-call id into `ToolContext` so `subagent-start` can link to its spawning `tool-call` (add `toolCallId?: string` to `ToolContext`).

Depth: nested sub-agents (a sub-agent spawning its own sub-agent) forward transitively — each carries its own `sourceId`, and `parentToolCallId`/spawn chain lets the client nest them. A depth cap already exists in the product (sub-agents shouldn't launch nested sub-agents by default — align with that; do not expand nesting here).

### 2. Server relay (no change expected)

The desktop session WebSocket already relays `SessionEvent`s verbatim (`roomBroadcast` / the session stream). The new variants and `sourceId` are just more `SessionEvent`s and flow through unchanged. The spec's plan will verify the relay is transparent (no allow-list that drops unknown event types).

### 3. Client run-graph model

A new hook/store (desktop renderer) consumes the event stream and maintains:
```
RunGraph {
  nodes: Map<nodeId, {
    id: string;            // primary = the session id; sub = the sub-session id
    agent: string;         // "primary" or the specialist name
    status: "idle" | "thinking" | "tool" | "done" | "error";
    reasoning: string;     // accumulated reasoning-delta
    activity: Array<{ id; name; title?; detail?; output?; isError?; done: boolean }>; // tool timeline
    parentId?: string;     // spawn parent
    prompt?: string;       // for sub-agents
  }>;
  rootId: string;
}
```
Reducer: `subagent-start` adds a node + edge (parent = the node whose tool-call id === parentToolCallId; fall back to root); events with `sourceId` update that node, without go to root; `tool-call`/`tool-result` append/close activity entries; `reasoning-delta` appends; `subagent-end`/`done`/`error` set status. Pure and unit-testable (the reducer is the place bugs hide — it carries the tests).

### 4. Canvas UI (desktop)

- A new **Canvas** view, a sibling of the existing Chat/Terminal center tabs, fed by the same session events the chat already receives (wire the reducer into the existing `onEvent`).
- **Auto-layout:** a simple tree/dagre-style layout (root at top, children below, by spawn depth). Phase 1 is observe-only — no drag, no manual edges. Positions are derived, not stored.
- **Node card:** agent name + a status indicator that pulses while active, the current tool name when running, and a compact activity count. Distinct look for primary vs specialist. Uses existing theme tokens (light/dark).
- **Edges:** simple curved connectors parent→child, animated/highlighted while the child is active.
- **Inspector:** selecting a node opens a side panel showing that node's full reasoning stream and tool timeline (call → args/title → result) — the "brain." Reuses the chat's existing reasoning/tool rendering where possible.
- **Empty/idle:** before any run, a single primary node; the canvas populates as the agent works and spawns.

### 5. Scope guards (Phase 1)

- **Observe only.** No node creation, dragging, connecting, saving, or running from the canvas — that is Phase 2.
- **Live + current run.** The canvas reflects the active session's run. Re-opening a past session can rebuild the graph from its persisted transcript (the sub-session ids are already stored via `meta.sessionId`), but full historical replay polish is a stretch goal, not required.
- **No new execution semantics.** Forwarding surfaces what already happens; it does not change how agents run, permissions, or results.

## Testing

- **Reducer (pure):** unit-test the graph reducer — a `subagent-start` creates a node and links it to the right parent; `sourceId` events route to the right node; nested spawns nest; `tool-call`/`tool-result` pairing; status transitions; an out-of-order or unknown `sourceId` degrades gracefully (attaches to root, never throws).
- **Forwarding (core):** a test that running the `task` tool with a scripted sub-runner emits `subagent-start`, the sub-session's events tagged with `sourceId`, and `subagent-end`, while the returned summary is unchanged.
- **Manual gate (running app):** trigger a real multi-agent run (a prompt that spawns sub-agents), watch nodes appear and pulse, open a node and see its live reasoning + tools, in light and dark themes. Confirm the chat transcript is unaffected by the added events.

## Risks / open questions (for the plan)

- **Layout library:** a dependency (e.g. a small dagre/elk layout) vs a hand-rolled tree layout. Phase 1's graphs are shallow (a primary + a handful of sub-agents), so a hand-rolled layered layout likely suffices and avoids a dep — decide in the plan.
- **Event volume:** forwarding doubles the stream when sub-agents run. The reducer must be cheap; the inspector renders only the selected node's detail, not all nodes' full transcripts.
- **`sourceId` on every event** vs a wrapper event: chose the flat `sourceId?` field for minimal disruption to existing consumers; confirm no consumer switches exhaustively on event shape in a way the extra field breaks.

## Out of scope (logged)

- Phase 2 authoring (drag/connect/save/run) and its execution engine.
- Historical run replay beyond rebuilding from a stored transcript.
- The system-design-simulator flavor of the reference image (chaos/metrics/mermaid) — this is an *agent* canvas, not an infra simulator.
