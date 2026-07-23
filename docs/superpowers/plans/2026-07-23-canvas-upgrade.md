# Canvas 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the AgentCanvas into an explorable view — zoom/pan + fit, per-node metrics, a richer inspector, and collapsible subtrees with error highlighting.

**Architecture:** Keep pure logic (reducer, layout, fit math, formatting) in small tested modules; split the growing `AgentCanvas.tsx` into `NodeCard`/`Inspector`/`useZoomPan` with `AgentCanvas` as the orchestrator. All changes inside `packages/desktop/src/renderer/canvas/` plus the canvas CSS block.

**Tech Stack:** React (renderer), TypeScript strict, vitest (env `node` — pure-logic tests only; no jsdom/testing-library, so React components are verified by typecheck + `pnpm build:web` + DOM inspection, following the existing pattern where `AgentCanvas.tsx` has no unit test).

## Global Constraints

- Source files carry NO comments (repo-wide rule). Test files may use descriptive names only.
- No new dependencies. TypeScript strict.
- `reduceGraph` and `layoutGraph` keep backward-compatible signatures (new params default so existing `App.tsx` callers keep working).
- Run a single test file with `npx vitest run <path>` from the worktree root.
- Renderer `Date.now()` is allowed. For determinism, `reduceGraph`/`emptyGraph` accept an injected `now`.
- Commit after every task.

---

### Task 1: Formatting helpers (`format.ts`)

**Files:**
- Create: `packages/desktop/src/renderer/canvas/format.ts`
- Test: `packages/desktop/src/renderer/canvas/format.test.ts`

**Interfaces:**
- Produces: `formatTokens(n: number): string`, `formatDuration(ms: number): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatTokens, formatDuration } from "./format";

describe("formatTokens", () => {
  it("formats", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(500)).toBe("500");
    expect(formatTokens(1200)).toBe("1.2k");
    expect(formatTokens(15400)).toBe("15.4k");
    expect(formatTokens(128000)).toBe("128k");
  });
});

describe("formatDuration", () => {
  it("formats", () => {
    expect(formatDuration(340)).toBe("340ms");
    expect(formatDuration(1200)).toBe("1.2s");
    expect(formatDuration(45000)).toBe("45s");
    expect(formatDuration(125000)).toBe("2m 05s");
  });
});
```

- [ ] **Step 2: Run test, verify it fails** — `npx vitest run packages/desktop/src/renderer/canvas/format.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10) + "k";
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return Math.round(ms) + "ms";
  const s = ms / 1000;
  if (s < 60) return Math.round(s * 10) / 10 + "s";
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return m + "m " + String(rem).padStart(2, "0") + "s";
}
```

- [ ] **Step 4: Run test, verify pass.**
- [ ] **Step 5: Commit** — `git add packages/desktop/src/renderer/canvas/format.ts packages/desktop/src/renderer/canvas/format.test.ts && git commit -m "feat(canvas): token and duration formatting helpers"`

---

### Task 2: Node metrics in the graph model (`runGraph.ts`)

**Files:**
- Modify: `packages/desktop/src/renderer/canvas/runGraph.ts`
- Test: `packages/desktop/src/renderer/canvas/runGraph.test.ts` (extend)

**Interfaces:**
- `RunNode` gains `tokensIn: number; tokensOut: number; startedAt: number; endedAt?: number`.
- `emptyGraph(rootId: string, now?: number): RunGraph`
- `reduceGraph(graph: RunGraph, event: SessionEventLike, now?: number): RunGraph`

- [ ] **Step 1: Write the failing tests (append to runGraph.test.ts)**

