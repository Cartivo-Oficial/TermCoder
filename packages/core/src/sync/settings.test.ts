import { describe, it, expect } from "vitest";
import { mergeSettings, parseSettings } from "./settings";

const at = (value: unknown, updatedAt: number) => ({ value, updatedAt });

describe("mergeSettings", () => {
  it("keeps the newer side per key, not per file", () => {
    const local = { theme: at("ember", 200), model: at("a/b", 50) };
    const remote = { theme: at("paper", 100), model: at("c/d", 300) };
    expect(mergeSettings(local, remote)).toEqual({ theme: at("ember", 200), model: at("c/d", 300) });
  });

  it("keeps a key present on only one side", () => {
    expect(mergeSettings({ a: at(1, 10) }, { b: at(2, 20) })).toEqual({ a: at(1, 10), b: at(2, 20) });
  });

  it("prefers local on an exact tie", () => {
    expect(mergeSettings({ a: at("local", 10) }, { a: at("remote", 10) })).toEqual({ a: at("local", 10) });
  });

  it("is a no-op against an empty remote", () => {
    expect(mergeSettings({ a: at(1, 10) }, {})).toEqual({ a: at(1, 10) });
  });
});

describe("parseSettings", () => {
  it("drops an unknown key rather than writing it to local config", () => {
    expect(parseSettings({ theme: at("ember", 1), evil: at("rm -rf", 2) })).toEqual({ theme: at("ember", 1) });
  });

  it("drops a known key whose value fails its schema", () => {
    expect(parseSettings({ language: at("klingon", 1) })).toEqual({});
    expect(parseSettings({ displayName: at("x".repeat(200), 1) })).toEqual({});
    expect(parseSettings({ theme: at(42, 1) })).toEqual({});
  });

  it("drops an entry with a missing or non-numeric updatedAt", () => {
    expect(parseSettings({ theme: { value: "ember" } })).toEqual({});
    expect(parseSettings({ theme: { value: "ember", updatedAt: "soon" } })).toEqual({});
  });

  it("returns empty for junk rather than throwing", () => {
    expect(parseSettings(null)).toEqual({});
    expect(parseSettings("nonsense")).toEqual({});
    expect(parseSettings([1, 2])).toEqual({});
  });
});
