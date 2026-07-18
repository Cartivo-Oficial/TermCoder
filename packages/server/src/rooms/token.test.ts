import { describe, it, expect } from "vitest";
import { mintRoomToken, roomTokenPattern } from "./token";

describe("room token", () => {
  it("mints a url-safe token with no padding", () => {
    const t = mintRoomToken();
    expect(t).toMatch(roomTokenPattern);
    expect(t).not.toContain("=");
    expect(t).not.toContain("+");
    expect(t).not.toContain("/");
    expect(t.length).toBeGreaterThanOrEqual(22);
  });

  it("mints a different token each call", () => {
    const seen = new Set(Array.from({ length: 50 }, () => mintRoomToken()));
    expect(seen.size).toBe(50);
  });

  it("the pattern rejects a session-id-shaped uuid and empty input", () => {
    expect(roomTokenPattern.test("6c23f822-b569-42ea-a20d-0a65e4cf3412")).toBe(false);
    expect(roomTokenPattern.test("")).toBe(false);
  });
});
