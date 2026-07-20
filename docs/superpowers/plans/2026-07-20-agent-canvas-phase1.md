# Agent Canvas Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A desktop canvas that visualizes a live agent run — primary agent + spawned sub-agents as connected nodes, each showing its live reasoning and tool timeline.

**Architecture:** Core gains a tool `emit` channel so a sub-agent forwards its session events onto the parent stream (tagged with `sourceId`), plus `subagent-start`/`subagent-end` markers. A pure client reducer folds the event stream into a run-graph. A new Canvas center-tab renders the graph with an inspector.

**Tech Stack:** TypeScript, React, an async event queue, Vitest.

## Global Constraints

- **No code comments.** Do not add comments to any code you write.
- **Preserve CRLF** on all `packages/**` files (`core.autocrlf=true`, so `git show` renders LF — normal; check working-tree files).
- pnpm workspace. Core tests: `npx vitest run <name>`. Typecheck: `pnpm --filter @termcoder/core typecheck`; build deps first in a fresh worktree (`pnpm --filter @termcoder/core build && pnpm --filter @termcoder/server build`) before desktop typecheck.
- **Do not change agent execution semantics.** Forwarding surfaces existing events; it must not alter results, permissions, or the sub-agent's returned summary.
- Non-subagent tools must behave identically — a tool that never calls `emit` produces the exact same stream as today.

---

### Task 1: Sub-event forwarding (core)

Give tools a live `emit` channel; forward sub-agent events onto the parent stream.

**Files:**
- Modify: `packages/core/src/tools/types.ts` (`ToolContext`)
- Modify: `packages/core/src/session/session.ts` (`SessionEvent`, `runToolCall`)
- Create: `packages/core/src/session/event-queue.ts`
- Modify: `packages/core/src/agent/subagent.ts`
- Test: `packages/core/src/session/event-queue.test.ts`, `packages/core/src/agent/subagent.test.ts` (extend if it exists, else create)

**Interfaces produced:**
- `ToolContext` gains `toolCallId?: string` and `emit?: (event: SessionEvent) => void`.
- `SessionEvent` gains `sourceId?: string` and two variants: `{ type: "subagent-start"; sessionId; agent; prompt; parentToolCallId? }`, `{ type: "subagent-end"; sessionId; status: "done" | "error" }`.
- `EventQueue<T>` — push/close/drain async channel.

- [ ] **Step 1: Write the EventQueue test**

Create `packages/core/src/session/event-queue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EventQueue } from "./event-queue";

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("EventQueue", () => {
  it("drains items pushed before close", async () => {
    const q = new EventQueue<number>();
    q.push(1);
    q.push(2);
    q.close();
    expect(await collect(q.drain())).toEqual([1, 2]);
  });

  it("delivers items pushed after draining starts", async () => {
    const q = new EventQueue<number>();
    const p = collect(q.drain());
    q.push(10);
    await Promise.resolve();
    q.push(20);
    q.close();
    expect(await p).toEqual([10, 20]);
  });

  it("ends immediately when closed empty", async () => {
    const q = new EventQueue<number>();
    q.close();
    expect(await collect(q.drain())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run event-queue` → FAIL (module missing).

- [ ] **Step 3: Implement `event-queue.ts`**

```ts
export class EventQueue<T> {
  private items: T[] = [];
  private waiters: Array<(r: IteratorResult<T>) => void> = [];
  private done = false;

  push(item: T): void {
    if (this.done) return;
    const w = this.waiters.shift();
    if (w) w({ value: item, done: false });
    else this.items.push(item);
  }

  close(): void {
    if (this.done) return;
    this.done = true;
    while (this.waiters.length) this.waiters.shift()!({ value: undefined as never, done: true });
  }

  async *drain(): AsyncGenerator<T> {
    while (true) {
      if (this.items.length) {
        yield this.items.shift()!;
        continue;
      }
      if (this.done) return;
      const next = await new Promise<IteratorResult<T>>((r) => this.waiters.push(r));
      if (next.done) return;
      yield next.value;
    }
  }
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run event-queue` → PASS.

