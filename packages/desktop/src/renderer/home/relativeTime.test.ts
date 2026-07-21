import { describe, expect, it } from "vitest";
import { relativeTime } from "./relativeTime";

const M = 60_000;
const H = 60 * M;
const D = 24 * H;

describe("relativeTime", () => {
  it("labels sub-minute as just now", () => {
    expect(relativeTime(1000 * 30, 1000 * 40)).toBe("agora");
  });
  it("labels minutes and hours", () => {
    expect(relativeTime(0, 5 * M)).toBe("5 min");
    expect(relativeTime(0, 2 * H)).toBe("2 h");
  });
  it("labels yesterday and days", () => {
    expect(relativeTime(0, 1 * D)).toBe("ontem");
    expect(relativeTime(0, 3 * D)).toBe("3 d");
  });
  it("never returns a future label for a future timestamp", () => {
    expect(relativeTime(10 * M, 0)).toBe("agora");
  });
});
