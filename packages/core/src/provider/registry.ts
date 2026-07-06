export interface ProviderInfo {
  id: string;
  label: string;
  kind: "native" | "openai-compat" | "local" | "keyless";
  baseURL?: string;
  keyEnv?: string[];
  keyUrl?: string;
  freeTier?: string;
  fastModel: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "anthropic", label: "Anthropic (Claude)", kind: "native", keyEnv: ["ANTHROPIC_API_KEY"], keyUrl: "https://console.anthropic.com/settings/keys", fastModel: "anthropic/claude-haiku-4-5-20251001" },
  { id: "openai", label: "OpenAI (ChatGPT)", kind: "native", keyEnv: ["OPENAI_API_KEY"], keyUrl: "https://platform.openai.com/api-keys", fastModel: "openai/gpt-4o-mini" },
  { id: "google", label: "Google (Gemini)", kind: "native", keyEnv: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"], keyUrl: "https://aistudio.google.com/apikey", freeTier: "generous free tier", fastModel: "google/gemini-2.5-flash" },
  { id: "groq", label: "Groq", kind: "openai-compat", baseURL: "https://api.groq.com/openai/v1", keyEnv: ["GROQ_API_KEY"], keyUrl: "https://console.groq.com/keys", freeTier: "fast free tier", fastModel: "groq/llama-3.3-70b-versatile" },
  { id: "openrouter", label: "OpenRouter", kind: "openai-compat", baseURL: "https://openrouter.ai/api/v1", keyEnv: ["OPENROUTER_API_KEY"], keyUrl: "https://openrouter.ai/settings/keys", freeTier: "some free models", fastModel: "openrouter/meta-llama/llama-3.3-70b-instruct:free" },
  { id: "mistral", label: "Mistral", kind: "openai-compat", baseURL: "https://api.mistral.ai/v1", keyEnv: ["MISTRAL_API_KEY"], keyUrl: "https://console.mistral.ai/api-keys", freeTier: "free tier", fastModel: "mistral/mistral-small-latest" },
  { id: "deepseek", label: "DeepSeek", kind: "openai-compat", baseURL: "https://api.deepseek.com", keyEnv: ["DEEPSEEK_API_KEY"], keyUrl: "https://platform.deepseek.com/api_keys", fastModel: "deepseek/deepseek-chat" },
  { id: "xai", label: "xAI (Grok)", kind: "openai-compat", baseURL: "https://api.x.ai/v1", keyEnv: ["XAI_API_KEY"], keyUrl: "https://console.x.ai", fastModel: "xai/grok-3-mini" },
  { id: "together", label: "Together AI", kind: "openai-compat", baseURL: "https://api.together.xyz/v1", keyEnv: ["TOGETHER_API_KEY"], keyUrl: "https://api.together.ai/settings/api-keys", freeTier: "trial credits", fastModel: "together/meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  { id: "cerebras", label: "Cerebras", kind: "openai-compat", baseURL: "https://api.cerebras.ai/v1", keyEnv: ["CEREBRAS_API_KEY"], keyUrl: "https://cloud.cerebras.ai", freeTier: "free tier", fastModel: "cerebras/llama-3.3-70b" },
  { id: "ollama", label: "Ollama (local)", kind: "local", freeTier: "free, local, private", fastModel: "ollama/llama3.1" },
  { id: "termcoderfree", label: "termcoderfree (no key)", kind: "keyless", freeTier: "free, no key, built in", fastModel: "termcoderfree/auto" },
];

export function providerInfo(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
