import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { SessionEvent } from "../session/session";

function textOf(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  const block = content as { type?: string; text?: string };
  if (block.type === "text" && typeof block.text === "string") return block.text;
  return "";
}

function outputOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      const wrapped = item as { type?: string; content?: unknown };
      return wrapped.type === "content" ? textOf(wrapped.content) : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function translateUpdate(update: SessionUpdate, sourceId: string): SessionEvent | null {
  const u = update as unknown as Record<string, unknown>;
  switch (u.sessionUpdate) {
    case "agent_message_chunk":
      return { type: "text-delta", text: textOf(u.content), sourceId };
    case "agent_thought_chunk":
      return { type: "reasoning-delta", text: textOf(u.content), sourceId };
    case "tool_call":
      return {
        type: "tool-call",
        id: String(u.toolCallId),
        name: String(u.kind ?? "tool"),
        args: u.rawInput ?? {},
        title: typeof u.title === "string" ? u.title : undefined,
        sourceId,
      };
    case "tool_call_update": {
      if (u.status !== "completed" && u.status !== "failed") return null;
      return {
        type: "tool-result",
        id: String(u.toolCallId),
        name: String(u.kind ?? "tool"),
        output: outputOf(u.content),
        isError: u.status === "failed",
        sourceId,
      };
    }
    case "usage_update":
      return { type: "usage", inputTokens: Number(u.used ?? 0), outputTokens: 0, sourceId };
    case "plan": {
      const entries = Array.isArray(u.entries) ? u.entries : [];
      const lines = entries.map((e) => {
        const entry = e as { content?: string; status?: string };
        return `${entry.status ?? "pending"}: ${entry.content ?? ""}`;
      });
      return {
        type: "tool-call",
        id: `plan-${entries.length}`,
        name: "plan",
        args: { entries },
        title: "Plan",
        detail: lines.join("\n"),
        sourceId,
      };
    }
    default:
      return null;
  }
}

export function translateStop(stopReason: string, sourceId: string): SessionEvent {
  if (stopReason === "end_turn" || stopReason === "cancelled") return { type: "done", sourceId };
  return { type: "error", error: `the agent stopped: ${stopReason}`, sourceId };
}
