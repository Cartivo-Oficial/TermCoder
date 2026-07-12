import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { anthropicOAuthModel } from "../auth/oauth";
import { chatgptModel } from "../auth/chatgpt-oauth";
import type { Config } from "../config/config";
import { markProvider, providerMarkedBad } from "./health";
import { repairToolCallStream } from "./keyless-stream";
import { providerInfo } from "./registry";

export interface ResolveModelOptions {
  config: Config;
  env?: NodeJS.ProcessEnv;
}

const ENV_KEY: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

export const KEYLESS_PROVIDERS = new Set(["ollama", "pollinations", "termcoderfree"]);

export const FREE_MODEL = "termcoderfree/auto";

function providerHasKey(config: Config, env: NodeJS.ProcessEnv, provider: string): boolean {
  if (KEYLESS_PROVIDERS.has(provider)) return true;
  if (provider === "anthropic" && config.providers.anthropic?.oauth) return true;
  if (provider === "openai" && config.providers.openai?.oauth) return true;
  if (config.providers[provider]?.apiKey) return true;
  return Boolean(keyFromEnv(provider, env));
}

export type TaskComplexity = "simple" | "complex";

const COMPLEX_RE =
  /\b(re-?architect|architect(ure)?|redesign|design\s+(a|an|the)|debug|root\s*cause|race\s*condition|concurren\w*|deadlock|performance|optimi[sz]e|memory\s*leak|security|vulnerab\w*|migrat\w*|algorithm|investigate|profil\w*|scal(e|ing)|refactor\w*|threading|distributed)\b/i;

const CROSS_CUTTING_RE = /\b(across|throughout|entire|codebase|multiple\s+files|every\s+\w+\s+file)\b/i;

export function classifyTaskComplexity(text: string): TaskComplexity {
  const t = text.trim();
  if (t.length > 600) return "complex";
  if (COMPLEX_RE.test(t)) return "complex";
  if (CROSS_CUTTING_RE.test(t)) return "complex";
  return "simple";
}

const TIERS: Record<string, { fast: string; strong: string }> = {
  google: { fast: "google/gemini-2.5-flash", strong: "google/gemini-2.5-pro" },
  anthropic: { fast: "anthropic/claude-haiku-4-5-20251001", strong: "anthropic/claude-sonnet-5" },
  openai: { fast: "openai/gpt-4o-mini", strong: "openai/gpt-4o" },
  ollama: { fast: "ollama/llama3.1", strong: "ollama/llama3.1" },
  pollinations: { fast: FREE_MODEL, strong: FREE_MODEL },
};

export function pickAutoModel(
  config: Config,
  env: NodeJS.ProcessEnv = process.env,
  complexity: TaskComplexity = "simple",
): string {
  const route = config.termcoder?.route;
  if (Array.isArray(route) && route.length) {
    const ids = route.filter((id): id is string => typeof id === "string" && id.includes("/"));
    if (ids.length) return complexity === "complex" ? (ids[1] ?? ids[0]!) : ids[0]!;
  }
  const hasApiKey = (p: string) => Boolean(config.providers[p]?.apiKey) || Boolean(env[ENV_KEY[p] ?? ""]) || (p === "google" && Boolean(env.GEMINI_API_KEY));
  const usable = (p: string) => hasApiKey(p) && !providerMarkedBad(p);
  const provider =
    (usable("google") && "google") ||
    (usable("anthropic") && "anthropic") ||
    (usable("openai") && "openai") ||
    (config.providers.ollama && !providerMarkedBad("ollama") && "ollama") || // only if explicitly configured
    "pollinations"; // free, keyless — the universal zero-setup default
  const tier = TIERS[provider]!;
  return complexity === "complex" ? tier.strong : tier.fast;
}

function requireKey(provider: string, apiKey: string | undefined): string {
  if (apiKey) return apiKey;
  const envVar = ENV_KEY[provider];
  throw new Error(
    `No API key configured for provider "${provider}".${envVar ? ` Set ${envVar}.` : ""}`,
  );
}

function keyFromEnv(provider: string, env: NodeJS.ProcessEnv): string | undefined {
  for (const name of providerInfo(provider)?.keyEnv ?? []) {
    if (env[name]) return env[name];
  }
  return undefined;
}

export function isVirtualModel(modelId: string): boolean {
  return modelId.startsWith("termcoder/") || modelId.startsWith("termexplorer/");
}

