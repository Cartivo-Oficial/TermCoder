import { createAnthropic } from "@ai-sdk/anthropic";
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
};

/**
 * Resolve a provider-qualified model id (e.g. "anthropic/claude-sonnet-4-6")
 * to a Vercel AI SDK language model. API keys come from config.providers first,
 * then the provider's conventional environment variable.
 */
export function resolveModel(
  modelId: string,
  { config, env = process.env }: ResolveModelOptions,
): LanguageModel {
  const slash = modelId.indexOf("/");
  if (slash === -1) {
    throw new Error(
      `Model id must be "provider/model" (e.g. "anthropic/claude-sonnet-4-6"), got "${modelId}".`,
    );
  }
  const provider = modelId.slice(0, slash);
  const model = modelId.slice(slash + 1);

  const apiKey = config.providers[provider]?.apiKey ?? env[ENV_KEY[provider] ?? ""];
  if (!apiKey) {
    const hint = ENV_KEY[provider] ? ` Set ${ENV_KEY[provider]}.` : "";
    throw new Error(`No API key configured for provider "${provider}".${hint}`);
  }

  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    default:
      throw new Error(`Unknown provider "${provider}". Supported: anthropic, openai.`);
  }
}
