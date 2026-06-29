import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitignoreGlobs } from "./gitignore";

describe("gitignoreGlobs", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-gi-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns an empty list without a .gitignore", () => {
    expect(gitignoreGlobs(dir)).toEqual([]);
  });

  it("converts entries to ignore globs and skips comments/negations", () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\n/dist\n*.log\n# a comment\n!keep.log\n");
    const globs = gitignoreGlobs(dir);
    expect(globs).toContain("**/node_modules");
    expect(globs).toContain("**/node_modules/**");
    expect(globs).toContain("dist");
    expect(globs).toContain("dist/**");
    expect(globs).toContain("**/*.log");
    expect(globs).not.toContain("keep.log");
  });
});
