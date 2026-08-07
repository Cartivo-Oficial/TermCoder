// [name, slug, mono label, one line]. The marks live in provider-marks.ts;
// provider-mark.test.ts fails if a row here has no art, which is how the grid
// stops silently falling back to a monogram again.
export const PROVIDERS: [string, string, string, string][] = [
  ["Anthropic", "anthropic", "sonnet · haiku", "Claude through your own key, on the tier you pay for."],
  ["OpenAI", "openai", "gpt-4o · 4o-mini", "The models most tooling assumes, straight from your account."],
  ["Google", "google", "gemini-2.5 pro · flash", "Pro for the hard turns, Flash for everything else."],
  ["Groq", "groq", "llama · fast", "Open models answered quickly enough to feel local."],
  ["Mistral", "mistral", "large · codestral", "Codestral is built for the completion half of the job."],
  ["DeepSeek", "deepseek", "chat · coder", "A budget-priced reasoning and coding pair, hosted for you."],
  ["xAI", "xai", "grok", "Grok, if that is the key you already hold."],
  ["OpenRouter", "openrouter", "anything", "One key in front of nearly every model on the market."],
  ["Together", "together", "open models", "Open weights, hosted, without you renting a GPU."],
  ["Cerebras", "cerebras", "very fast", "Open models served on custom inference silicon, not GPUs."],
  ["Ollama", "ollama", "local · private", "Whatever you have pulled. Nothing leaves the machine."],
  ["termcoderfree", "termcoderfree", "free · no key", "Pick termcoder/auto and you are on it. No card, no account, no key."],
];
