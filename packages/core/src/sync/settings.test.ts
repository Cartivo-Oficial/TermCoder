import { describe, it, expect } from "vitest";
import { extractSettings, mergeSettings, parseSettings, settingsToConfigPatch } from "./settings";

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
    expect(parseSettings({ model: at("x".repeat(200), 1) })).toEqual({});
    expect(parseSettings({ theme: at(42, 1) })).toEqual({});
    expect(parseSettings({ reasoning: at("yes", 1) })).toEqual({});
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

describe("extractSettings", () => {
  it("keeps the prev timestamp when the config value is unchanged", () => {
    const prev = { theme: at("ember", 100) };
    expect(extractSettings({ theme: "ember" }, prev, 999)).toEqual({ theme: at("ember", 100) });
  });

  it("stamps a fresh timestamp when the config value differs from prev", () => {
    const prev = { theme: at("ember", 100) };
    expect(extractSettings({ theme: "paper" }, prev, 999)).toEqual({ theme: at("paper", 999) });
  });

  it("omits a key absent from both config and prev", () => {
    expect(extractSettings({}, {}, 999)).toEqual({});
  });

  it("keeps a prev key unchanged when the config read momentarily lacks it", () => {
    const prev = { theme: at("ember", 100) };
    expect(extractSettings({}, prev, 999)).toEqual({ theme: at("ember", 100) });
  });

  it("stamps a fresh entry for a config key that has no prev", () => {
    expect(extractSettings({ model: "a/b" }, {}, 999)).toEqual({ model: at("a/b", 999) });
  });

  it("ignores config keys outside the whitelist", () => {
    expect(extractSettings({ apiKey: "secret" }, {}, 999)).toEqual({});
  });
});

describe("settingsToConfigPatch", () => {
  it("includes only whitelisted keys with valid values", () => {
    const merged = { theme: at("ember", 1), model: at("a/b", 2), reasoning: at(true, 3) };
    expect(settingsToConfigPatch(merged)).toEqual({ theme: "ember", model: "a/b", reasoning: true });
  });

  it("drops a value that fails its schema", () => {
    const merged = { reasoning: at("yes", 1), model: at("x".repeat(200), 2) };
    expect(settingsToConfigPatch(merged)).toEqual({});
  });

  it("ignores non-whitelisted keys such as connectors", () => {
    const merged = { connectors: at([{ id: "x", inputs: {} }], 1) };
    expect(settingsToConfigPatch(merged)).toEqual({});
  });
});
