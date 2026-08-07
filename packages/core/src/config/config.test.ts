import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, saveConfig } from "./config";
import { isVirtualModel, pickAutoModel, KEYLESS_PROVIDERS } from "../provider/provider";

describe("loadConfig", () => {
  let dir: string;
  let configDir: string;
  let cwd: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-config-"));
    configDir = join(dir, "global");
    cwd = join(dir, "project");
    mkdirSync(configDir, { recursive: true });
    mkdirSync(join(cwd, ".termcoder"), { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns schema defaults when nothing is configured", () => {
    const config = loadConfig({ cwd, configDir, env: {} });
    expect(config.model).toBe("termcoder/auto");
    expect(config.theme).toBe("default");
    expect(config.permission.bash).toBe("ask");
  });

  // The product's headline promise: install it, run it, no key. That only holds
  // if the default model is the router, because the router is the only thing
  // that falls through to the keyless provider. A concrete model as the default
  // means a fresh install with no key has nothing to call.
  it("defaults to a model that needs no API key", () => {
    const config = loadConfig({ cwd, configDir, env: {} });
    expect(isVirtualModel(config.model)).toBe(true);
    const routed = pickAutoModel(config, {});
    expect(KEYLESS_PROVIDERS.has(routed.split("/")[0]!)).toBe(true);
  });

  it("layers project over global over defaults", () => {
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ model: "anthropic/global", theme: "dark" }),
    );
    writeFileSync(
      join(cwd, ".termcoder", "config.json"),
      JSON.stringify({ model: "openai/project" }),
    );

    const config = loadConfig({ cwd, configDir, env: {} });
    expect(config.model).toBe("openai/project"); // project wins
    expect(config.theme).toBe("dark"); // inherited from global
  });

  it("lets environment overrides win over files", () => {
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ model: "anthropic/global" }),
    );
    const config = loadConfig({
      cwd,
      configDir,
      env: { TERMCODER_MODEL: "anthropic/env" },
    });
    expect(config.model).toBe("anthropic/env");
  });

  it("deep-merges nested permission objects", () => {
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ permission: { bash: "deny" } }),
    );
    writeFileSync(
      join(cwd, ".termcoder", "config.json"),
      JSON.stringify({ permission: { write: "allow" } }),
    );
    const config = loadConfig({ cwd, configDir, env: {} });
    expect(config.permission.bash).toBe("deny");
    expect(config.permission.write).toBe("allow");
    expect(config.permission.edit).toBe("ask"); // default preserved
  });

  it("throws a clear error on invalid JSON", () => {
    writeFileSync(join(configDir, "config.json"), "{ not json");
    expect(() => loadConfig({ cwd, configDir, env: {} })).toThrow(/Invalid JSON/);
  });

  it("rejects invalid enum values", () => {
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ permission: { bash: "maybe" } }),
    );
    expect(() => loadConfig({ cwd, configDir, env: {} })).toThrow();
  });

  it("saveConfig merges into the global file and persists", () => {
    saveConfig({ providers: { google: { apiKey: "k1" } } }, { configDir, env: {} });
    saveConfig({ permission: { write: "allow" }, model: "google/gemini-2.5-flash" }, { configDir, env: {} });

    const config = loadConfig({ cwd, configDir, env: {} });
    expect(config.providers.google?.apiKey).toBe("k1"); // preserved across writes
    expect(config.permission.write).toBe("allow");
    expect(config.model).toBe("google/gemini-2.5-flash");
  });

  it("saveConfig rejects an invalid value before writing", () => {
    expect(() =>
      saveConfig({ permission: { bash: "maybe" } }, { configDir, env: {} }),
    ).toThrow();
    expect(loadConfig({ cwd, configDir, env: {} }).permission.bash).toBe("ask");
  });
});
