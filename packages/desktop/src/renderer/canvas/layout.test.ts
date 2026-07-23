import { describe, expect, it } from "vitest";
import { layoutGraph } from "./layout";
import { emptyGraph, reduceGraph } from "./runGraph";
import type { RunGraph } from "./runGraph";

describe("layoutGraph", () => {
  it("places the root at depth 0 and children below it", () => {
    let g = emptyGraph("root");
    g = reduceGraph(g, { type: "tool-call", id: "c1", name: "task" });
    g = reduceGraph(g, { type: "subagent-start", sessionId: "s1", agent: "explore", prompt: "p", parentToolCallId: "c1" });
    const pos = layoutGraph(g);
    expect(pos.root!.y).toBeLessThan(pos.s1!.y);
  });

  it("assigns every node a position", () => {
    const g = emptyGraph("root");
    const pos = layoutGraph(g);
    expect(pos.root!).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });
});

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
