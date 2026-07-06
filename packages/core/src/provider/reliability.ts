import type { Config } from "../config/config";

/** How many times to retry the SAME model on a transient error before falling back. */
export const MODEL_RETRIES = 1;

/** The best fast model the user has a key for — better and more reliable than keyless. */
export function firstKeyedModel(config: Config, env: NodeJS.ProcessEnv): string | undefined {
  const has = (provider: string, ...vars: string[]) =>
    Boolean(config.providers[provider]?.apiKey) || vars.some((v) => Boolean(env[v]));
  if (has("google", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY")) return "google/gemini-2.5-flash";
  if (has("anthropic", "ANTHROPIC_API_KEY")) return "anthropic/claude-haiku-4-5-20251001";
  if (has("openai", "OPENAI_API_KEY")) return "openai/gpt-4o-mini";
  return undefined;
}

export interface RetryState {
  model: string;
  retriesLeft: number;
  fallback?: string;
}

/**
 * The next attempt after a model error: retry the same model while retries
 * remain, then fall back once to a distinct model, then give up (null).
 */
export function nextModelOnError(s: RetryState): RetryState | null {
  if (s.retriesLeft > 0) return { model: s.model, retriesLeft: s.retriesLeft - 1, fallback: s.fallback };
  if (s.fallback && s.fallback !== s.model) return { model: s.fallback, retriesLeft: 0 };
  return null;
}

export async function* streamWithIdleTimeout<C>(
  stream: AsyncIterable<C>,
  ms: number,
  onTimeout?: () => void,
): AsyncGenerator<C | { type: "error"; error: unknown }> {
  const it = stream[Symbol.asyncIterator]();
  while (true) {
    let timer: NodeJS.Timeout | undefined;
    const nextP = it.next();
    nextP.catch(() => {});
    const winner = await Promise.race([
      nextP.then((r) => ({ kind: "next" as const, r })),
      new Promise<{ kind: "timeout" }>((res) => {
        timer = setTimeout(() => res({ kind: "timeout" }), ms);
      }),
    ]);
    clearTimeout(timer);
    if (winner.kind === "timeout") {
      onTimeout?.();
      yield { type: "error", error: new Error(`The model produced no output for ${Math.round(ms / 1000)}s (timed out)`) };
      try {
        const ret = it.return?.(undefined as never);
        if (ret) {
          await Promise.race([ret, new Promise(r => setTimeout(r, 50))]);
        }
      } catch {}
      return;
    }
    if (winner.r.done) return;
    yield winner.r.value;
  }
}
