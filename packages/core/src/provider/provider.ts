import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { Config } from "../config/config";

export interface ResolveModelOptions {
  config: Config;
  env?: NodeJS.ProcessEnv;
}

const ENV_KEY: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

function requireKey(provider: string, apiKey: string | undefined): string {
  if (apiKey) return apiKey;
  const envVar = ENV_KEY[provider];
  throw new Error(
    `No API key configured for provider "${provider}".${envVar ? ` Set ${envVar}.` : ""}`,
  );
}

/**
 * Resolve a provider-qualified model id (e.g. "anthropic/claude-sonnet-4-6") to
 * a Vercel AI SDK language model. Supports paid providers (anthropic, openai),
 * free options (google's Gemini free tier, local ollama), and any
 * OpenAI-compatible endpoint via a per-provider `baseURL`.
 *
 * API keys come from `config.providers[provider].apiKey` first, then the
 * provider's conventional environment variable.
 */
export function resolveModel(
  modelId: string,
  { config, env = process.env }: ResolveModelOptions,
): LanguageModel {
  const slash = modelId.indexOf("/");
  if (slash === -1) {
    throw new Error(
      `Model id must be "provider/model" (e.g. "ollama/llama3.1"), got "${modelId}".`,
    );
  }
  const provider = modelId.slice(0, slash);
  const model = modelId.slice(slash + 1);
  const cfg = config.providers[provider] ?? {};

  switch (provider) {
    case "anthropic":
      return createAnthropic({
        apiKey: requireKey(provider, cfg.apiKey ?? env.ANTHROPIC_API_KEY),
        baseURL: cfg.baseURL,
      })(model);

    case "openai":
      return createOpenAI({
        apiKey: requireKey(provider, cfg.apiKey ?? env.OPENAI_API_KEY),
        baseURL: cfg.baseURL,
      })(model);

    case "google":
      return createGoogleGenerativeAI({
        apiKey: requireKey(
          provider,
          cfg.apiKey ?? env.GOOGLE_GENERATIVE_AI_API_KEY ?? env.GEMINI_API_KEY,
        ),
        baseURL: cfg.baseURL,
      })(model);

    case "ollama":
      // Local, free, no key. Ollama exposes an OpenAI-compatible API.
      return createOpenAI({
        baseURL: cfg.baseURL ?? "http://localhost:11434/v1",
        apiKey: cfg.apiKey ?? "ollama",
      })(model);

    default:
      throw new Error(
        `Unknown provider "${provider}". Supported: anthropic, openai, google, ollama ` +
          `(or any OpenAI-compatible server via providers.openai.baseURL).`,
      );
  }
}
