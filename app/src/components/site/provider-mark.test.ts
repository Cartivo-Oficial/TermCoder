import { describe, expect, it } from "vitest";
import { PROVIDER_MARKS } from "./provider-marks";

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
});
