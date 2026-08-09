import { describe, expect, it } from "vitest";
import { translateStop, translateUpdate } from "./translate";

const SRC = "node-1";

describe("an ACP update becomes one of our events", () => {
  it("carries an assistant message chunk as text", () => {
    const e = translateUpdate(
      { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } } as never,
      SRC,
    );
    expect(e).toEqual({ type: "text-delta", text: "hello", sourceId: SRC });
  });

  it("carries a thought chunk as reasoning", () => {
    const e = translateUpdate(
      { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "thinking" } } as never,
      SRC,
    );
    expect(e).toEqual({ type: "reasoning-delta", text: "thinking", sourceId: SRC });
  });

  it("opens a tool call", () => {
    const e = translateUpdate(
      { sessionUpdate: "tool_call", toolCallId: "t1", title: "Read file", kind: "read", status: "pending" } as never,
      SRC,
    );
    expect(e).toMatchObject({ type: "tool-call", id: "t1", name: "read", title: "Read file", sourceId: SRC });
  });

  it("closes a tool call only when it completes", () => {
    const running = translateUpdate(
      { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "in_progress" } as never,
      SRC,
    );
    expect(running).toBeNull();

    const done = translateUpdate(
      {
        sessionUpdate: "tool_call_update",
        toolCallId: "t1",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "ok" } }],
      } as never,
      SRC,
    );
    expect(done).toMatchObject({ type: "tool-result", id: "t1", output: "ok", isError: false, sourceId: SRC });
  });

  it("marks a failed tool call as an error result", () => {
    const e = translateUpdate(
      { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "failed" } as never,
      SRC,
    );
    expect(e).toMatchObject({ type: "tool-result", id: "t1", isError: true });
  });

  it("carries usage", () => {
    const e = translateUpdate({ sessionUpdate: "usage_update", used: 120, size: 200000 } as never, SRC);
    expect(e).toMatchObject({ type: "usage", inputTokens: 120, sourceId: SRC });
  });

  it("keeps a plan visible instead of dropping it", () => {
    const e = translateUpdate(
      {
        sessionUpdate: "plan",
        entries: [{ content: "read the config", priority: "medium", status: "pending" }],
      } as never,
      SRC,
    );
    expect(e).toMatchObject({ type: "tool-call", name: "plan", sourceId: SRC });
  });

  it("returns null for an update it does not model, rather than inventing one", () => {
    expect(translateUpdate({ sessionUpdate: "something_new" } as never, SRC)).toBeNull();
  });
});

describe("a turn ends", () => {
  it("ends cleanly on end_turn", () => {
    expect(translateStop("end_turn", SRC)).toEqual({ type: "done", sourceId: SRC });
  });

  it("ends cleanly on cancelled, because we asked", () => {
    expect(translateStop("cancelled", SRC)).toEqual({ type: "done", sourceId: SRC });
  });

  it("reports refusal and the limits as errors, with the reason", () => {
    for (const reason of ["refusal", "max_tokens", "max_turn_requests"]) {
      const e = translateStop(reason, SRC);
      expect(e.type).toBe("error");
      expect((e as { error: string }).error).toContain(reason);
    }
  });
});
