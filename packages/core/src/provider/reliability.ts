import type { Config } from "../config/config";
import { providerMarkedBad } from "./health";

export const MODEL_RETRIES = 1;
export const KEYLESS_RETRIES = 3;

const TRANSIENT_RE =
  /\b(429|too\s*many\s*requests|rate[\s-]*limit\w*|overload\w*|capacity|timed?\s*out|timeout|temporar\w*|unavailable|try\s*again|502|503|504|econnreset|etimedout|econnrefused|enotfound|fetch\s*failed|network|socket)\b/i;

export function isTransientError(message: string): boolean {
  return TRANSIENT_RE.test(message);
}

export function backoffMs(attemptIndex: number): number {
  return Math.min(700 * 2 ** Math.max(0, attemptIndex), 6000);
}

export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

export function firstKeyedModel(config: Config, env: NodeJS.ProcessEnv): string | undefined {
  const has = (provider: string, ...vars: string[]) =>
    !providerMarkedBad(provider) &&
    (Boolean(config.providers[provider]?.apiKey) || vars.some((v) => Boolean(env[v])));
  if (has("google", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY")) return "google/gemini-2.5-flash";
  if (!providerMarkedBad("anthropic") && (has("anthropic", "ANTHROPIC_API_KEY") || Boolean(config.providers.anthropic?.oauth)))
    return "anthropic/claude-haiku-4-5-20251001";
  if (!providerMarkedBad("openai") && (has("openai", "OPENAI_API_KEY") || Boolean(config.providers.openai?.oauth)))
    return "openai/gpt-4o-mini";
  return undefined;
}

export interface RetryState {
  model: string;
  retriesLeft: number;
  fallback?: string;
}

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
