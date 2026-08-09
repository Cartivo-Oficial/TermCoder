import { describe, expect, it } from "vitest";
import { runSummary } from "./summary";
import type { NodeStatus, RunGraph } from "./runGraph";

function graph(statuses: Record<string, NodeStatus>): RunGraph {
  const ids = Object.keys(statuses);
  const nodes: RunGraph["nodes"] = {};
  for (const id of ids) {
    nodes[id] = {
      id,
      agent: "explore",
      status: statuses[id]!,
      reasoning: "",
      activity: [],
      tokensIn: 0,
      tokensOut: 0,
      startedAt: 0,
    };
  }
  return { rootId: ids[0] ?? "r", nodes, order: ids };
}

describe("runSummary", () => {
  it("counts nothing in an empty graph", () => {
    expect(runSummary({ rootId: "r", nodes: {}, order: [] })).toEqual({ running: 0, done: 0, failed: 0 });
  });

  it("counts idle, thinking and tool as running", () => {
    expect(runSummary(graph({ a: "idle", b: "thinking", c: "tool" }))).toEqual({ running: 3, done: 0, failed: 0 });
  });

  it("counts a mixed graph", () => {
    const g = graph({ r: "thinking", a: "tool", b: "done", c: "done", d: "error", e: "idle" });
    expect(runSummary(g)).toEqual({ running: 3, done: 2, failed: 1 });
  });

  it("reports every node done when the run finished", () => {
    expect(runSummary(graph({ r: "done", a: "done", b: "done" }))).toEqual({ running: 0, done: 3, failed: 0 });
  });

  it("separates a failure from the finished nodes", () => {
    expect(runSummary(graph({ r: "done", a: "error" }))).toEqual({ running: 0, done: 1, failed: 1 });
  });

  it("ignores ids in order that have no node", () => {
    const g = graph({ a: "done" });
    g.order = ["a", "ghost"];
    expect(runSummary(g)).toEqual({ running: 0, done: 1, failed: 0 });
  });
});