- [ ] **Step 5: Extend `SessionEvent` and `ToolContext`**

In `packages/core/src/session/session.ts`, replace the `SessionEvent` type (lines 25-33) with:

```ts
export type SessionEventKind =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "reasoning-end" }
  | { type: "tool-call"; id: string; name: string; args: unknown; title?: string; detail?: string }
  | { type: "tool-result"; id: string; name: string; output: string; isError: boolean }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "subagent-start"; sessionId: string; agent: string; prompt: string; parentToolCallId?: string }
  | { type: "subagent-end"; sessionId: string; status: "done" | "error" }
  | { type: "done" }
  | { type: "error"; error: string };

export type SessionEvent = SessionEventKind & { sourceId?: string };
```

In `packages/core/src/tools/types.ts`, extend `ToolContext` (currently `{ cwd: string }`):

```ts
import type { SessionEvent } from "../session/session";

export interface ToolContext {
  cwd: string;
  toolCallId?: string;
  emit?: (event: SessionEvent) => void;
}
```
If this import creates a cycle that breaks the build, instead define a local minimal type in `types.ts`: `emit?: (event: { type: string; [k: string]: unknown }) => void;` and `toolCallId?: string;` — report which you used.

- [ ] **Step 6: Wire `emit` into `runToolCall`**

In `session.ts` `runToolCall` (the `else` branch that runs the tool, lines ~604-625), replace the direct `await tool.run(...)` block so the tool runs with an emit queue whose events are yielded live. The new `else` body:

```ts
    } else {
      if (tool.permissionKind === "write" || tool.permissionKind === "edit") {
        const inputPath = (call.input as { path?: unknown }).path;
        if (typeof inputPath === "string") {
          this.checkpoint.capture(join(ctx.cwd, inputPath));
        }
      }
      const queue = new EventQueue<SessionEvent>();
      const runCtx: ToolContext = {
        cwd: ctx.cwd,
        toolCallId: call.toolCallId,
        emit: (e) => queue.push(e),
      };
      const runPromise = (async () => {
        try {
          const r = await tool.run(call.input, runCtx);
          return { output: r.output, isError: false };
        } catch (err) {
          return { output: `Error: ${stringifyError(err)}`, isError: true };
        } finally {
          queue.close();
        }
      })();
      for await (const e of queue.drain()) yield e;
      const res = await runPromise;
      output = res.output;
      isError = res.isError;
      if (!isError && (tool.permissionKind === "write" || tool.permissionKind === "edit")) {
        const editedPath = (call.input as { path?: unknown }).path;
        if (typeof editedPath === "string") {
          try {
            formatFile(this.deps.config, join(ctx.cwd, editedPath), ctx.cwd);
          } catch {
          }
        }
      }
    }
```

Add the import at the top of `session.ts`: `import { EventQueue } from "./event-queue";`.

- [ ] **Step 7: Forward events in the sub-agent tool**

In `packages/core/src/agent/subagent.ts` `run`, after creating `sub` and before the `for await`, emit a start marker, forward each event, and emit an end marker. Replace the `for await` block and return:

```ts
      ctx.emit?.({
        type: "subagent-start",
        sessionId: sub.record.id,
        agent: args.agent ?? "general",
        prompt: args.prompt,
        parentToolCallId: ctx.toolCallId,
      });

      const texts: string[] = [];
      const toolsUsed: string[] = [];
      let failed = false;
      for await (const event of sub.prompt(args.prompt)) {
        ctx.emit?.({ ...event, sourceId: sub.record.id });
        if (event.type === "text-delta") texts.push(event.text);
        else if (event.type === "tool-call") toolsUsed.push(event.name);
        else if (event.type === "error") {
          failed = true;
          ctx.emit?.({ type: "subagent-end", sessionId: sub.record.id, status: "error" });
          return { output: `Sub-agent error: ${event.error}`, meta: { sessionId: sub.record.id } };
        }
      }
      ctx.emit?.({ type: "subagent-end", sessionId: sub.record.id, status: failed ? "error" : "done" });
```
Keep the existing `summary`/`used`/return below unchanged.

