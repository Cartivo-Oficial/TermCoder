import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config } from "../config/config";

export interface ModelEntry {
  id: string; // "provider/model"
  provider: string;
  model: string;
  name: string;
  contextK?: number;
  vision?: boolean;
  free?: boolean;
  local?: boolean;
}

// Providers termcoder can resolve today; models.dev has many more we skip.
const SUPPORTED = new Set(["anthropic", "openai", "google"]);

/** Always-available curated set so the browser works offline. */
const FALLBACK: ModelEntry[] = [
  { id: "termcoder/auto", provider: "termcoder", model: "auto", name: "termcoder Auto — best available (recommended)", vision: true, free: true },
  { id: "termexplorer/auto", provider: "termexplorer", model: "auto", name: "termexplorer — study & schoolwork tutor", vision: true, free: true },
  { id: "termcoderfree/auto", provider: "termcoderfree", model: "auto", name: "termcoderfree — free, no API key needed", contextK: 128, free: true },
  { id: "anthropic/claude-opus-4-8", provider: "anthropic", model: "claude-opus-4-8", name: "Claude Opus 4.8", contextK: 200, vision: true },
  { id: "anthropic/claude-sonnet-4-6", provider: "anthropic", model: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", contextK: 200, vision: true },
  { id: "anthropic/claude-haiku-4-5", provider: "anthropic", model: "claude-haiku-4-5", name: "Claude Haiku 4.5", contextK: 200, vision: true },
  { id: "openai/gpt-4o", provider: "openai", model: "gpt-4o", name: "GPT-4o", contextK: 128, vision: true },
  { id: "openai/gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", name: "GPT-4o mini", contextK: 128, vision: true },
  { id: "openai/o3-mini", provider: "openai", model: "o3-mini", name: "o3-mini", contextK: 200 },
  { id: "google/gemini-2.5-flash", provider: "google", model: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextK: 1000, vision: true },
  { id: "google/gemini-2.5-pro", provider: "google", model: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextK: 1000, vision: true },
  { id: "google/gemini-2.0-flash", provider: "google", model: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextK: 1000, vision: true },
  { id: "ollama/llama3.1", provider: "ollama", model: "llama3.1", name: "Llama 3.1 (local)", contextK: 128, free: true, local: true },
  { id: "ollama/qwen2.5-coder", provider: "ollama", model: "qwen2.5-coder", name: "Qwen2.5 Coder (local)", contextK: 128, free: true, local: true },
  { id: "ollama/mistral-nemo", provider: "ollama", model: "mistral-nemo", name: "Mistral Nemo (local)", contextK: 128, free: true, local: true },
  { id: "ollama/deepseek-coder-v2", provider: "ollama", model: "deepseek-coder-v2", name: "DeepSeek Coder v2 (local)", contextK: 128, free: true, local: true },
];

function configDir(env: NodeJS.ProcessEnv): string {
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "termcoder");
}

async function fetchJson(url: string, ms: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function transformModelsDev(data: unknown): ModelEntry[] {
  if (!data || typeof data !== "object") return [];
  const out: ModelEntry[] = [];
  for (const [provider, pv] of Object.entries(data as Record<string, any>)) {
    if (!SUPPORTED.has(provider)) continue;
    const models = pv?.models;
    if (!models || typeof models !== "object") continue;
    for (const [mid, m] of Object.entries(models as Record<string, any>)) {
      const input = m?.modalities?.input;
      out.push({
        id: `${provider}/${mid}`,
        provider,
        model: mid,
        name: typeof m?.name === "string" ? m.name : mid,
        contextK: typeof m?.limit?.context === "number" ? Math.round(m.limit.context / 1000) : undefined,
        vision: Array.isArray(input) ? input.includes("image") : Boolean(m?.attachment),
      });
    }
  }
  return out;
}

async function loadModelsDev(env: NodeJS.ProcessEnv): Promise<ModelEntry[]> {
  const cacheFile = join(configDir(env), "models-cache.json");
  try {
    if (existsSync(cacheFile)) {
      const cached = JSON.parse(readFileSync(cacheFile, "utf8")) as { t?: number; models?: ModelEntry[] };
      if (Date.now() - (cached.t ?? 0) < 24 * 3600 * 1000 && Array.isArray(cached.models)) return cached.models;
    }
  } catch {
    /* ignore a corrupt cache */
  }
  const models = transformModelsDev(await fetchJson("https://models.dev/api.json", 6000));
  if (models.length) {
    try {
      mkdirSync(configDir(env), { recursive: true });
      writeFileSync(cacheFile, JSON.stringify({ t: Date.now(), models }), "utf8");
    } catch {
      /* cache write is best-effort */
    }
  }
  return models;
}

async function loadOllama(baseURL: string): Promise<ModelEntry[]> {
  const root = baseURL.replace(/\/v1\/?$/, "").replace(/\/$/, "");
  const data = (await fetchJson(`${root}/api/tags`, 1500)) as { models?: Array<{ name?: string }> } | null;
  if (!data?.models || !Array.isArray(data.models)) return [];
  return data.models
    .map((m) => String(m?.name ?? "").replace(/:latest$/, ""))
    .filter(Boolean)
    .map((tag) => ({
      id: `ollama/${tag}`,
      provider: "ollama",
      model: tag,
      name: `${tag} (local)`,
      free: true,
      local: true,
    }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The merged model catalog: curated fallback ∪ Models.dev (cached, filtered to
 * supported providers) ∪ the user's locally-installed Ollama models. Later
 * sources refine earlier ones by id.
 */
export async function getModelCatalog(opts: {
  config: Config;
  env?: NodeJS.ProcessEnv;
}): Promise<ModelEntry[]> {
  const env = opts.env ?? process.env;
  const byId = new Map<string, ModelEntry>();
  for (const e of FALLBACK) byId.set(e.id, e);
  for (const e of await loadModelsDev(env)) byId.set(e.id, { ...byId.get(e.id), ...e });
  const ollamaBase = opts.config.providers.ollama?.baseURL ?? "http://localhost:11434/v1";
  for (const e of await loadOllama(ollamaBase)) byId.set(e.id, e);
  return [...byId.values()];
}
