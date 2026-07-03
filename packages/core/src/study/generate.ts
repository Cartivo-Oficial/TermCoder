import { generateText } from "ai";
import type { Config } from "../config/config";
import { resolveModel } from "../provider/provider";

/** Extract flashcards from a model reply — the first JSON array of {front, back}. */
export function parseCards(text: string): Array<{ front: string; back: string }> {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((c) => c as { front?: unknown; back?: unknown })
      .filter((c) => typeof c.front === "string" && typeof c.back === "string")
      .map((c) => ({ front: String(c.front).trim(), back: String(c.back).trim() }))
      .filter((c) => c.front && c.back);
  } catch {
    return [];
  }
}

/**
 * Ask the study model to write flashcards about a topic (or from pasted notes).
 * Uses termexplorer by default and returns parsed {front, back} pairs — free,
 * since the default model needs no key.
 */
export async function generateFlashcards(opts: {
  topic: string;
  count?: number;
  config: Config;
  env?: NodeJS.ProcessEnv;
  model?: string;
}): Promise<Array<{ front: string; back: string }>> {
  const count = opts.count ?? 8;
  const model = resolveModel(opts.model ?? "termexplorer/auto", { config: opts.config, env: opts.env });
  // Fail fast rather than hang: the free keyless model can be slow/flaky, and a
  // caller (the CLI/desktop) would rather show "try again" than wait a minute.
  const { text } = await generateText({
    model,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(45_000),
    prompt:
      `Create ${count} study flashcards about:\n\n${opts.topic}\n\n` +
      `Return ONLY a JSON array of objects with "front" (a question or prompt) and ` +
      `"back" (the answer). No prose, no markdown fences. Keep each side concise and ` +
      `factual. Reply in the same language as the topic.`,
  });
  return parseCards(text);
}