export function resolveModel(
  modelId: string,
  { config, env = process.env }: ResolveModelOptions,
): LanguageModel {
  if (modelId.startsWith("termcoderfree/")) {
    return resolveModel("pollinations/openai", { config, env });
  }
  if (isVirtualModel(modelId)) {
    return resolveModel(pickAutoModel(config, env), { config, env });
  }
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
    case "anthropic": {
      const oauth = cfg.oauth;
      if (!cfg.apiKey && !env.ANTHROPIC_API_KEY && oauth) {
        return anthropicOAuthModel(model, oauth);
      }
      return createAnthropic({
        apiKey: requireKey(provider, cfg.apiKey ?? env.ANTHROPIC_API_KEY),
        baseURL: cfg.baseURL,
      })(model);
    }

    case "openai": {
      const oauth = cfg.oauth;
      if (!cfg.apiKey && !env.OPENAI_API_KEY && oauth) {
        return chatgptModel(model, oauth);
      }
      return createOpenAI({
        apiKey: requireKey(provider, cfg.apiKey ?? env.OPENAI_API_KEY),
        baseURL: cfg.baseURL,
      })(model);
    }

    case "google":
      return createGoogleGenerativeAI({
        apiKey: requireKey(
          provider,
          cfg.apiKey ?? env.GOOGLE_GENERATIVE_AI_API_KEY ?? env.GEMINI_API_KEY,
        ),
        baseURL: cfg.baseURL,
      })(model);

    case "ollama":
      return createOpenAI({
        baseURL: cfg.baseURL ?? "http://localhost:11434/v1",
        apiKey: cfg.apiKey ?? "ollama",
      }).chat(model);

    case "pollinations":
      return createOpenAI({
        baseURL: cfg.baseURL ?? "https://text.pollinations.ai/openai",
        apiKey: cfg.apiKey ?? "free",
        fetch: repairToolCallStream(),
      }).chat(model);

    default: {
      const info = providerInfo(provider);
      if (info?.kind === "openai-compat") {
        const apiKey = cfg.apiKey ?? keyFromEnv(provider, env);
        if (!apiKey) {
          throw new Error(`No API key for "${provider}". Set ${info.keyEnv?.[0] ?? "an API key"} or run /key ${provider} <key>.`);
        }
        return createOpenAI({ baseURL: cfg.baseURL ?? info.baseURL, apiKey }).chat(model);
      }
      throw new Error(`Unknown provider "${provider}". Connectable providers: anthropic, openai, google, groq, openrouter, mistral, deepseek, xai, together, cerebras, ollama, termcoderfree.`);
    }
  }
}

export interface ProbeOptions extends ResolveModelOptions {
  probe?: (model: LanguageModel) => Promise<unknown>;
}

export async function probeProvider(id: string, opts: ProbeOptions): Promise<{ ok: boolean; error?: string }> {
  const info = providerInfo(id);
  if (!info) return { ok: false, error: `Unknown provider "${id}".` };
  try {
    const model = resolveModel(info.fastModel, opts);
    const run =
      opts.probe ??
      (async (m: LanguageModel) =>
        generateText({ model: m, prompt: "Reply with exactly: ok", abortSignal: AbortSignal.timeout(10_000) }));
    await run(model);
    markProvider(id, true);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    markProvider(id, false, error);
    return { ok: false, error };
  }
}

export interface SuggestOptions extends ResolveModelOptions {
  context: string;
  model?: string;
}

export async function suggestFollowup(opts: SuggestOptions): Promise<string> {
  try {
    const model = resolveModel(opts.model ?? pickAutoModel(opts.config, opts.env), opts);
    const { text } = await generateText({
      model,
      system:
        "Given the exchange below, suggest the single most useful next request the user " +
        "might make. Reply with ONLY that request as a short imperative (max 12 words), no " +
        "quotes, no preamble.",
      messages: [{ role: "user", content: opts.context.slice(0, 2000) }],
    });
    return text.trim().replace(/^["']|["']$/g, "").split("\n")[0]!.slice(0, 120);
  } catch {
    return "";
  }
}

export interface TranscribeOptions extends ResolveModelOptions {
  audio: Uint8Array;
  mediaType: string;
  model?: string;
}

export interface CompleteCodeOptions extends ResolveModelOptions {
  prefix: string;
  suffix: string;
  language?: string;
  model?: string;
}

function cleanCompletion(text: string): string {
  let t = text.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/```\s*$/, "").trimEnd();
  const lines = t.split("\n");
  if (lines.length > 12) t = lines.slice(0, 12).join("\n");
  return t.length > 600 ? t.slice(0, 600) : t;
}

export async function completeCode(opts: CompleteCodeOptions): Promise<string> {
  const model = resolveModel(opts.model ?? opts.config.model, opts);
  const { text } = await generateText({
    model,
    system:
      "You are a code autocomplete engine. Given the code before and after the cursor, output " +
      "ONLY the code to insert at the cursor to continue naturally. No explanations, no markdown " +
      "fences, and do not repeat code that already exists. Keep it short — a few lines at most.",
    messages: [
      {
        role: "user",
        content: `<before>\n${opts.prefix}\n</before>\n<after>\n${opts.suffix}\n</after>\n\nInsert at the cursor:`,
      },
    ],
  });
  return cleanCompletion(text);
}

export async function transcribeAudio(opts: TranscribeOptions): Promise<string> {
  const model = resolveModel(opts.model ?? opts.config.model, opts);
  const result = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "file", data: opts.audio, mediaType: opts.mediaType },
          {
            type: "text",
            text:
              "Transcribe this audio verbatim. Return ONLY the transcript text, " +
              "with no quotes, labels, or extra commentary. If there is no speech, return an empty string.",
          },
        ],
      },
    ],
  });
  return result.text.trim();
}
