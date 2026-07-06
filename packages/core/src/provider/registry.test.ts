import { describe, expect, it } from "vitest";
import { PROVIDERS, providerInfo } from "./registry";

describe("provider registry", () => {
  it("lists the 12 providers with complete entries", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual([
      "anthropic", "openai", "google", "groq", "openrouter", "mistral",
      "deepseek", "xai", "together", "cerebras", "ollama", "termcoderfree",
    ]);
    for (const p of PROVIDERS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.fastModel).toContain("/");
      if (p.kind === "openai-compat") expect(p.baseURL).toMatch(/^https:\/\//);
      if (p.kind === "native" || p.kind === "openai-compat") {
        expect(p.keyEnv?.length).toBeGreaterThan(0);
        expect(p.keyUrl).toMatch(/^https:\/\//);
      }
    }
  });
  it("looks up one provider", () => {
    expect(providerInfo("groq")?.baseURL).toBe("https://api.groq.com/openai/v1");
    expect(providerInfo("nope")).toBeUndefined();
  });
});
