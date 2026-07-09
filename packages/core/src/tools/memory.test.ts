import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { memoryTool } from "./memory";

let dir: string;
let cfg: string;
let prevXdg: string | undefined;
const ctx = () => ({ cwd: dir }) as never;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-memtool-"));
  cfg = mkdtempSync(join(tmpdir(), "tc-memtoolcfg-"));
  prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = cfg;
});
afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  rmSync(dir, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
});

describe("memoryTool", () => {
  it("saves, lists, reads, and deletes a memory", async () => {
    const saved = await memoryTool.run({ command: "save", scope: "project", name: "arch", description: "monorepo", type: "project", body: "four packages" }, ctx());
    expect(saved.output).toMatch(/saved/i);

    const list = await memoryTool.run({ command: "list" }, ctx());
    expect(list.output).toContain("- arch: monorepo");

    const read = await memoryTool.run({ command: "read", name: "arch" }, ctx());
    expect(read.output).toContain("four packages");

    const del = await memoryTool.run({ command: "delete", name: "arch" }, ctx());
    expect(del.output).toMatch(/deleted/i);
    const after = await memoryTool.run({ command: "list" }, ctx());
    expect(after.output).not.toContain("arch");
  });

  it("reports a missing memory on read", async () => {
    const read = await memoryTool.run({ command: "read", name: "nope" }, ctx());
    expect(read.output).toMatch(/no memory/i);
  });
});