- [ ] **Step 8: Write the forwarding test**

Add to `packages/core/src/agent/subagent.test.ts` (create the file if absent, mirroring the scripted-runner pattern used in `session.test.ts`/`server.test.ts`). The test runs the `task` tool with a scripted sub-runner and a capturing `emit`, and asserts the emitted sequence:

```ts
import { describe, expect, it } from "vitest";
import { createSubagentTool } from "./subagent";
import { SessionStore } from "../storage/storage";
import { ToolRegistry } from "../tools";
import { PermissionManager } from "../permission/permission";
import { loadConfig } from "../config/config";
import type { SessionEvent } from "../session/session";

function scriptedRunner() {
  return () => {
    async function* stream() {
      yield { type: "reasoning-delta", text: "thinking" };
      yield { type: "text-delta", text: "hello from sub" };
    }
    return {
      fullStream: stream(),
      response: Promise.resolve({ messages: [{ role: "assistant", content: "hello from sub" }] as never }),
      finishReason: Promise.resolve("stop"),
      toolCalls: Promise.resolve([]),
    };
  };
}

describe("subagent forwarding", () => {
  it("emits start, forwards tagged sub-events, and emits end", async () => {
    const store = new SessionStore();
    const tool = createSubagentTool({
      store,
      registry: new ToolRegistry(),
      config: loadConfig(),
      permission: new PermissionManager(undefined, async () => "allow"),
      runner: scriptedRunner(),
    });
    const events: SessionEvent[] = [];
    const res = await tool.run(
      { prompt: "do a thing", agent: "general" },
      { cwd: process.cwd(), toolCallId: "call-1", emit: (e) => events.push(e) },
    );
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("subagent-start");
    expect(types[types.length - 1]).toBe("subagent-end");
    const forwarded = events.filter((e) => e.sourceId);
    expect(forwarded.length).toBeGreaterThan(0);
    expect(forwarded.every((e) => e.sourceId === (res.meta as { sessionId: string }).sessionId)).toBe(true);
    expect(res.output).toContain("hello from sub");
  });
});
```
If constructor signatures differ from the above (check `SessionStore`, `PermissionManager`, `loadConfig` against the real code and `server.test.ts` usage), adapt the wiring — the assertions are the point.

- [ ] **Step 9: Run tests + typecheck**

Run: `npx vitest run event-queue subagent` and `npx vitest run session` (ensure existing session tests still pass), then `pnpm --filter @termcoder/core typecheck`.
Expected: all green. If any existing test exhaustively switches on `SessionEvent` and the compiler now demands the new variants, add cases returning/ignoring them — report which.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/session/event-queue.ts packages/core/src/session/event-queue.test.ts packages/core/src/session/session.ts packages/core/src/tools/types.ts packages/core/src/agent/subagent.ts packages/core/src/agent/subagent.test.ts
git commit -m "feat(core): forward sub-agent session events onto the parent stream"
```

---

### Task 2: Run-graph reducer (client, pure)

A pure reducer folding `SessionEvent`s into a run-graph. No React, no DOM.

**Files:**
- Create: `packages/desktop/src/renderer/canvas/runGraph.ts`
- Test: `packages/desktop/src/renderer/canvas/runGraph.test.ts`

**Interfaces produced:**
```ts
export type NodeStatus = "thinking" | "tool" | "done" | "error" | "idle";
export interface RunActivity { id: string; name: string; title?: string; detail?: string; output?: string; isError?: boolean; done: boolean; }
export interface RunNode { id: string; agent: string; status: NodeStatus; reasoning: string; activity: RunActivity[]; parentId?: string; prompt?: string; }
export interface RunGraph { rootId: string; nodes: Record<string, RunNode>; order: string[]; }
export function emptyGraph(rootId: string): RunGraph;
export function reduceGraph(graph: RunGraph, event: SessionEventLike): RunGraph;
```
`SessionEventLike` is a structural copy of `SessionEvent` (the desktop must not import from core's session; redeclare the shape locally).

- [ ] **Step 1: Write the reducer tests**

Create `packages/desktop/src/renderer/canvas/runGraph.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { emptyGraph, reduceGraph, type SessionEventLike } from "./runGraph";

