import { describe, expect, it } from "vitest";
import { PROVIDER_MARKS } from "./provider-marks";
import { PROVIDERS } from "./providers";

const EXPECTED = [
  "anthropic", "openai", "google", "groq", "mistral", "deepseek",
  "xai", "openrouter", "together", "cerebras", "ollama",
];

describe("the vendored provider art", () => {
  it("carries every provider we list", () => {
    expect(Object.keys(PROVIDER_MARKS).sort()).toEqual([...EXPECTED].sort());
  });

  it("gives every path a d", () => {
    const bad = Object.entries(PROVIDER_MARKS)
      .flatMap(([slug, paths]) => paths.map((p, i) => ({ slug, i, d: p.d })))
      .filter((p) => !p.d || p.d.length < 8)
      .map((p) => `${p.slug}[${p.i}]`);
    expect(bad).toEqual([]);
  });

  it("leaves the monochrome brands without a fill, so they inherit colour", () => {
    // These five ship as currentColor in the source set: their owners' marks
    // are monochrome by design. A hex here would be one we invented.
    for (const slug of ["anthropic", "openai", "groq", "xai", "ollama"]) {
      const fills = PROVIDER_MARKS[slug]!.map((p) => p.fill).filter(Boolean);
      expect(fills, slug).toEqual([]);
    }
  });

  it("keeps the real brand colours on the marks that have them", () => {
    expect(PROVIDER_MARKS.google!.map((p) => p.fill)).toEqual([
      "#4285F4", "#34A853", "#FBBC05", "#EB4335",
    ]);
    expect(PROVIDER_MARKS.deepseek![0]!.fill).toBe("#4D6BFE");
    expect(PROVIDER_MARKS.openrouter![0]!.fill).toBe("#C8FF00");
  });

  it("pins cerebras as a mixed mark: a fixed-colour glyph over an inherited-colour ring", () => {
    // cerebras is neither fully monochrome nor fully coloured: its first path
    // is fixed to the brand orange, its second has no fill and so renders
    // through --provider-mark/currentColor alongside the five monochrome
    // brands. That means setting --provider-mark moves cerebras's inner glyph
    // too — faithful to upstream, but easy to rediscover by surprise. Pinned
    // here so it stays a recorded fact instead.
    expect(PROVIDER_MARKS.cerebras).toHaveLength(2);
    expect(PROVIDER_MARKS.cerebras![0]!.fill).toBe("#F15A29");
    expect(PROVIDER_MARKS.cerebras![1]!.fill).toBeUndefined();
  });
});

describe("the provider grid", () => {
  it("has a mark for every provider it lists", () => {
    // termcoderfree is ours, not a third party: the page draws its own Mark.
    const missing = PROVIDERS
      .map(([, slug]) => slug)
      .filter((slug) => slug !== "termcoderfree")
      .filter((slug) => !PROVIDER_MARKS[slug]);
    expect(missing).toEqual([]);
  });
});
