import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, loadConfig, type Config } from "../config/config";
import { clearProviderHealth, markProvider, providerMarkedBad } from "./health";
import { pickAutoModel, probeProvider, resolveModel } from "./provider";

function baseConfig(): Config {
  return loadConfig({ cwd: "/", configDir: "/none", env: {} });
}

afterEach(() => clearProviderHealth());

describe("pickAutoModel (termcoder/auto router)", () => {
  it("falls back to the free keyless model when no keys are configured", () => {
    expect(pickAutoModel(baseConfig(), {})).toBe("termcoderfree/auto");
  });

  it("prefers Google's free tier when its key is present", () => {
    const config = baseConfig();
    config.providers.google = { apiKey: "g" };
    expect(pickAutoModel(config, {})).toBe("google/gemini-2.5-flash");
  });

  it("honours an explicit route override", () => {
    const config = baseConfig();
    config.termcoder = { route: ["ollama/qwen2.5-coder"] };
    expect(pickAutoModel(config, {})).toBe("ollama/qwen2.5-coder");
  });

  it("resolveModel routes termcoder/auto to a concrete model", () => {
    const config = baseConfig();
    config.providers.google = { apiKey: "g" };
    expect(resolveModel("termcoder/auto", { config, env: {} })).toBeDefined();
  });
});

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
    expect(() => resolveModel("anthropic/claude-sonnet-5", { config: baseConfig(), env: {} })).toThrow(
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

describe("resolveModel anthropic oauth branch", () => {
  it("resolves anthropic via oauth when there is no api key", () => {
    const config = ConfigSchema.parse({ providers: { anthropic: { oauth: { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 9e5 } } } });
    expect(resolveModel("anthropic/claude-haiku-4-5-20251001", { config, env: {} })).toBeTruthy();
  });
});

describe("resolveModel openai oauth branch", () => {
  it("resolves openai via oauth when there is no api key", () => {
    const config = ConfigSchema.parse({ providers: { openai: { oauth: { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 9e5 } } } });
    expect(resolveModel("openai/gpt-5", { config, env: {} })).toBeTruthy();
  });
});

describe("resolveModel openai-compat registry branch", () => {
  it("resolves a registry compat provider with a config key", () => {
    const config = ConfigSchema.parse({ providers: { groq: { apiKey: "gsk_x" } } });
    expect(resolveModel("groq/llama-3.3-70b-versatile", { config, env: {} })).toBeTruthy();
  });
  it("resolves via the registry env var", () => {
    const config = ConfigSchema.parse({});
    expect(resolveModel("mistral/mistral-small-latest", { config, env: { MISTRAL_API_KEY: "x" } })).toBeTruthy();
  });
  it("keeps model ids containing slashes intact", () => {
    const config = ConfigSchema.parse({ providers: { openrouter: { apiKey: "x" } } });
    expect(resolveModel("openrouter/meta-llama/llama-3.3-70b-instruct:free", { config, env: {} })).toBeTruthy();
  });
  it("throws a key error for a compat provider without a key", () => {
    const config = ConfigSchema.parse({});
    expect(() => resolveModel("groq/llama-3.3-70b-versatile", { config, env: {} })).toThrow(/GROQ_API_KEY|key/i);
  });
  it("still rejects unknown providers", () => {
    const config = ConfigSchema.parse({});
    expect(() => resolveModel("wat/nope", { config, env: {} })).toThrow(/unknown provider/i);
  });
});

describe("probeProvider", () => {
  it("marks a provider good on success", async () => {
    const config = ConfigSchema.parse({ providers: { groq: { apiKey: "x" } } });
    const r = await probeProvider("groq", { config, env: {}, probe: async () => "ok" });
    expect(r.ok).toBe(true);
    expect(providerMarkedBad("groq")).toBe(false);
  });
  it("marks a provider bad on failure with the error", async () => {
    const config = ConfigSchema.parse({ providers: { groq: { apiKey: "x" } } });
    const r = await probeProvider("groq", { config, env: {}, probe: async () => { throw new Error("credit balance too low"); } });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/credit/i);
    expect(providerMarkedBad("groq")).toBe(true);
  });
  it("fails fast when the provider has no key", async () => {
    const config = ConfigSchema.parse({});
    const r = await probeProvider("groq", { config, env: {} });
    expect(r.ok).toBe(false);
  });
});

describe("health-aware routing", () => {
  it("pickAutoModel skips a provider marked bad", () => {
    const config = ConfigSchema.parse({ providers: { google: { apiKey: "g" }, anthropic: { apiKey: "a" } } });
    expect(pickAutoModel(config, {})).toBe("google/gemini-2.5-flash");
    markProvider("google", false, "down");
    expect(pickAutoModel(config, {})).toBe("anthropic/claude-haiku-4-5-20251001");
  });
});
