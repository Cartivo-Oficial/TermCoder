import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import { capText, pruneMessagesForModel } from "./tokens";

describe("capText", () => {
  it("returns short text unchanged", () => {
    expect(capText("hello", 100)).toBe("hello");
  });

  it("truncates long text keeping head and tail", () => {
    const text = "A".repeat(500) + "TAIL" + "B".repeat(500);
    const out = capText(text, 200);
    expect(out.length).toBeLessThan(text.length);
    expect(out).toContain("truncated to save context");
    expect(out.startsWith("A")).toBe(true);
    expect(out.endsWith("B")).toBe(true);
  });
});

function toolMsg(id: string, value: string): ModelMessage {
  return {
    role: "tool",
    content: [{ type: "tool-result", toolCallId: id, toolName: "read", output: { type: "text", value } }],
  } as ModelMessage;
}

describe("pruneMessagesForModel", () => {
  const big = "X".repeat(1000);

  it("keeps everything when there are few tool results", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "hi" },
      toolMsg("a", big),
      toolMsg("b", big),
    ];
    expect(pruneMessagesForModel(messages, 6)).toBe(messages);
  });

  it("elides old tool outputs but keeps the most recent ones", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "task" },
      toolMsg("old1", big),
      toolMsg("old2", big),
      toolMsg("recent1", big),
      toolMsg("recent2", big),
    ];
    const pruned = pruneMessagesForModel(messages, 2);
    const valueOf = (m: ModelMessage) =>
      (m.content as Array<{ output: { value: string } }>)[0]!.output.value;

    expect(valueOf(pruned[1]!)).toContain("elided to save context");
    expect(valueOf(pruned[2]!)).toContain("elided to save context");
    expect(valueOf(pruned[3]!)).toBe(big); // recent kept in full
    expect(valueOf(pruned[4]!)).toBe(big);
    // The user turn is untouched.
    expect(pruned[0]).toBe(messages[0]);
  });

  it("does not stub already-small tool outputs", () => {
    const messages: ModelMessage[] = [
      toolMsg("a", "ok"),
      toolMsg("b", big),
      toolMsg("c", big),
    ];
    const pruned = pruneMessagesForModel(messages, 2);
    const valueOf = (m: ModelMessage) =>
      (m.content as Array<{ output: { value: string } }>)[0]!.output.value;
    expect(valueOf(pruned[0]!)).toBe("ok"); // short output left alone
  });
});
