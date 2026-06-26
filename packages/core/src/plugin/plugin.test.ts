import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, type Config } from "../config/config";
import { loadPlugins } from "./plugin";

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

    expect(result.plugins).toEqual([{ name: "demo", ok: true, toolCount: 1 }]);
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