function run(events: SessionEventLike[]) {
  return events.reduce((g, e) => reduceGraph(g, e), emptyGraph("root"));
}

describe("reduceGraph", () => {
  it("routes primary reasoning and tools to the root node", () => {
    const g = run([
      { type: "reasoning-delta", text: "plan " },
      { type: "reasoning-delta", text: "more" },
      { type: "tool-call", id: "t1", name: "read", title: "Read x" },
      { type: "tool-result", id: "t1", name: "read", output: "ok", isError: false },
    ]);
    expect(g.nodes.root.reasoning).toBe("plan more");
    expect(g.nodes.root.activity).toHaveLength(1);
    expect(g.nodes.root.activity[0].done).toBe(true);
  });

  it("creates a child node on subagent-start and links it to the spawning tool-call", () => {
    const g = run([
      { type: "tool-call", id: "call-1", name: "task", title: "sub-agent" },
      { type: "subagent-start", sessionId: "sub-1", agent: "explore", prompt: "look", parentToolCallId: "call-1" },
    ]);
    expect(g.nodes["sub-1"]).toBeTruthy();
    expect(g.nodes["sub-1"].parentId).toBe("root");
    expect(g.nodes["sub-1"].agent).toBe("explore");
    expect(g.order).toContain("sub-1");
  });

  it("routes sourceId events to the matching child node", () => {
    const g = run([
      { type: "tool-call", id: "call-1", name: "task" },
      { type: "subagent-start", sessionId: "sub-1", agent: "explore", prompt: "look", parentToolCallId: "call-1" },
      { type: "reasoning-delta", text: "child thought", sourceId: "sub-1" },
      { type: "subagent-end", sessionId: "sub-1", status: "done" },
    ]);
    expect(g.nodes["sub-1"].reasoning).toBe("child thought");
    expect(g.nodes["sub-1"].status).toBe("done");
    expect(g.nodes.root.reasoning).toBe("");
  });

  it("sets status: thinking on reasoning, tool while a tool is open, done on done", () => {
    let g = run([{ type: "reasoning-delta", text: "x" }]);
    expect(g.nodes.root.status).toBe("thinking");
    g = reduceGraph(g, { type: "tool-call", id: "t1", name: "read" });
    expect(g.nodes.root.status).toBe("tool");
    g = reduceGraph(g, { type: "tool-result", id: "t1", name: "read", output: "", isError: false });
    g = reduceGraph(g, { type: "done" });
    expect(g.nodes.root.status).toBe("done");
  });

  it("degrades gracefully for an unknown sourceId (attaches to root, never throws)", () => {
    const g = run([{ type: "reasoning-delta", text: "orphan", sourceId: "ghost" }]);
    expect(g.nodes.root.reasoning).toBe("orphan");
    expect(g.nodes.ghost).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run runGraph` → FAIL.

- [ ] **Step 3: Implement `runGraph.ts`**

```ts
export type NodeStatus = "idle" | "thinking" | "tool" | "done" | "error";

export interface RunActivity {
  id: string;
  name: string;
  title?: string;
  detail?: string;
  output?: string;
  isError?: boolean;
  done: boolean;
}

export interface RunNode {
  id: string;
  agent: string;
  status: NodeStatus;
  reasoning: string;
  activity: RunActivity[];
  parentId?: string;
  prompt?: string;
}

export interface RunGraph {
  rootId: string;
  nodes: Record<string, RunNode>;
  order: string[];
}

export type SessionEventLike =
  | { type: "text-delta"; text: string; sourceId?: string }
  | { type: "reasoning-delta"; text: string; sourceId?: string }
  | { type: "reasoning-end"; sourceId?: string }
  | { type: "tool-call"; id: string; name: string; args?: unknown; title?: string; detail?: string; sourceId?: string }
  | { type: "tool-result"; id: string; name: string; output: string; isError: boolean; sourceId?: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; sourceId?: string }
  | { type: "subagent-start"; sessionId: string; agent: string; prompt: string; parentToolCallId?: string; sourceId?: string }
  | { type: "subagent-end"; sessionId: string; status: "done" | "error"; sourceId?: string }
  | { type: "done"; sourceId?: string }
  | { type: "error"; error: string; sourceId?: string };

export function emptyGraph(rootId: string): RunGraph {
  return {
    rootId,
    nodes: { [rootId]: { id: rootId, agent: "primary", status: "idle", reasoning: "", activity: [] } },
    order: [rootId],
  };
}

function nodeIdFor(graph: RunGraph, event: SessionEventLike): string {
  const src = event.sourceId;
  if (src && graph.nodes[src]) return src;
  return graph.rootId;
}

export function reduceGraph(graph: RunGraph, event: SessionEventLike): RunGraph {
  const nodes = { ...graph.nodes };
  let order = graph.order;

  if (event.type === "subagent-start") {
    const parentId = Object.values(nodes).find((n) =>
      n.activity.some((a) => a.id === event.parentToolCallId),
    )?.id ?? graph.rootId;
    nodes[event.sessionId] = {
      id: event.sessionId,
      agent: event.agent,
      status: "thinking",
      reasoning: "",
      activity: [],
      parentId,
      prompt: event.prompt,
    };
    order = order.includes(event.sessionId) ? order : [...order, event.sessionId];
    return { ...graph, nodes, order };
  }

  const id = nodeIdFor(graph, event);
  const node = { ...nodes[id]! };
  node.activity = node.activity.slice();

  switch (event.type) {
    case "reasoning-delta":
      node.reasoning += event.text;
      if (node.status !== "tool") node.status = "thinking";
      break;
    case "tool-call":
      node.activity.push({ id: event.id, name: event.name, title: event.title, detail: event.detail, done: false });
      node.status = "tool";
      break;
    case "tool-result": {
      const a = node.activity.find((x) => x.id === event.id);
      if (a) {
        a.output = event.output;
        a.isError = event.isError;
        a.done = true;
      }
      node.status = "thinking";
      break;
    }
    case "subagent-end":
      if (nodes[event.sessionId]) {
        nodes[event.sessionId] = { ...nodes[event.sessionId]!, status: event.status };
      }
      return { ...graph, nodes, order };
    case "done":
      node.status = "done";
      break;
    case "error":
      node.status = "error";
      break;
    default:
      break;
  }

  nodes[id] = node;
  return { ...graph, nodes, order };
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run runGraph` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/canvas/runGraph.ts packages/desktop/src/renderer/canvas/runGraph.test.ts
git commit -m "feat(desktop): pure run-graph reducer for the agent canvas"
```

---

### Task 3: Canvas view, layout, inspector, and wiring

Render the graph as a new center tab. Verified by typecheck, web build, and the manual gate.

**Files:**
- Create: `packages/desktop/src/renderer/canvas/layout.ts` (pure layered layout) + `packages/desktop/src/renderer/canvas/layout.test.ts`
- Create: `packages/desktop/src/renderer/canvas/AgentCanvas.tsx`
- Modify: `packages/desktop/src/renderer/App.tsx` (centerTab type + tab button + view + feed onEvent)
- Modify: `packages/desktop/src/renderer/styles.css` (canvas styling)
- Modify: `packages/desktop/src/renderer/i18n.ts` (canvas strings, 3 locales)

**Interfaces:**
- Consumes: `RunGraph`, `RunNode`, `reduceGraph`, `emptyGraph`, `SessionEventLike` from `./runGraph`.
- Produces: `layoutGraph(graph): Record<string, {x:number;y:number}>`; `AgentCanvas({ graph, hidden })`.

- [ ] **Step 1: Write the layout test**

Create `packages/desktop/src/renderer/canvas/layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { layoutGraph } from "./layout";
import { emptyGraph, reduceGraph } from "./runGraph";

describe("layoutGraph", () => {
  it("places the root at depth 0 and children below it", () => {
    let g = emptyGraph("root");
    g = reduceGraph(g, { type: "tool-call", id: "c1", name: "task" });
    g = reduceGraph(g, { type: "subagent-start", sessionId: "s1", agent: "explore", prompt: "p", parentToolCallId: "c1" });
    const pos = layoutGraph(g);
    expect(pos.root.y).toBeLessThan(pos.s1.y);
  });

  it("assigns every node a position", () => {
    const g = emptyGraph("root");
    const pos = layoutGraph(g);
    expect(pos.root).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run layout` → FAIL.

- [ ] **Step 3: Implement `layout.ts`**

```ts
import type { RunGraph } from "./runGraph";

const COL = 220;
const ROW = 140;

export function layoutGraph(graph: RunGraph): Record<string, { x: number; y: number }> {
  const depth: Record<string, number> = {};
  const compute = (id: string): number => {
    if (depth[id] !== undefined) return depth[id]!;
    const parent = graph.nodes[id]?.parentId;
    depth[id] = parent && graph.nodes[parent] ? compute(parent) + 1 : 0;
    return depth[id]!;
  };
  for (const id of graph.order) compute(id);

  const byDepth: Record<number, string[]> = {};
  for (const id of graph.order) {
    const d = depth[id]!;
    (byDepth[d] ||= []).push(id);
  }

  const pos: Record<string, { x: number; y: number }> = {};
  for (const d of Object.keys(byDepth)) {
    const level = byDepth[Number(d)]!;
    level.forEach((id, i) => {
      pos[id] = { x: (i - (level.length - 1) / 2) * COL, y: Number(d) * ROW };
    });
  }
  return pos;
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run layout` → PASS.

- [ ] **Step 5: Create `AgentCanvas.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { layoutGraph } from "./layout";
import type { RunGraph, RunNode } from "./runGraph";

const NODE_W = 168;
const NODE_H = 92;

export function AgentCanvas({ graph, hidden }: { graph: RunGraph; hidden: boolean }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const pos = useMemo(() => layoutGraph(graph), [graph]);

  const xs = Object.values(pos).map((p) => p.x);
  const ys = Object.values(pos).map((p) => p.y);
  const minX = Math.min(0, ...xs) - NODE_W;
  const minY = Math.min(0, ...ys) - NODE_H;
  const width = Math.max(...xs, 0) - minX + NODE_W * 2;
  const height = Math.max(...ys, 0) - minY + NODE_H * 2;
  const node = selected ? graph.nodes[selected] : null;

  return (
    <div className={`agent-canvas ${hidden ? "hidden" : ""}`}>
      <div className="agent-canvas-scroll">
        <svg className="agent-canvas-edges" width={width} height={height} style={{ minWidth: width }}>
          {graph.order.map((id) => {
            const n = graph.nodes[id]!;
            if (!n.parentId || !pos[n.parentId] || !pos[id]) return null;
            const p = pos[n.parentId]!;
            const c = pos[id]!;
            const x1 = p.x - minX + NODE_W / 2;
            const y1 = p.y - minY + NODE_H;
            const x2 = c.x - minX + NODE_W / 2;
            const y2 = c.y - minY;
            return (
              <path
                key={id}
                className={`agent-edge ${n.status === "thinking" || n.status === "tool" ? "active" : ""}`}
                d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                fill="none"
              />
            );
          })}
        </svg>
        {graph.order.map((id) => {
          const n = graph.nodes[id]!;
          const p = pos[id]!;
          return (
            <button
              key={id}
              className={`agent-node ${n.status} ${selected === id ? "selected" : ""}`}
              style={{ left: p.x - minX, top: p.y - minY, width: NODE_W, height: NODE_H }}
              onClick={() => setSelected(id)}
            >
              <span className="agent-node-name">{n.agent === "primary" ? t("canvas.primary") : n.agent}</span>
              <span className={`agent-node-status ${n.status}`}>{t(`canvas.status.${n.status}`)}</span>
              <span className="agent-node-activity">
                {n.activity.filter((a) => !a.done).map((a) => a.title || a.name).slice(-1)[0] ??
                  (n.activity.length ? `${n.activity.length} ${t("canvas.tools")}` : "")}
              </span>
            </button>
          );
        })}
      </div>
      {node ? <Inspector node={node} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function Inspector({ node, onClose }: { node: RunNode; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="agent-inspector">
      <div className="agent-inspector-head">
        <b>{node.agent === "primary" ? t("canvas.primary") : node.agent}</b>
        <button className="icon sm" onClick={onClose}>
          ×
        </button>
      </div>
      {node.prompt ? <p className="agent-inspector-prompt">{node.prompt}</p> : null}
      {node.reasoning ? (
        <div className="agent-inspector-reasoning">{node.reasoning}</div>
      ) : (
        <p className="hint">{t("canvas.noReasoning")}</p>
      )}
      <div className="agent-inspector-tools">
        {node.activity.map((a) => (
          <div key={a.id} className={`agent-tool-row ${a.isError ? "err" : ""}`}>
            <span className="agent-tool-name">{a.title || a.name}</span>
            {a.output ? <span className="agent-tool-out">{a.output.slice(0, 200)}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add i18n keys (3 locales)**

In `i18n.ts`, add to each locale block (after `room.callAlone` or any stable anchor in that block):
```ts
  "canvas.tab": "Canvas",           // pt: "Canvas"      es: "Lienzo"
  "canvas.primary": "Main agent",   // pt: "Agente principal"  es: "Agente principal"
  "canvas.tools": "tools",          // pt: "ferramentas" es: "herramientas"
  "canvas.noReasoning": "No reasoning yet.",  // pt: "Sem raciocínio ainda."  es: "Sin razonamiento aún."
  "canvas.status.idle": "idle",       // pt: "ocioso"     es: "inactivo"
  "canvas.status.thinking": "thinking", // pt: "pensando" es: "pensando"
  "canvas.status.tool": "working",    // pt: "trabalhando" es: "trabajando"
  "canvas.status.done": "done",       // pt: "pronto"     es: "listo"
  "canvas.status.error": "error",     // pt: "erro"       es: "error"
```
Use the per-locale values shown in the trailing comments (do not leave the comments in the file — they are guidance).

- [ ] **Step 7: Wire into `App.tsx`**

1. Change the centerTab type (line ~384): `useState<"chat" | "terminal" | "canvas">("chat")`.
2. Add canvas run-graph state near the other session state:
```tsx
import { AgentCanvas } from "./canvas/AgentCanvas";
import { emptyGraph, reduceGraph, type SessionEventLike } from "./canvas/runGraph";
```
```tsx
  const [graph, setGraph] = useState(() => emptyGraph("root"));
```
3. In `onEvent` (line ~1259), at the top, feed the reducer: `setGraph((g) => reduceGraph(g, e as unknown as SessionEventLike));`. When a new session opens / `createSession`, reset: `setGraph(emptyGraph("root"))` wherever the transcript is cleared.
4. Add a Canvas tab button next to the chat/terminal buttons (~1843-1852):
```tsx
            <button className={centerTab === "canvas" ? "active" : ""} onClick={() => setCenterTab("canvas")}>
              {t("canvas.tab")}
            </button>
```
5. Render the canvas view near the terminal view (~2259):
```tsx
          <AgentCanvas graph={graph} hidden={centerTab !== "canvas"} />
```
Place it so it participates in the same center-content area the chat/terminal use; match how the terminal view is mounted/hidden.

- [ ] **Step 8: Add CSS**

Append to `styles.css`:
```css
.agent-canvas { position: absolute; inset: 0; display: flex; background: var(--bg); }
.agent-canvas.hidden { display: none; }
.agent-canvas-scroll { position: relative; flex: 1; overflow: auto; padding: 40px; }
.agent-canvas-edges { position: absolute; top: 40px; left: 40px; pointer-events: none; overflow: visible; }
.agent-edge { stroke: var(--border); stroke-width: 2; }
.agent-edge.active { stroke: var(--accent); }
.agent-node { position: absolute; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; text-align: left; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--elev); cursor: pointer; transition: border-color .12s ease, box-shadow .12s ease; }
.agent-node:hover { border-color: var(--accent); }
.agent-node.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.agent-node.thinking, .agent-node.tool { border-color: var(--accent); box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 35%, transparent); }
.agent-node.error { border-color: #e5484d; }
.agent-node-name { font-size: 13px; font-weight: 600; color: var(--text); }
.agent-node-status { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); }
.agent-node-status.thinking, .agent-node-status.tool { color: var(--accent); }
.agent-node-activity { font-size: 11px; color: var(--muted); font-family: var(--mono); max-width: 144px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agent-inspector { width: 320px; flex-shrink: 0; border-left: 1px solid var(--border); display: flex; flex-direction: column; padding: 14px; gap: 10px; overflow-y: auto; }
.agent-inspector-head { display: flex; align-items: center; justify-content: space-between; }
.agent-inspector-prompt { font-size: 12px; color: var(--muted); font-style: italic; }
.agent-inspector-reasoning { font-size: 12.5px; line-height: 1.5; color: var(--text); white-space: pre-wrap; border-left: 2px solid var(--border); padding-left: 10px; }
.agent-inspector-tools { display: flex; flex-direction: column; gap: 6px; }
.agent-tool-row { font-size: 12px; display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; }
.agent-tool-row.err { border-color: #e5484d; }
.agent-tool-name { color: var(--accent); font-family: var(--mono); font-size: 11.5px; }
.agent-tool-out { color: var(--muted); font-family: var(--mono); font-size: 11px; white-space: pre-wrap; }
```

- [ ] **Step 9: Typecheck + web build**

Run: `pnpm --filter @termcoder/core build && pnpm --filter @termcoder/server build && pnpm --filter @termcoder/desktop typecheck`
Expected: no errors.
Run: `pnpm --filter @termcoder/desktop build:web`
Expected: builds `dist-web` with no error.

- [ ] **Step 10: Commit**

```bash
git add packages/desktop/src/renderer/canvas packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/styles.css packages/desktop/src/renderer/i18n.ts
git commit -m "feat(desktop): agent canvas — live run visualization tab"
```

- [ ] **Step 11: Record the manual gate**

Cannot be automated here. Note for the controller to drive in the running app:
- Open the Canvas tab. Idle: a single "Main agent" node.
- Send a prompt that spawns sub-agents (e.g. asks to explore/research). Watch child nodes appear, edges connect, active nodes pulse.
- Click a node → inspector shows its live reasoning + tool timeline. Click the main node and a sub-agent node to confirm each shows its own brain.
- Confirm the chat transcript is unaffected by the added events.
- Light and dark themes.

---

## Self-Review

**Spec coverage:**
- Sub-event forwarding (emit channel, sourceId, subagent-start/end) → Task 1. ✅
- Server relay transparent → the new events are plain `SessionEvent`s over the existing WS; no relay change needed (verify in manual gate that they arrive). ✅
- Pure run-graph reducer → Task 2. ✅
- Canvas UI: auto-layout tree, node cards with live status, edges, inspector → Task 3. ✅
- New center tab fed by existing onEvent → Task 3 Step 7. ✅
- Observe-only (no drag/connect/save) → nothing in the plan adds authoring. ✅
- i18n 3 locales, theme tokens → Task 3 Steps 6, 8. ✅

**Placeholder scan:** No TBD/TODO; complete code in every code step. i18n per-locale values given inline.

**Type consistency:** `SessionEvent = SessionEventKind & {sourceId?}` used in core; the desktop redeclares `SessionEventLike` (never imports core's session type) — matches per the spec. `ToolContext.emit`/`toolCallId` consumed by subagent.ts and set in runToolCall. `reduceGraph`/`emptyGraph`/`layoutGraph`/`RunGraph`/`RunNode` signatures consistent across Tasks 2-3.

**Risk noted:** Task 1 Step 5's `ToolContext` importing `SessionEvent` from session.ts may create an import cycle (session imports tools). The step gives a fallback (a local minimal emit type) if the cycle breaks the build.
