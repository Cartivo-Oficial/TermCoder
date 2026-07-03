import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
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

/** Providers that never need an API key (local, or a free keyless service). */
export const KEYLESS_PROVIDERS = new Set(["ollama", "pollinations"]);

/** The free, keyless model everyone can use out of the box — no setup. */
export const FREE_MODEL = "pollinations/openai";

function providerHasKey(config: Config, env: NodeJS.ProcessEnv, provider: string): boolean {
  if (KEYLESS_PROVIDERS.has(provider)) return true;
  if (config.providers[provider]?.apiKey) return true;
  if (provider === "anthropic") return Boolean(env.ANTHROPIC_API_KEY);
  if (provider === "openai") return Boolean(env.OPENAI_API_KEY);
  if (provider === "google") return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY);
  return false;
}

/** How hard a task looks — drives which model tier the router picks. */
export type TaskComplexity = "simple" | "complex";

const COMPLEX_RE =
  /\b(re-?architect|architect(ure)?|redesign|design\s+(a|an|the)|debug|root\s*cause|race\s*condition|concurren\w*|deadlock|performance|optimi[sz]e|memory\s*leak|security|vulnerab\w*|migrat\w*|algorithm|investigate|profil\w*|scal(e|ing)|refactor\w*|threading|distributed)\b/i;

const CROSS_CUTTING_RE = /\b(across|throughout|entire|codebase|multiple\s+files|every\s+\w+\s+file)\b/i;

/**
 * Classify a request as "simple" (a small, local edit/answer) or "complex"
 * (architecture, debugging, cross-cutting or long tasks). A transparent
 * heuristic — no model call — so routing is instant and predictable.
 */
export function classifyTaskComplexity(text: string): TaskComplexity {
  const t = text.trim();
  if (t.length > 600) return "complex";
  if (COMPLEX_RE.test(t)) return "complex";
  if (CROSS_CUTTING_RE.test(t)) return "complex";
  return "simple";
}

/** Per-provider fast/strong model tiers used by the complexity router. */
const TIERS: Record<string, { fast: string; strong: string }> = {
  google: { fast: "google/gemini-2.5-flash", strong: "google/gemini-2.5-pro" },
  anthropic: { fast: "anthropic/claude-haiku-4-5-20251001", strong: "anthropic/claude-sonnet-4-6" },
  openai: { fast: "openai/gpt-4o-mini", strong: "openai/gpt-4o" },
  ollama: { fast: "ollama/llama3.1", strong: "ollama/llama3.1" },
  pollinations: { fast: FREE_MODEL, strong: FREE_MODEL },
};

/**
 * The termcoder/auto router: pick the best model the user can actually use,
 * favouring free/local, and matching the model tier to task complexity — a
 * cheap/fast model for simple edits, the strongest available for hard work.
 * Honours an explicit `config.termcoder.route` list first.
 */
export function pickAutoModel(
  config: Config,
  env: NodeJS.ProcessEnv = process.env,
  complexity: TaskComplexity = "simple",
): string {
  const route = config.termcoder?.route;
  if (Array.isArray(route) && route.length) {
    const ids = route.filter((id): id is string => typeof id === "string" && id.includes("/"));
    // With two+ entries, treat [fast, strong, …]; pick by complexity.
    if (ids.length) return complexity === "complex" ? (ids[1] ?? ids[0]!) : ids[0]!;
  }
  // Prefer a real key if the user set one (better quality + higher limits).
  // Then a local Ollama if they opted into it. Otherwise the free, keyless
  // service — so termcoder works with zero setup and never hits "no model".
  const hasApiKey = (p: string) => Boolean(config.providers[p]?.apiKey) || Boolean(env[ENV_KEY[p] ?? ""]) || (p === "google" && Boolean(env.GEMINI_API_KEY));
  const provider =
    (hasApiKey("google") && "google") ||
    (hasApiKey("anthropic") && "anthropic") ||
    (hasApiKey("openai") && "openai") ||
    (config.providers.ollama && "ollama") || // only if explicitly configured
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

/**
 * Resolve a provider-qualified model id (e.g. "anthropic/claude-sonnet-4-6") to
 * a Vercel AI SDK language model. Supports paid providers (anthropic, openai),
 * free options (google's Gemini free tier, local ollama), and any
 * OpenAI-compatible endpoint via a per-provider `baseURL`.
 *
 * API keys come from `config.providers[provider].apiKey` first, then the
 * provider's conventional environment variable.
 */
/** Our virtual "brain" models (termcoder = coding, termexplorer = study). */
export function isVirtualModel(modelId: string): boolean {
  return modelId.startsWith("termcoder/") || modelId.startsWith("termexplorer/");
}

export function resolveModel(
  modelId: string,
  { config, env = process.env }: ResolveModelOptions,
): LanguageModel {
  // Our virtual brains ("termcoder/auto", "termexplorer/auto") route to a
  // concrete provider model; the persona is decided by the session, not here.
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
      // Local, free, no key. Ollama exposes an OpenAI-compatible API. Use the
      // Chat Completions API (.chat) — these servers don't implement the newer
      // Responses API the SDK would otherwise default to.
      return createOpenAI({
        baseURL: cfg.baseURL ?? "http://localhost:11434/v1",
        apiKey: cfg.apiKey ?? "ollama",
      }).chat(model);

    case "pollinations":
      // Free, keyless, community-hosted OpenAI-compatible service. This is the
      // zero-setup default so anyone can use termcoder without an API key.
      return createOpenAI({
        baseURL: cfg.baseURL ?? "https://text.pollinations.ai/openai",
        apiKey: cfg.apiKey ?? "free",
      }).chat(model);

    default:
      throw new Error(
        `Unknown provider "${provider}". Supported: anthropic, openai, google, ollama, pollinations ` +
          `(or any OpenAI-compatible server via providers.openai.baseURL).`,
      );
  }
}

export interface SuggestOptions extends ResolveModelOptions {
  /** The recent exchange to base the suggestion on. */
  context: string;
  model?: string;
}

/**
 * Suggest the single most useful next request the user might make, based on the
 * latest exchange. On-demand (one cheap call) so it never runs unless asked.
 * Best-effort — returns "" on any failure.
 */
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
  /** Raw audio bytes (WAV/PCM recommended for broad provider support). */
  audio: Uint8Array;
  /** MIME type of the audio, e.g. "audio/wav". */
  mediaType: string;
  /** Override the model used for transcription; defaults to config.model. */
  model?: string;
}

/**
 * Transcribe a short audio clip using the configured chat model's multimodal
 * input (e.g. Gemini). This avoids a paid speech API — it reuses whatever
 * provider key the user already has. The model must accept audio input.
 */
export interface CompleteCodeOptions extends ResolveModelOptions {
  /** Text before the cursor. */
  prefix: string;
  /** Text after the cursor. */
  suffix: string;
  language?: string;
  model?: string;
}

function cleanCompletion(text: string): string {
  let t = text.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/```\s*$/, "").trimEnd();
  // Cap runaway completions.
  const lines = t.split("\n");
  if (lines.length > 12) t = lines.slice(0, 12).join("\n");
  return t.length > 600 ? t.slice(0, 600) : t;
}

/**
 * Ghost-text code completion for the editor: given the code around the cursor,
 * return only the snippet to insert. Best-effort — errors yield an empty string.
 */
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
