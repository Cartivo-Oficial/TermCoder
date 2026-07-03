import { describe, expect, it } from "vitest";
import { CONNECTABLE_PROVIDERS, providerAuthMethods } from "./auth";

describe("provider auth methods", () => {
  it("offers an available API-key method for every connectable provider", () => {
    for (const p of CONNECTABLE_PROVIDERS) {
      expect(p.methods.find((m) => m.id === "api-key")?.available).toBe(true);
    }
  });

  it("lists ChatGPT/Claude subscription logins as not-yet-available", () => {
    const oauth = providerAuthMethods("openai").filter((m) => m.id.startsWith("oauth"));
    expect(oauth.length).toBe(2);
    expect(oauth.every((m) => !m.available)).toBe(true);
    expect(providerAuthMethods("anthropic").some((m) => m.label.includes("Claude Pro/Max"))).toBe(true);
  });

  it("returns nothing for an unknown provider", () => {
    expect(providerAuthMethods("nope")).toEqual([]);
  });
});
