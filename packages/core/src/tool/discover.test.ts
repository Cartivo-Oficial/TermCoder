import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverTools } from "./discover";

describe("discoverTools", () => {
  let dir: string;
  let cwd: string;
  let globalCfg: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-tools-"));
    cwd = join(dir, "proj");
    globalCfg = join(dir, "cfg");
    mkdirSync(join(cwd, ".termcoder", "tools"), { recursive: true });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("loads an OpenCode-style tool (args/execute) from a project .mjs file", async () => {
    writeFileSync(
      join(cwd, ".termcoder", "tools", "greet.mjs"),
      'export default { description: "Greet a person", args: { parse: (v) => v }, execute: async (a) => "hi " + a.name };',
    );
    const { tools } = await discoverTools({ cwd, env: { XDG_CONFIG_HOME: globalCfg } });
    const greet = tools.find((t) => t.name === "greet");
    expect(greet?.description).toBe("Greet a person");
    expect(greet?.readOnly).toBe(true);
    expect((await greet!.run({ name: "bob" } as never, { cwd })).output).toBe("hi bob");
  });

  it("records an error for a file with no valid tool export", async () => {
    writeFileSync(join(cwd, ".termcoder", "tools", "bad.mjs"), "export const x = 1;");
    const { tools, errors } = await discoverTools({ cwd, env: { XDG_CONFIG_HOME: globalCfg } });
    expect(tools).toHaveLength(0);
    expect(errors.some((e) => e.file.endsWith("bad.mjs"))).toBe(true);
  });
});
