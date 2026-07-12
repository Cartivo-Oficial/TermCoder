import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "../config/config";
import { clearProviderHealth, markProvider } from "./health";
import { firstKeyedModel, nextModelOnError, streamWithIdleTimeout, isTransientError, backoffMs, abortableDelay } from "./reliability";

afterEach(() => clearProviderHealth());

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

  it("firstKeyedModel skips a provider marked bad", () => {
    const cfg = ConfigSchema.parse({ providers: { google: { apiKey: "g" }, openai: { apiKey: "o" } } });
    markProvider("google", false, "down");
    expect(firstKeyedModel(cfg, {})).toBe("openai/gpt-4o-mini");
    clearProviderHealth();
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

describe("isTransientError", () => {
  it("flags rate limits, overload, timeouts, and network faults as transient", () => {
    for (const m of [
      "429 Too Many Requests",
      "rate limit exceeded",
      "The model is overloaded",
      "at capacity, try again later",
      "request timed out",
      "503 Service Unavailable",
      "fetch failed",
      "ECONNRESET",
      "socket hang up",
    ]) {
      expect(isTransientError(m)).toBe(true);
    }
  });
  it("does not flag genuine client errors as transient", () => {
    for (const m of [
      "401 invalid api key",
      "400 malformed request",
      "no API key configured for provider \"anthropic\"",
      "model not found",
    ]) {
      expect(isTransientError(m)).toBe(false);
    }
  });
});

describe("backoffMs", () => {
  it("escalates and caps at 6s", () => {
    expect(backoffMs(0)).toBe(700);
    expect(backoffMs(1)).toBe(1400);
    expect(backoffMs(2)).toBe(2800);
    expect(backoffMs(10)).toBe(6000);
    expect(backoffMs(-1)).toBe(700);
  });
});

describe("abortableDelay", () => {
  it("resolves immediately when already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const start = Date.now();
    await abortableDelay(5000, ac.signal);
    expect(Date.now() - start).toBeLessThan(200);
  });
  it("resolves early when aborted mid-wait", async () => {
    const ac = new AbortController();
    const start = Date.now();
    setTimeout(() => ac.abort(), 20);
    await abortableDelay(5000, ac.signal);
    expect(Date.now() - start).toBeLessThan(500);
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