```ts
import { describe, it, expect } from "vitest";
import { emptyGraph, reduceGraph } from "./runGraph";

describe("runGraph metrics", () => {
  it("seeds root with tokens and startedAt", () => {
    const g = emptyGraph("root", 1000);
    expect(g.nodes.root!.tokensIn).toBe(0);
    expect(g.nodes.root!.tokensOut).toBe(0);
    expect(g.nodes.root!.startedAt).toBe(1000);
  });

  it("accumulates usage tokens on the sourced node", () => {
    let g = emptyGraph("root", 0);
    g = reduceGraph(g, { type: "usage", inputTokens: 10, outputTokens: 4 }, 5);
    g = reduceGraph(g, { type: "usage", inputTokens: 3, outputTokens: 1 }, 6);
    expect(g.nodes.root!.tokensIn).toBe(13);
    expect(g.nodes.root!.tokensOut).toBe(5);
  });

  it("stamps startedAt on a subagent and endedAt on end", () => {
    let g = emptyGraph("root", 0);
    g = reduceGraph(g, { type: "subagent-start", sessionId: "s1", agent: "explore", prompt: "go" }, 100);
    expect(g.nodes.s1!.startedAt).toBe(100);
    expect(g.nodes.s1!.tokensIn).toBe(0);
    g = reduceGraph(g, { type: "subagent-end", sessionId: "s1", status: "done" }, 250);
    expect(g.nodes.s1!.endedAt).toBe(250);
    expect(g.nodes.s1!.status).toBe("done");
  });

  it("stamps endedAt on the sourced node on done/error", () => {
    let g = emptyGraph("root", 0);
    g = reduceGraph(g, { type: "done" }, 400);
    expect(g.nodes.root!.endedAt).toBe(400);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run packages/desktop/src/renderer/canvas/runGraph.test.ts` → FAIL (tokensIn undefined / now ignored).

- [ ] **Step 3: Implement the changes in `runGraph.ts`**

In the `RunNode` interface add the four fields:
```ts
export interface RunNode {
  id: string;
  agent: string;
  status: NodeStatus;
  reasoning: string;
  activity: RunActivity[];
  parentId?: string;
  prompt?: string;
  tokensIn: number;
  tokensOut: number;
  startedAt: number;
  endedAt?: number;
}
```

`emptyGraph`:
```ts
export function emptyGraph(rootId: string, now: number = Date.now()): RunGraph {
  return {
    rootId,
    nodes: { [rootId]: { id: rootId, agent: "primary", status: "idle", reasoning: "", activity: [], tokensIn: 0, tokensOut: 0, startedAt: now } },
    order: [rootId],
  };
}
```

`reduceGraph` — add the `now` param and the new handling. Change the signature and the two blocks:
```ts
export function reduceGraph(graph: RunGraph, event: SessionEventLike, now: number = Date.now()): RunGraph {
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
      tokensIn: 0,
      tokensOut: 0,
      startedAt: now,
    };
    order = order.includes(event.sessionId) ? order : [...order, event.sessionId];
    return { ...graph, nodes, order };
  }

  const id = nodeIdFor(graph, event);
  const existing = nodes[id];
  if (!existing) return { ...graph, nodes, order };

  const node: RunNode = { ...existing, activity: existing.activity.slice() };

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
      const index = node.activity.findIndex((x) => x.id === event.id);
      if (index !== -1) {
        node.activity[index] = { ...node.activity[index]!, output: event.output, isError: event.isError, done: true };
      }
      node.status = "thinking";
      break;
    }
    case "usage":
      node.tokensIn += event.inputTokens;
      node.tokensOut += event.outputTokens;
      break;
    case "subagent-end":
      if (nodes[event.sessionId]) {
        nodes[event.sessionId] = { ...nodes[event.sessionId]!, status: event.status, endedAt: now };
      }
      return { ...graph, nodes, order };
    case "done":
      node.status = "done";
      node.endedAt = now;
      break;
    case "error":
      node.status = "error";
      node.endedAt = now;
      break;
    default:
      break;
  }

  nodes[id] = node;
  return { ...graph, nodes, order };
}
```

- [ ] **Step 4: Run, verify pass** (existing runGraph tests + the 4 new).
- [ ] **Step 5: Commit** — `git add packages/desktop/src/renderer/canvas/runGraph.ts packages/desktop/src/renderer/canvas/runGraph.test.ts && git commit -m "feat(canvas): per-node tokens and timing in the run graph"`

---

### Task 3: Collapse-aware layout (`layout.ts`)

