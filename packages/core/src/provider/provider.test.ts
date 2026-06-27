import { describe, expect, it } from "vitest";
import { loadConfig, type Config } from "../config/config";
import { resolveModel } from "./provider";

function baseConfig(): Config {
  return loadConfig({ cwd: "/", configDir: "/none", env: {} });
}

describe("resolveModel", () => {
  it("requires a provider/model id", () => {
    expect(() => resolveModel("just-a-model", { config: baseConfig(), env: {} })).toThrow(
      /provider\/model/,
    );
  });

  it("resolves ollama locally with no API key", () => {
    const model = resolveModel("ollama/llama3.1", { config: baseConfig(), env: {} });
    expect(model).toBeDefined();
  });

  it("resolves an OpenAI-compatible endpoint from config (e.g. Groq)", () => {
    const config = baseConfig();
    config.providers.openai = { apiKey: "gsk_test", baseURL: "https://api.groq.com/openai/v1" };
    const model = resolveModel("openai/llama-3.3-70b-versatile", { config, env: {} });
    expect(model).toBeDefined();
  });

  it("throws a clear error when a cloud provider has no key", () => {
    expect(() => resolveModel("anthropic/claude-sonnet-4-6", { config: baseConfig(), env: {} })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
    expect(() => resolveModel("google/gemini-2.0-flash", { config: baseConfig(), env: {} })).toThrow(
      /GOOGLE_GENERATIVE_AI_API_KEY/,
    );
  });

  it("reads the key from the environment", () => {
    const model = resolveModel("google/gemini-2.0-flash", {
      config: baseConfig(),
      env: { GEMINI_API_KEY: "free-tier-key" },
    });
    expect(model).toBeDefined();
  });

  it("rejects an unknown provider", () => {
    expect(() => resolveModel("acme/x", { config: baseConfig(), env: {} })).toThrow(
      /Unknown provider/,
    );
  });
});
