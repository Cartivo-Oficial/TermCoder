import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("honours an explicit stored choice over the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("falls back to the system preference when nothing is stored", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("treats a corrupt stored value as unset rather than throwing", () => {
    expect(resolveTheme("aubergine", true)).toBe("dark");
    expect(resolveTheme("", false)).toBe("light");
  });
});
