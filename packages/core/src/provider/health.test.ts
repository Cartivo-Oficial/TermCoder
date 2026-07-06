import { afterEach, describe, expect, it } from "vitest";
import { clearProviderHealth, markProvider, providerHealthSnapshot, providerMarkedBad } from "./health";

afterEach(() => clearProviderHealth());

describe("provider health", () => {
  it("marks a provider bad and clears on success", () => {
    expect(providerMarkedBad("anthropic")).toBe(false);
    markProvider("anthropic", false, "no credits");
    expect(providerMarkedBad("anthropic")).toBe(true);
    expect(providerHealthSnapshot().anthropic?.error).toBe("no credits");
    markProvider("anthropic", true);
    expect(providerMarkedBad("anthropic")).toBe(false);
  });
  it("bad marks expire after their ttl", () => {
    markProvider("openai", false, "timeout", 1);
    const wait = Date.now() + 5;
    while (Date.now() < wait) {}
    expect(providerMarkedBad("openai")).toBe(false);
  });
});
