import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, type Config } from "../config/config";
import { loadPlugins, discoverPluginSpecifiers, runHooks } from "./plugin";
import type { SessionEvent } from "../session/session";

const PLUGIN_SOURCE = `
export default {
  name: "demo",
  register(api) {
    api.log("demo loaded");
    api.addTool({
      name: "greet",
      description: "Greet the user",
      inputSchema: { jsonSchema: { type: "object" } },
      readOnly: true,
      run: async () => ({ output: "hi from plugin" }),
    });
  },
};
`;

describe("loadPlugins", () => {
  let dir: string;
  let config: Config;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-plugin-"));
    config = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env: {} });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("loads a plugin from a file path and collects its tools", async () => {
    const file = join(dir, "demo-plugin.mjs");
    writeFileSync(file, PLUGIN_SOURCE);

    const result = await loadPlugins([file], { config, cwd: dir });

    expect(result.plugins).toEqual([{ name: "demo", ok: true, toolCount: 1, commandCount: 0, hookCount: 0 }]);
    expect(result.logs).toContain("demo loaded");

    const greet = result.tools.find((t) => t.name === "greet");
    expect(greet).toBeDefined();
    expect(await greet!.run({}, { cwd: dir })).toEqual({ output: "hi from plugin" });
  });

  it("records a failing plugin without throwing", async () => {
    const result = await loadPlugins([join(dir, "missing.mjs")], { config, cwd: dir });
    expect(result.tools).toHaveLength(0);
    expect(result.plugins[0]?.ok).toBe(false);
    expect(result.plugins[0]?.error).toBeTruthy();
  });
});

describe("loadPlugins expanded", () => {
  let dir: string;
  let emptyDir: string;
  const CONFIG = { plugins: [] } as unknown as Config;
  const PLUGIN_SRC = `export default {
  name: "demo", version: "1.2.0", description: "a demo",
  register(api) {
    api.addTool({ name: "demo_tool", description: "d", inputSchema: { parse: (x) => x }, readOnly: true, run: async () => ({ output: "ok" }) });
    api.addCommand({ name: "demo", description: "run demo", template: "do the demo" });
    api.onEvent((e) => { if (e.type === "done") api.log("done seen"); });
  },
};`;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-plug-"));
    emptyDir = mkdtempSync(join(tmpdir(), "tc-plug-empty-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("collects tools, commands, hooks, and manifest fields", async () => {
    const file = join(dir, "p.mjs");
    writeFileSync(file, PLUGIN_SRC, "utf8");
    const r = await loadPlugins([file], { config: CONFIG, cwd: dir, pluginsDir: emptyDir });
    expect(r.tools.map((t) => t.name)).toEqual(["demo_tool"]);
    expect(r.commands.map((c) => c.name)).toEqual(["demo"]);
    expect(r.hooks).toHaveLength(1);
    expect(r.plugins[0]).toMatchObject({ name: "demo", version: "1.2.0", description: "a demo", ok: true, toolCount: 1, commandCount: 1, hookCount: 1 });
  });

  it("auto-discovers .mjs files and index.mjs subdirs, and dedupes", async () => {
    const pdir = mkdtempSync(join(tmpdir(), "tc-plug-dir-"));
    writeFileSync(join(pdir, "a.mjs"), PLUGIN_SRC, "utf8");
    mkdirSync(join(pdir, "sub"));
    writeFileSync(join(pdir, "sub", "index.mjs"), PLUGIN_SRC, "utf8");
    const specs = discoverPluginSpecifiers(pdir);
    expect(specs).toHaveLength(2);
    const dup = specs[0]!;
    const r = await loadPlugins([dup], { config: CONFIG, cwd: pdir, pluginsDir: pdir });
    expect(r.plugins.filter((p) => p.ok)).toHaveLength(2);
    rmSync(pdir, { recursive: true, force: true });
  });

  it("returns empty specifiers for a missing dir", () => {
    expect(discoverPluginSpecifiers(join(dir, "nope"))).toEqual([]);
  });

  it("records a failed plugin without aborting the rest", async () => {
    const good = join(dir, "good.mjs");
    writeFileSync(good, PLUGIN_SRC, "utf8");
    const bad = join(dir, "bad.mjs");
    writeFileSync(bad, "export default { name: 'bad' };", "utf8");
    const r = await loadPlugins([good, bad], { config: CONFIG, cwd: dir, pluginsDir: emptyDir });
    expect(r.plugins.find((p) => p.ok === false)).toBeTruthy();
    expect(r.tools).toHaveLength(1);
  });
});

describe("runHooks", () => {
  it("calls every hook and swallows a throwing one", () => {
    const seen: string[] = [];
    const hooks = [(e: SessionEvent) => seen.push(e.type), () => { throw new Error("boom"); }, (e: SessionEvent) => seen.push("2:" + e.type)];
    expect(() => runHooks(hooks, { type: "done" })).not.toThrow();
    expect(seen).toEqual(["done", "2:done"]);
  });
});
