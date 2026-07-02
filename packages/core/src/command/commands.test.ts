import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverCommands, expandCommand } from "./commands";

describe("commands", () => {
  let dir: string;
  let cwd: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-cmd-"));
    cwd = join(dir, "proj");
    mkdirSync(join(cwd, ".termcoder", "commands"), { recursive: true });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("discovers project commands with frontmatter", () => {
    writeFileSync(
      join(cwd, ".termcoder", "commands", "review.md"),
      "---\ndescription: Review a file\nagent: plan\n---\nReview $1 carefully.",
    );
    const cmds = discoverCommands({ cwd, env: {} });
    const review = cmds.find((c) => c.name === "review");
    expect(review?.description).toBe("Review a file");
    expect(review?.agent).toBe("plan");
    expect(review?.template).toBe("Review $1 carefully.");
  });

  it("expands $ARGUMENTS, positional args and @file", () => {
    writeFileSync(join(cwd, "note.txt"), "hello world");
    const out = expandCommand("Args: $ARGUMENTS / first: $1 / file: @note.txt", "alpha beta", cwd);
    expect(out).toContain("Args: alpha beta");
    expect(out).toContain("first: alpha");
    expect(out).toContain("hello world");
  });

  it("injects shell output", () => {
    const out = expandCommand("echo says: !`echo hi-there`", "", cwd);
    expect(out).toContain("hi-there");
  });
});
