/**
 * Provider connection methods — the model behind the "Connect <provider>" UI.
 *
 * A provider can be connected several ways: with an API key (works today), or
 * by logging in with an existing subscription over OAuth (ChatGPT Pro/Plus,
 * Claude Pro/Max) — the browser and headless flows. The OAuth methods are
 * declared here but marked unavailable for now; wiring the actual flows later
 * only flips `available` and adds a handler, without touching the UI.
 */

export type AuthMethodId = "api-key" | "oauth-browser" | "oauth-headless";

export interface AuthMethod {
  id: AuthMethodId;
  label: string;
  /** True when this method can be used now. OAuth flows land later. */
  available: boolean;
  /** Short helper text shown under the method. */
  hint?: string;
}

export interface ProviderAuth {
  provider: string;
  label: string;
  methods: AuthMethod[];
}

const SOON = "Log in with your subscription — coming soon.";

const API_KEY: AuthMethod = {
  id: "api-key",
  label: "API key",
  available: true,
  hint: "Paste a provider API key. Works everywhere.",
};

/** The providers a user can connect, in display order. */
export const CONNECTABLE_PROVIDERS: ProviderAuth[] = [
  {
    provider: "anthropic",
    label: "Anthropic (Claude)",
    methods: [
      { id: "oauth-browser", label: "Claude Pro/Max (browser)", available: false, hint: SOON },
      { id: "oauth-headless", label: "Claude Pro/Max (headless)", available: false, hint: SOON },
      API_KEY,
    ],
  },
  {
    provider: "openai",
    label: "OpenAI (ChatGPT)",
    methods: [
      { id: "oauth-browser", label: "ChatGPT Pro/Plus (browser)", available: false, hint: SOON },
      { id: "oauth-headless", label: "ChatGPT Pro/Plus (headless)", available: false, hint: SOON },
      API_KEY,
    ],
  },
  {
    provider: "google",
    label: "Google (Gemini)",
    methods: [{ ...API_KEY, hint: "Free tier available. Paste a Gemini API key." }],
  },
];

/** The connection methods offered for a provider (empty if it isn't connectable). */
export function providerAuthMethods(provider: string): AuthMethod[] {
  return CONNECTABLE_PROVIDERS.find((p) => p.provider === provider)?.methods ?? [];
}
