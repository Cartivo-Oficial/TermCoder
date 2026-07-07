import { PROVIDERS } from "../provider/registry";

export type AuthMethodId = "api-key" | "oauth-browser" | "oauth-headless";

export interface AuthMethod {
  id: AuthMethodId;
  label: string;
  available: boolean;
  hint?: string;
}

export interface ProviderAuth {
  provider: string;
  label: string;
  methods: AuthMethod[];
}

const SOON = "Log in with your subscription — coming soon.";

const OAUTH_SOON: Record<string, AuthMethod[]> = {
  anthropic: [
    {
      id: "oauth-browser",
      label: "Claude Pro/Max login",
      available: true,
      hint: "Experimental — sign in with your subscription. May break if Anthropic changes their flow.",
    },
    { id: "oauth-headless", label: "Claude Pro/Max (headless)", available: false, hint: SOON },
  ],
  openai: [
    { id: "oauth-browser", label: "ChatGPT Pro/Plus (browser)", available: false, hint: SOON },
    { id: "oauth-headless", label: "ChatGPT Pro/Plus (headless)", available: false, hint: SOON },
  ],
};

function apiKeyMethod(keyUrl?: string, freeTier?: string): AuthMethod {
  const parts = ["Paste an API key."];
  if (freeTier) parts.unshift(`${freeTier[0]!.toUpperCase()}${freeTier.slice(1)}.`);
  if (keyUrl) parts.push(`Get one: ${keyUrl}`);
  return { id: "api-key", label: "API key", available: true, hint: parts.join(" ") };
}

export const CONNECTABLE_PROVIDERS: ProviderAuth[] = PROVIDERS.filter(
  (p) => p.kind === "native" || p.kind === "openai-compat",
).map((p) => ({
  provider: p.id,
  label: p.label,
  methods: [...(OAUTH_SOON[p.id] ?? []), apiKeyMethod(p.keyUrl, p.freeTier)],
}));

export function providerAuthMethods(provider: string): AuthMethod[] {
  return CONNECTABLE_PROVIDERS.find((p) => p.provider === provider)?.methods ?? [];
}
