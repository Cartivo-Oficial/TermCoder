import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recipeTool } from "./recipe";

let dir: string;
let cfg: string;
let prevXdg: string | undefined;
const ctx = () => ({ cwd: dir }) as never;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-recipetool-"));
  cfg = mkdtempSync(join(tmpdir(), "tc-recipetoolcfg-"));
  prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = cfg;
});
afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  rmSync(dir, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
});

describe("recipeTool", () => {
  it("saves, lists, reads, runs, and deletes a recipe", async () => {
    const saved = await recipeTool.run(
      { command: "save", scope: "project", name: "open pr", description: "branch and PR", audience: "dev", steps: ["make a branch", "push", "open a PR"] },
      ctx(),
    );
    expect(saved.output).toMatch(/saved/i);
    expect(saved.output).toContain("3 steps");

    const list = await recipeTool.run({ command: "list" }, ctx());
    expect(list.output).toContain("open-pr");

    const read = await recipeTool.run({ command: "read", name: "open-pr" }, ctx());
    expect(read.output).toContain("1. make a branch");

    const run = await recipeTool.run({ command: "run", name: "open-pr" }, ctx());
    expect(run.output).toContain("Run the \"open-pr\" recipe");

    const del = await recipeTool.run({ command: "delete", name: "open-pr" }, ctx());
    expect(del.output).toMatch(/deleted/i);
    const after = await recipeTool.run({ command: "list" }, ctx());
    expect(after.output).not.toContain("open-pr");
  });

  it("requires steps to save and reports a missing recipe", async () => {
    const bad = await recipeTool.run({ command: "save", name: "noop" }, ctx());
    expect(bad.output).toMatch(/at least one step/i);
    const miss = await recipeTool.run({ command: "read", name: "ghost" }, ctx());
    expect(miss.output).toMatch(/no recipe/i);
  });
});