**Files:**
- Modify: `packages/desktop/src/renderer/canvas/layout.ts`
- Test: `packages/desktop/src/renderer/canvas/layout.test.ts` (extend)

**Interfaces:**
- `layoutGraph(graph: RunGraph, collapsed?: Set<string>): Record<string, { x: number; y: number }>` — nodes with an ancestor in `collapsed` get no entry.

- [ ] **Step 1: Write the failing test (append)**

```ts
import { describe, it, expect } from "vitest";
import { layoutGraph } from "./layout";
import type { RunGraph } from "./runGraph";

function graph(): RunGraph {
  const base = { status: "idle" as const, reasoning: "", activity: [], tokensIn: 0, tokensOut: 0, startedAt: 0 };
  return {
    rootId: "r",
    order: ["r", "a", "b"],
    nodes: {
      r: { id: "r", agent: "primary", ...base },
      a: { id: "a", agent: "x", parentId: "r", ...base },
      b: { id: "b", agent: "y", parentId: "a", ...base },
    },
  };
}

describe("layoutGraph collapse", () => {
  it("hides descendants of a collapsed node", () => {
    const pos = layoutGraph(graph(), new Set(["a"]));
    expect(pos.r).toBeDefined();
    expect(pos.a).toBeDefined();
    expect(pos.b).toBeUndefined();
  });

  it("empty collapsed set positions everything", () => {
    const pos = layoutGraph(graph());
    expect(Object.keys(pos).sort()).toEqual(["a", "b", "r"]);
  });
});
```

- [ ] **Step 2: Run, verify fail** — collapse arg ignored (b still positioned).

- [ ] **Step 3: Implement** — replace `layout.ts` body:

```ts
import type { RunGraph } from "./runGraph";

const COL = 220;
const ROW = 140;

export function layoutGraph(graph: RunGraph, collapsed: Set<string> = new Set()): Record<string, { x: number; y: number }> {
  const hidden = (id: string): boolean => {
    let cur = graph.nodes[id]?.parentId;
    while (cur) {
      if (collapsed.has(cur)) return true;
      cur = graph.nodes[cur]?.parentId;
    }
    return false;
  };

  const visible = graph.order.filter((id) => !hidden(id));

  const depth: Record<string, number> = {};
  const compute = (id: string): number => {
    if (depth[id] !== undefined) return depth[id]!;
    const parent = graph.nodes[id]?.parentId;
    depth[id] = parent && graph.nodes[parent] ? compute(parent) + 1 : 0;
    return depth[id]!;
  };
  for (const id of visible) compute(id);

  const byDepth: Record<number, string[]> = {};
  for (const id of visible) {
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

- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `git add packages/desktop/src/renderer/canvas/layout.ts packages/desktop/src/renderer/canvas/layout.test.ts && git commit -m "feat(canvas): collapse-aware layout"`

---

### Task 4: Zoom/pan hook + fit math (`useZoomPan.ts`)

**Files:**
- Create: `packages/desktop/src/renderer/canvas/useZoomPan.ts`
- Test: `packages/desktop/src/renderer/canvas/useZoomPan.test.ts`

**Interfaces:**
- Pure (tested): `computeFit(content: { w: number; h: number }, viewport: { w: number; h: number }): { scale: number; tx: number; ty: number }`
- Hook (integration-verified): `useZoomPan(): { scale; tx; ty; onWheel; onPointerDown; fit; zoomIn; zoomOut; reset; setViewport; setContent }` — details below; only `computeFit` is unit-tested.

- [ ] **Step 1: Write the failing test (computeFit only)**

```ts
import { describe, it, expect } from "vitest";
import { computeFit } from "./useZoomPan";

