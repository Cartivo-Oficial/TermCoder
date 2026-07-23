import { describe, it, expect } from "vitest";
import { formatTokens, formatDuration } from "./format";

describe("formatTokens", () => {
  it("formats", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(500)).toBe("500");
    expect(formatTokens(1200)).toBe("1.2k");
    expect(formatTokens(15400)).toBe("15.4k");
    expect(formatTokens(128000)).toBe("128k");
  });
});

describe("formatDuration", () => {
  it("formats", () => {
    expect(formatDuration(340)).toBe("340ms");
    expect(formatDuration(1200)).toBe("1.2s");
    expect(formatDuration(45000)).toBe("45s");
    expect(formatDuration(125000)).toBe("2m 05s");
  });
});
