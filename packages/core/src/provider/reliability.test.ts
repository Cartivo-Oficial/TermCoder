import { describe, expect, it } from "vitest";
import { ConfigSchema } from "../config/config";
import { firstKeyedModel, nextModelOnError, streamWithIdleTimeout } from "./reliability";

describe("firstKeyedModel", () => {
  it("prefers Google, then Anthropic, then OpenAI, else undefined", () => {
    const empty = ConfigSchema.parse({});
    expect(firstKeyedModel(empty, {})).toBeUndefined();
    expect(firstKeyedModel(empty, { GEMINI_API_KEY: "x" })).toBe("google/gemini-2.5-flash");
    const anth = ConfigSchema.parse({ providers: { anthropic: { apiKey: "a" } } });
    expect(firstKeyedModel(anth, {})).toBe("anthropic/claude-haiku-4-5-20251001");
    const oai = ConfigSchema.parse({ providers: { openai: { apiKey: "o" } } });
    expect(firstKeyedModel(oai, {})).toBe("openai/gpt-4o-mini");
  });
});

describe("nextModelOnError", () => {
  it("retries the same model while retries remain", () => {
    expect(nextModelOnError({ model: "a", retriesLeft: 1 })).toEqual({ model: "a", retriesLeft: 0 });
  });
  it("falls back once retries are exhausted", () => {
    expect(nextModelOnError({ model: "a", retriesLeft: 0, fallback: "b" })).toEqual({ model: "b", retriesLeft: 0 });
  });
  it("gives up when no retries and no distinct fallback", () => {
    expect(nextModelOnError({ model: "a", retriesLeft: 0 })).toBeNull();
    expect(nextModelOnError({ model: "a", retriesLeft: 0, fallback: "a" })).toBeNull();
  });
});

describe("streamWithIdleTimeout", () => {
  it("passes chunks through when the stream stays alive", async () => {
    async function* alive() {
      yield { type: "text-delta", text: "a" };
      yield { type: "text-delta", text: "b" };
    }
    const seen: string[] = [];
    for await (const c of streamWithIdleTimeout(alive(), 200)) seen.push(c.type);
    expect(seen).toEqual(["text-delta", "text-delta"]);
  });
  it("yields an error chunk and stops when the stream goes silent", async () => {
    let timedOut = false;
    async function* silent() {
      yield { type: "text-delta", text: "a" };
      await new Promise(() => {});
    }
    const seen: Array<{ type: string }> = [];
    for await (const c of streamWithIdleTimeout(silent(), 30, () => { timedOut = true; })) seen.push(c);
    expect(seen.map((c) => c.type)).toEqual(["text-delta", "error"]);
    expect(timedOut).toBe(true);
  }, 1000);
});
