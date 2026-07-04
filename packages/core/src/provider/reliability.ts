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
