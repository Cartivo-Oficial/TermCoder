import { describe, expect, it } from "vitest";
import { CONNECTABLE_PROVIDERS, providerAuthMethods } from "./auth";

describe("connectable providers", () => {
  it("covers every key-based registry provider", () => {
    const ids = CONNECTABLE_PROVIDERS.map((p) => p.provider);
    expect(ids).toEqual(["anthropic", "openai", "google", "groq", "openrouter", "mistral", "deepseek", "xai", "together", "cerebras"]);
  });
  it("api-key hints carry the key url", () => {
    const groq = CONNECTABLE_PROVIDERS.find((p) => p.provider === "groq")!;
    const apiKey = groq.methods.find((m) => m.id === "api-key")!;
    expect(apiKey.available).toBe(true);
    expect(apiKey.hint).toContain("console.groq.com");
  });
  it("anthropic has one oauth placeholder left (oauth-headless); oauth-browser is live", () => {
    expect(providerAuthMethods("anthropic").filter((m) => !m.available)).toHaveLength(1);
  });
});
