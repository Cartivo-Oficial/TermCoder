import { describe, expect, it } from "vitest";
import { layoutGraph } from "./layout";
import { emptyGraph, reduceGraph } from "./runGraph";

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
