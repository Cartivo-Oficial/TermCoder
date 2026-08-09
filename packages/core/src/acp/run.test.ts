import { agent, type AgentApp } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import type { SessionEvent } from "../session/session";
import { runSession } from "./run";

function talkingAgent(): AgentApp {
  return agent()
    .onRequest("initialize", () => ({ protocolVersion: 1, agentCapabilities: {} }))
    .onRequest("session/new", () => ({ sessionId: "s1" }))
    .onRequest("session/prompt", async (ctx) => {
      await ctx.client.notify("session/update", {
        sessionId: "s1",
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "hi" },
        },
      });
      return { stopReason: "end_turn" as const };
    });
}

function askingAgent(seen: { asked: number; outcome: unknown }): AgentApp {
  return agent()
    .onRequest("initialize", () => ({ protocolVersion: 1, agentCapabilities: {} }))
    .onRequest("session/new", () => ({ sessionId: "s1" }))
    .onRequest("session/prompt", async (ctx) => {
      seen.asked += 1;
      const response = await ctx.client.request("session/request_permission", {
        sessionId: "s1",
        toolCall: { toolCallId: "t1", title: "write src/main.ts" },
        options: [
          { optionId: "allow-once", name: "Allow once", kind: "allow_once" as const },
          { optionId: "reject-once", name: "Reject", kind: "reject_once" as const },
        ],
      });
      seen.outcome = response.outcome;
      return { stopReason: "end_turn" as const };
    });
}

function quietAgent(): AgentApp {
  return agent()
    .onRequest("initialize", () => ({ protocolVersion: 1, agentCapabilities: {} }))
    .onRequest("session/new", () => ({ sessionId: "s1" }))
    .onRequest("session/prompt", async (ctx) => {
      await ctx.client.notify("session/update", {
        sessionId: "s1",
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: "t1",
          status: "in_progress",
        },
      });
      return { stopReason: "refusal" as const };
    });
}

function cancellingAgent(): AgentApp {
  let release = () => {};
  const told = new Promise<void>((resolve) => {
    release = resolve;
  });
  return agent()
    .onRequest("initialize", () => ({ protocolVersion: 1, agentCapabilities: {} }))
    .onRequest("session/new", () => ({ sessionId: "s1" }))
    .onRequest("session/prompt", async () => {
      await told;
      return { stopReason: "cancelled" as const };
    })
    .onNotification("session/cancel", () => {
      release();
    });
}

describe("running an agent", () => {
  it("emits what the agent said, then finishes", async () => {
    const events: SessionEvent[] = [];
    await runSession({
      connectTo: talkingAgent(),
      cwd: "/repo",
      prompt: "do it",
      sourceId: "node-1",
      emit: (e) => events.push(e),
      askPermission: async () => "allow",
    });
    expect(events.map((e) => e.type)).toEqual(["text-delta", "done"]);
    expect(events.every((e) => e.sourceId === "node-1")).toBe(true);
  });

  it("emits nothing for updates the translator has no event for", async () => {
    const events: SessionEvent[] = [];
    await runSession({
      connectTo: quietAgent(),
      cwd: "/repo",
      prompt: "do it",
      sourceId: "node-2",
      emit: (e) => events.push(e),
      askPermission: async () => "allow",
    });
    expect(events).toEqual([
      { type: "error", error: "the agent stopped: refusal", sourceId: "node-2" },
    ]);
  });

  it("asks the caller for permission and answers with the option it chose", async () => {
    const seen = { asked: 0, outcome: null as unknown };
    let requested: { title: string; options: Array<{ id: string; name: string }> } | null = null;
    await runSession({
      connectTo: askingAgent(seen),
      cwd: "/repo",
      prompt: "do it",
      sourceId: "node-3",
      emit: () => {},
      askPermission: async (req) => {
        requested = req;
        return "reject-once";
      },
    });
    expect(seen.asked).toBe(1);
    expect(requested).toEqual({
      title: "write src/main.ts",
      options: [
        { id: "allow-once", name: "Allow once" },
        { id: "reject-once", name: "Reject" },
      ],
    });
    expect(seen.outcome).toEqual({ outcome: "selected", optionId: "reject-once" });
  });

  it("cancels rather than guessing when the caller's answer is not on offer", async () => {
    const seen = { asked: 0, outcome: null as unknown };
    await runSession({
      connectTo: askingAgent(seen),
      cwd: "/repo",
      prompt: "do it",
      sourceId: "node-4",
      emit: () => {},
      askPermission: async () => "allow",
    });
    expect(seen.outcome).toEqual({ outcome: "cancelled" });
  });

  it("tells the agent to stop when the signal aborts", async () => {
    const events: SessionEvent[] = [];
    const control = new AbortController();
    const run = runSession({
      connectTo: cancellingAgent(),
      cwd: "/repo",
      prompt: "do it",
      sourceId: "node-5",
      emit: (e) => events.push(e),
      askPermission: async () => "allow",
      signal: control.signal,
    });
    control.abort();
    await run;
    expect(events).toEqual([{ type: "done", sourceId: "node-5" }]);
  });
});
