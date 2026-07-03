import type { ModelMessage } from "ai";

/**
 * Truncate text to a character budget, keeping the head and tail with a marker
 * in between. Tool outputs (file reads, command logs, search hits) are the main
 * driver of context bloat, and their useful signal is usually at the ends.
 */
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

/**
 * Build a model-facing view of the message history that keeps the full record
 * intact but elides the bodies of older tool results. The most recent
 * `keepRecent` tool results are sent verbatim (they're what the model is
 * actively working with); everything older becomes a one-line stub. This stops
 * a long session from re-billing every past file read and command dump on every
 * turn — the single biggest token sink in an agent loop.
 */
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
