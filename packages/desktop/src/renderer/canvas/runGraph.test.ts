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
    expect(g.nodes.root!.reasoning).toBe("plan more");
    expect(g.nodes.root!.activity).toHaveLength(1);
    expect(g.nodes.root!.activity[0]!.done).toBe(true);
  });

  it("creates a child node on subagent-start and links it to the spawning tool-call", () => {
    const g = run([
      { type: "tool-call", id: "call-1", name: "task", title: "sub-agent" },
      { type: "subagent-start", sessionId: "sub-1", agent: "explore", prompt: "look", parentToolCallId: "call-1" },
    ]);
    expect(g.nodes["sub-1"]).toBeTruthy();
    expect(g.nodes["sub-1"]!.parentId).toBe("root");
    expect(g.nodes["sub-1"]!.agent).toBe("explore");
    expect(g.order).toContain("sub-1");
  });

  it("routes sourceId events to the matching child node", () => {
    const g = run([
      { type: "tool-call", id: "call-1", name: "task" },
      { type: "subagent-start", sessionId: "sub-1", agent: "explore", prompt: "look", parentToolCallId: "call-1" },
      { type: "reasoning-delta", text: "child thought", sourceId: "sub-1" },
      { type: "subagent-end", sessionId: "sub-1", status: "done" },
    ]);
    expect(g.nodes["sub-1"]!.reasoning).toBe("child thought");
    expect(g.nodes["sub-1"]!.status).toBe("done");
    expect(g.nodes.root!.reasoning).toBe("");
  });

  it("sets status: thinking on reasoning, tool while a tool is open, done on done", () => {
    let g = run([{ type: "reasoning-delta", text: "x" }]);
    expect(g.nodes.root!.status).toBe("thinking");
    g = reduceGraph(g, { type: "tool-call", id: "t1", name: "read" });
    expect(g.nodes.root!.status).toBe("tool");
    g = reduceGraph(g, { type: "tool-result", id: "t1", name: "read", output: "", isError: false });
    g = reduceGraph(g, { type: "done" });
    expect(g.nodes.root!.status).toBe("done");
  });

  it("degrades gracefully for an unknown sourceId (attaches to root, never throws)", () => {
    const g = run([{ type: "reasoning-delta", text: "orphan", sourceId: "ghost" }]);
    expect(g.nodes.root!.reasoning).toBe("orphan");
    expect(g.nodes.ghost).toBeUndefined();
  });
});
