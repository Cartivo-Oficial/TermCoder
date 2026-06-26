import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolContext } from "./types";
import { readTool } from "./read";
import { lsTool } from "./ls";
import { globTool } from "./glob";
import { grepTool } from "./grep";
import { writeTool } from "./write";
import { editTool } from "./edit";
import { bashTool } from "./bash";

describe("tools", () => {
  let dir: string;
  let ctx: ToolContext;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-tools-"));
    ctx = { cwd: dir };
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;\nconst other = 2;\n");
    writeFileSync(join(dir, "src", "b.ts"), "export const b = 2;\n");
    writeFileSync(join(dir, "readme.md"), "# title\n");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("read returns file content", async () => {
    const res = await readTool.run({ path: "src/a.ts" }, ctx);
    expect(res.output).toContain("export const a = 1;");
  });

  it("read honours offset and limit", async () => {
    const res = await readTool.run({ path: "src/a.ts", offset: 1, limit: 1 }, ctx);
    expect(res.output).toBe("const other = 2;");
  });

  it("ls lists directory entries with trailing slash for dirs", async () => {
    const res = await lsTool.run({}, ctx);
    expect(res.output.split("\n")).toContain("src/");
    expect(res.output.split("\n")).toContain("readme.md");
  });

  it("glob finds files by pattern", async () => {
    const res = await globTool.run({ pattern: "src/**/*.ts" }, ctx);
    const lines = res.output.split("\n").sort();
    expect(lines).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("grep finds matching lines as path:line:text", async () => {
    const res = await grepTool.run({ pattern: "export const" }, ctx);
    expect(res.output).toMatch(/src\/a\.ts:1:export const a = 1;/);
    expect(res.output).toMatch(/src\/b\.ts:1:export const b = 2;/);
  });

  it("grep reports no matches", async () => {
    const res = await grepTool.run({ pattern: "zzz-not-found" }, ctx);
    expect(res.output).toBe("(no matches)");
  });

  it("write creates a file and reports it", async () => {
    const res = await writeTool.run({ path: "src/c.ts", content: "export const c = 3;\n" }, ctx);
    expect(res.output).toMatch(/Created src\/c\.ts/);
    expect(readFileSync(join(dir, "src", "c.ts"), "utf8")).toBe("export const c = 3;\n");
  });

  it("write describe distinguishes create vs overwrite", () => {
    expect(writeTool.describe?.({ path: "new.ts", content: "x" }, ctx).title).toMatch(/Create/);
    expect(writeTool.describe?.({ path: "readme.md", content: "x" }, ctx).title).toMatch(/Overwrite/);
  });

  it("edit replaces a unique string", async () => {
    const res = await editTool.run(
      { path: "src/a.ts", oldString: "export const a = 1;", newString: "export const a = 42;" },
      ctx,
    );
    expect(res.output).toMatch(/1 replacement/);
    expect(readFileSync(join(dir, "src", "a.ts"), "utf8")).toContain("a = 42;");
  });

  it("edit rejects a non-unique string without replaceAll", async () => {
    writeFileSync(join(dir, "dup.ts"), "x\nx\n");
    await expect(
      editTool.run({ path: "dup.ts", oldString: "x", newString: "y" }, ctx),
    ).rejects.toThrow(/not unique/);
  });

  it("edit replaceAll replaces every occurrence", async () => {
    writeFileSync(join(dir, "dup.ts"), "x\nx\n");
    const res = await editTool.run(
      { path: "dup.ts", oldString: "x", newString: "y", replaceAll: true },
      ctx,
    );
    expect(res.output).toMatch(/2 replacement/);
    expect(readFileSync(join(dir, "dup.ts"), "utf8")).toBe("y\ny\n");
  });

  it("bash runs a command and captures output and exit code", async () => {
    const res = await bashTool.run({ command: "node -e \"process.stdout.write('hi')\"" }, ctx);
    expect(res.output).toContain("hi");
    expect(res.output).toContain("[exit code 0]");
    expect(res.meta?.code).toBe(0);
  });

  it("bash reports non-zero exit codes", async () => {
    const res = await bashTool.run({ command: "node -e \"process.exit(3)\"" }, ctx);
    expect(res.meta?.code).toBe(3);
  });

  it("blocks paths that escape the workspace root", async () => {
    await expect(readTool.run({ path: "../outside.txt" }, ctx)).rejects.toThrow(/escapes workspace/);
  });
});
