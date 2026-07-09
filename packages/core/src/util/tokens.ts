import type { ModelMessage } from "ai";

export function capText(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.max(0, Math.floor(max * 0.65));
  const tail = Math.max(0, max - head - 48);
  const omitted = text.length - head - tail;
  return `${text.slice(0, head)}\n… [${omitted} characters truncated to save context] …\n${text.slice(text.length - tail)}`;
}

interface TextOutput {
  type: "text";
  value: string;
}
function isTextOutput(o: unknown): o is TextOutput {
  return (
    typeof o === "object" &&
    o !== null &&
    (o as { type?: unknown }).type === "text" &&
    typeof (o as { value?: unknown }).value === "string"
  );
}

export function pruneMessagesForModel(
  messages: ModelMessage[],
  keepRecent: number,
): ModelMessage[] {
  const toolIndices: number[] = [];
  messages.forEach((m, i) => {
    if (m.role === "tool") toolIndices.push(i);
  });
  if (toolIndices.length <= keepRecent) return messages;

  const cutoff = toolIndices[toolIndices.length - keepRecent]!;
  return messages.map((m, i) => {
    if (m.role !== "tool" || i >= cutoff || !Array.isArray(m.content)) return m;
    const content = (m.content as unknown as Array<Record<string, unknown>>).map((part) => {
      if (part?.type === "tool-result" && isTextOutput(part.output)) {
        const len = part.output.value.length;
        if (len <= 160) return part;
        const name = typeof part.toolName === "string" ? part.toolName : "tool";
        return {
          ...part,
          output: { type: "text", value: `[earlier ${name} output elided to save context — ${len} chars]` },
        };
      }
      return part;
    });
    return { ...m, content } as unknown as ModelMessage;
  });
}