describe("computeFit", () => {
  it("scales content to fit with margin and centers it", () => {
    const f = computeFit({ w: 1000, h: 500 }, { w: 900, h: 900 });
    expect(f.scale).toBeCloseTo(0.81, 2);
    expect(f.tx).toBeCloseTo((900 - 1000 * f.scale) / 2, 2);
    expect(f.ty).toBeCloseTo((900 - 500 * f.scale) / 2, 2);
  });

  it("clamps scale to [0.25, 2]", () => {
    expect(computeFit({ w: 10, h: 10 }, { w: 900, h: 900 }).scale).toBe(2);
    expect(computeFit({ w: 100000, h: 100000 }, { w: 300, h: 300 }).scale).toBe(0.25);
  });

  it("guards zero-size content", () => {
    const f = computeFit({ w: 0, h: 0 }, { w: 400, h: 400 });
    expect(Number.isFinite(f.scale)).toBe(true);
    expect(f.scale).toBe(2);
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `useZoomPan.ts`**

```ts
import { useCallback, useRef, useState } from "react";

const MIN = 0.25;
const MAX = 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function computeFit(content: { w: number; h: number }, viewport: { w: number; h: number }): { scale: number; tx: number; ty: number } {
  const w = content.w || 1;
  const h = content.h || 1;
  const scale = clamp(Math.min(viewport.w / w, viewport.h / h) * 0.9, MIN, MAX);
  return { scale, tx: (viewport.w - w * scale) / 2, ty: (viewport.h - h * scale) / 2 };
}

export function useZoomPan() {
  const [t, setT] = useState({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const viewport = useRef({ w: 0, h: 0 });
  const content = useRef({ w: 0, h: 0 });

  const setViewport = useCallback((w: number, h: number) => { viewport.current = { w, h }; }, []);
  const setContent = useCallback((w: number, h: number) => { content.current = { w, h }; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setT((prev) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = clamp(prev.scale * factor, MIN, MAX);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / prev.scale;
      return { scale: next, tx: px - (px - prev.tx) * k, ty: py - (py - prev.ty) * k };
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: t.tx, ty: t.ty };
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      setT((prev) => ({ ...prev, tx: drag.current!.tx + (ev.clientX - drag.current!.x), ty: drag.current!.ty + (ev.clientY - drag.current!.y) }));
    };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [t.tx, t.ty]);

  const fit = useCallback(() => { setT(computeFit(content.current, viewport.current)); }, []);
  const zoomIn = useCallback(() => setT((p) => ({ ...p, scale: clamp(p.scale * 1.2, MIN, MAX) })), []);
  const zoomOut = useCallback(() => setT((p) => ({ ...p, scale: clamp(p.scale / 1.2, MIN, MAX) })), []);
  const reset = useCallback(() => setT({ scale: 1, tx: 0, ty: 0 }), []);

  return { ...t, onWheel, onPointerDown, fit, zoomIn, zoomOut, reset, setViewport, setContent };
}
```

- [ ] **Step 4: Run test, verify pass** (`computeFit` cases).
- [ ] **Step 5: Commit** — `git add packages/desktop/src/renderer/canvas/useZoomPan.ts packages/desktop/src/renderer/canvas/useZoomPan.test.ts && git commit -m "feat(canvas): zoom/pan hook with fit-to-view math"`

---

### Task 5: NodeCard + Inspector components

Presentation only — verified by typecheck + `pnpm build:web` (no component test harness in this package).

**Files:**
- Create: `packages/desktop/src/renderer/canvas/NodeCard.tsx`
- Create: `packages/desktop/src/renderer/canvas/Inspector.tsx`

**Interfaces:**
- `NodeCard` props: `{ node: RunNode; selected: boolean; hasChildren: boolean; collapsed: boolean; now: number; onSelect(): void; onToggleCollapse(): void }`
- `Inspector` props: `{ node: RunNode; now: number; onClose(): void }`

- [ ] **Step 1: Write `NodeCard.tsx`**

```tsx
import { useI18n } from "../i18n";
import { formatTokens, formatDuration } from "./format";
import type { RunNode } from "./runGraph";

export function NodeCard({ node, selected, hasChildren, collapsed, now, onSelect, onToggleCollapse }: {
  node: RunNode; selected: boolean; hasChildren: boolean; collapsed: boolean; now: number;
  onSelect: () => void; onToggleCollapse: () => void;
}) {
  const { t } = useI18n();
  const dur = (node.endedAt ?? now) - node.startedAt;
  const current = node.activity.filter((a) => !a.done).map((a) => a.title || a.name).slice(-1)[0]
    ?? (node.activity.length ? `${node.activity.length} ${t("canvas.tools")}` : "");
  return (
    <div className={`agent-node ${node.status} ${selected ? "selected" : ""}`}>
      <button className="agent-node-hit" onClick={onSelect}>
        <span className="agent-node-name">{node.agent === "primary" ? t("canvas.primary") : node.agent}</span>
        <span className={`agent-node-status ${node.status}`}>{t(`canvas.status.${node.status}`)}</span>
        <span className="agent-node-activity">{current}</span>
        <span className="agent-node-metrics">
          <span>↓{formatTokens(node.tokensIn)} ↑{formatTokens(node.tokensOut)}</span>
          <span>{formatDuration(dur)}</span>
          <span>{node.activity.length} {t("canvas.tools")}</span>
        </span>
      </button>
      {hasChildren ? (
        <button className="agent-node-collapse" title={collapsed ? "expand" : "collapse"} onClick={onToggleCollapse}>
          {collapsed ? "+" : "−"}
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Write `Inspector.tsx`**

```tsx
import { useState } from "react";
import { useI18n } from "../i18n";
import { formatTokens, formatDuration } from "./format";
import type { RunNode } from "./runGraph";

export function Inspector({ node, now, onClose }: { node: RunNode; now: number; onClose: () => void }) {
  const { t } = useI18n();
  const dur = (node.endedAt ?? now) - node.startedAt;
  return (
    <div className="agent-inspector">
      <div className="agent-inspector-head">
        <b>{node.agent === "primary" ? t("canvas.primary") : node.agent}</b>
        <button className="icon sm" onClick={onClose}>×</button>
      </div>
      <div className="agent-inspector-metrics">
        <span className={`agent-node-status ${node.status}`}>{t(`canvas.status.${node.status}`)}</span>
        <span>{formatDuration(dur)}</span>
        <span>↓{formatTokens(node.tokensIn)} ↑{formatTokens(node.tokensOut)}</span>
        <span>{node.activity.length} {t("canvas.tools")}</span>
      </div>
      {node.prompt ? <p className="agent-inspector-prompt">{node.prompt}</p> : null}
      {node.reasoning ? <div className="agent-inspector-reasoning">{node.reasoning}</div> : <p className="hint">{t("canvas.noReasoning")}</p>}
      <div className="agent-inspector-tools">
        {node.activity.map((a) => <ToolRow key={a.id} name={a.title || a.name} output={a.output} isError={a.isError} />)}
      </div>
    </div>
  );
}

function ToolRow({ name, output, isError }: { name: string; output?: string; isError?: boolean }) {
  const [copied, setCopied] = useState<"" | "ok" | "err">("");
  const copy = async () => {
    try { await navigator.clipboard.writeText(output ?? ""); setCopied("ok"); }
    catch { setCopied("err"); }
    setTimeout(() => setCopied(""), 1200);
  };
  return (
    <div className={`agent-tool-row ${isError ? "err" : ""}`}>
      <div className="agent-tool-head">
        <span className="agent-tool-name">{name}</span>
        {output ? <button className="agent-tool-copy" onClick={copy}>{copied === "ok" ? "copied" : copied === "err" ? "failed" : "copy"}</button> : null}
      </div>
      {output ? <pre className="agent-tool-out">{output}</pre> : null}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck** — `cd packages/desktop && npx tsc --noEmit 2>&1 | grep -E 'canvas/'` → expect NOTHING (the components are not yet imported anywhere; that is fine — tsc still checks them).
- [ ] **Step 4: Commit** — `git add packages/desktop/src/renderer/canvas/NodeCard.tsx packages/desktop/src/renderer/canvas/Inspector.tsx && git commit -m "feat(canvas): NodeCard and enriched Inspector components"`

---

### Task 6: Orchestrator wiring + toolbar + CSS (`AgentCanvas.tsx`, `styles.css`)

Integrates Tasks 2–5: collapse state, zoom/pan transform, toolbar, NodeCard, Inspector. Verified by typecheck + `pnpm build:web` + DOM inspection.

**Files:**
- Modify: `packages/desktop/src/renderer/canvas/AgentCanvas.tsx` (rewrite)
- Modify: `packages/desktop/src/renderer/styles.css` (`.agent-*` additions)

**Interfaces:**
- Consumes: `layoutGraph(graph, collapsed)`, `useZoomPan`, `NodeCard`, `Inspector`. Public props unchanged: `{ graph: RunGraph; hidden: boolean }`.

- [ ] **Step 1: Rewrite `AgentCanvas.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { layoutGraph } from "./layout";
import { useZoomPan } from "./useZoomPan";
import { NodeCard } from "./NodeCard";
import { Inspector } from "./Inspector";
import type { RunGraph } from "./runGraph";

const NODE_W = 176;
const NODE_H = 104;

export function AgentCanvas({ graph, hidden }: { graph: RunGraph; hidden: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const viewportRef = useRef<HTMLDivElement>(null);
  const zp = useZoomPan();

  useEffect(() => {
    if (hidden) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hidden]);

  const pos = useMemo(() => layoutGraph(graph, collapsed), [graph, collapsed]);
  const visibleIds = graph.order.filter((id) => pos[id]);
  const xs = visibleIds.map((id) => pos[id]!.x);
  const ys = visibleIds.map((id) => pos[id]!.y);
  const minX = Math.min(0, ...xs) - NODE_W;
  const minY = Math.min(0, ...ys) - NODE_H;
  const width = Math.max(...xs, 0) - minX + NODE_W * 2;
  const height = Math.max(...ys, 0) - minY + NODE_H * 2;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    zp.setViewport(el.clientWidth, el.clientHeight);
    zp.setContent(width, height);
  }, [width, height, hidden, zp]);

  const childCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const id of graph.order) { const p = graph.nodes[id]?.parentId; if (p) c[p] = (c[p] ?? 0) + 1; }
    return c;
  }, [graph]);

  const node = selected ? graph.nodes[selected] : null;

  const toggle = (id: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className={`agent-canvas ${hidden ? "hidden" : ""}`}>
      <div className="agent-canvas-viewport" ref={viewportRef} onWheel={zp.onWheel} onPointerDown={zp.onPointerDown}>
        <div className="agent-canvas-layer" style={{ transform: `translate(${zp.tx}px, ${zp.ty}px) scale(${zp.scale})`, width, height }}>
          <svg className="agent-canvas-edges" width={width} height={height}>
            {visibleIds.map((id) => {
              const n = graph.nodes[id]!;
              if (!n.parentId || !pos[n.parentId] || !pos[id]) return null;
              const p = pos[n.parentId]!; const c = pos[id]!;
              const x1 = p.x - minX + NODE_W / 2; const y1 = p.y - minY + NODE_H;
              const x2 = c.x - minX + NODE_W / 2; const y2 = c.y - minY;
              return <path key={id} className={`agent-edge ${n.status === "thinking" || n.status === "tool" ? "active" : ""}`} d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`} fill="none" />;
            })}
          </svg>
          {visibleIds.map((id) => {
            const p = pos[id]!;
            return (
              <div key={id} className="agent-node-wrap" style={{ left: p.x - minX, top: p.y - minY, width: NODE_W, height: NODE_H }}>
                <NodeCard node={graph.nodes[id]!} selected={selected === id} hasChildren={(childCount[id] ?? 0) > 0} collapsed={collapsed.has(id)} now={now} onSelect={() => setSelected(id)} onToggleCollapse={() => toggle(id)} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="agent-canvas-tools">
        <button className="icon sm" title="fit" onClick={zp.fit}>⊡</button>
        <button className="icon sm" title="zoom in" onClick={zp.zoomIn}>+</button>
        <button className="icon sm" title="zoom out" onClick={zp.zoomOut}>−</button>
        <button className="icon sm" title="reset" onClick={zp.reset}>◦</button>
      </div>
      {node ? <Inspector node={node} now={now} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
```

- [ ] **Step 2: Add CSS** to `styles.css` (append near the existing `.agent-*` rules; do not remove existing ones you still use — the old `.agent-node`, `.agent-edge`, `.agent-inspector*`, `.agent-tool*` remain and are reused). Add:

```css
.agent-canvas-viewport { position: absolute; inset: 0; overflow: hidden; cursor: grab; }
.agent-canvas-viewport:active { cursor: grabbing; }
.agent-canvas-layer { position: absolute; transform-origin: 0 0; }
.agent-node-wrap { position: absolute; }
.agent-node-hit { display: flex; flex-direction: column; gap: 3px; width: 100%; height: 100%; text-align: left; background: transparent; border: none; padding: 10px 12px; color: inherit; cursor: pointer; }
.agent-node-metrics { display: flex; gap: 8px; margin-top: auto; font-size: 10.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
.agent-node-collapse { position: absolute; right: 4px; top: 4px; width: 18px; height: 18px; border-radius: 5px; border: 1px solid var(--border); background: var(--elev); color: var(--muted); font-size: 12px; line-height: 1; cursor: pointer; }
.agent-node-collapse:hover { color: var(--text); background: var(--elev2); }
.agent-node.error { box-shadow: inset 0 0 0 1px var(--bad); }
.agent-canvas-tools { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 4px; background: var(--floating); border: 1px solid var(--border); border-radius: 9px; padding: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
.agent-inspector-metrics { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 8px 0 4px; font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.agent-tool-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.agent-tool-copy { background: transparent; border: 1px solid var(--border); color: var(--muted); border-radius: 6px; padding: 1px 7px; font-size: 10.5px; cursor: pointer; }
.agent-tool-copy:hover { color: var(--text); background: var(--elev); }
.agent-tool-out { margin: 6px 0 0; max-height: 160px; overflow: auto; white-space: pre-wrap; word-break: break-word; font-size: 11.5px; color: var(--muted); background: var(--elev); border-radius: 6px; padding: 6px 8px; }
.agent-tool-row.err .agent-tool-name { color: var(--bad); }
.agent-inspector-reasoning { max-height: 220px; overflow: auto; }
```

- [ ] **Step 3: Typecheck** — `cd packages/desktop && npx tsc --noEmit 2>&1 | grep -E 'canvas/' || echo CLEAN` → expect `CLEAN`.
- [ ] **Step 4: Web build** — from `packages/desktop`: `pnpm build:web` → BUILD OK.
- [ ] **Step 5: Run the pure-logic suite** — `npx vitest run packages/desktop/src/renderer/canvas` → all green.
- [ ] **Step 6: Commit** — `git add packages/desktop/src/renderer/canvas/AgentCanvas.tsx packages/desktop/src/renderer/styles.css && git commit -m "feat(canvas): zoom/pan viewport, metrics cards, collapse, toolbar wiring"`

---

## Self-review notes

- Spec coverage: metrics data (T2) → card metrics (T5/NodeCard) + inspector metrics (T5/Inspector); zoom/pan/fit (T4 + T6 wiring); collapse (T3 + T6 toggle) with `agent-node-collapse`; error highlight (`.agent-node.error`, `.agent-tool-row.err`); reasoning scroll + copy (Inspector CSS + ToolRow). Live duration via a 1s `now` tick in T6.
- No unit tests for React components — consistent with the package (vitest env `node`, no jsdom); those tasks are typecheck + build + DOM verified, stated explicitly.
- Types consistent across tasks: `RunNode` (with tokensIn/tokensOut/startedAt/endedAt), `formatTokens`/`formatDuration`, `layoutGraph(graph, collapsed)`, `computeFit`, `useZoomPan`, `NodeCard`, `Inspector`.
- Backward compat: `emptyGraph`/`reduceGraph`/`layoutGraph` new params default, so `App.tsx` (`reduceGraph(graph, event)`, `emptyGraph(id)`) keeps compiling.
