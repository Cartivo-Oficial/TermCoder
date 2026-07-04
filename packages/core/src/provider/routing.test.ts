import { describe, expect, it } from "vitest";
import { ConfigSchema } from "../config/config";
import { classifyTaskComplexity, pickAutoModel, resolveModel } from "./provider";

describe("classifyTaskComplexity", () => {
  it("flags architecture / debugging / performance work as complex", () => {
    expect(classifyTaskComplexity("Refactor the auth module")).toBe("complex");
    expect(classifyTaskComplexity("debug this race condition")).toBe("complex");
    expect(classifyTaskComplexity("optimize the render performance")).toBe("complex");
    expect(classifyTaskComplexity("redesign the plugin architecture")).toBe("complex");
  });

  it("flags cross-cutting or very long asks as complex", () => {
    expect(classifyTaskComplexity("rename this across the entire codebase")).toBe("complex");
    expect(classifyTaskComplexity("x ".repeat(400))).toBe("complex");
  });

  it("treats small local edits as simple", () => {
    expect(classifyTaskComplexity("fix the typo in the README")).toBe("simple");
    expect(classifyTaskComplexity("rename this variable to userId")).toBe("simple");
    expect(classifyTaskComplexity("add a comment here")).toBe("simple");
  });
});

describe("pickAutoModel tiering", () => {
  const google = ConfigSchema.parse({});
  const env = { GEMINI_API_KEY: "x" };

  it("uses a fast model for simple tasks and a strong one for complex", () => {
    expect(pickAutoModel(google, env, "simple")).toBe("google/gemini-2.5-flash");
    expect(pickAutoModel(google, env, "complex")).toBe("google/gemini-2.5-pro");
  });

  it("falls back to the free keyless model when no key is set", () => {
    expect(pickAutoModel(google, {}, "complex")).toBe("termcoderfree/auto");
    expect(pickAutoModel(google, {}, "simple")).toBe("termcoderfree/auto");
  });

  it("prefers a locally-configured Ollama over the keyless service", () => {
    const cfg = ConfigSchema.parse({ providers: { ollama: { baseURL: "http://localhost:11434/v1" } } });
    expect(pickAutoModel(cfg, {}, "simple")).toBe("ollama/llama3.1");
  });

  it("honours an explicit route as [fast, strong]", () => {
    const cfg = ConfigSchema.parse({ termcoder: { route: ["ollama/llama3.1", "anthropic/claude-sonnet-4-6"] } });
    expect(pickAutoModel(cfg, {}, "simple")).toBe("ollama/llama3.1");
    expect(pickAutoModel(cfg, {}, "complex")).toBe("anthropic/claude-sonnet-4-6");
  });

  it("resolves the free keyless model (and auto → free) without any key", () => {
    const cfg = ConfigSchema.parse({});
    expect(() => resolveModel("pollinations/openai", { config: cfg, env: {} })).not.toThrow();
    expect(() => resolveModel("termcoderfree/auto", { config: cfg, env: {} })).not.toThrow();
    expect(() => resolveModel("termcoder/auto", { config: cfg, env: {} })).not.toThrow();
    expect(() => resolveModel("termexplorer/auto", { config: cfg, env: {} })).not.toThrow();
  });
});
