import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectContext } from "./context";

describe("loadProjectContext", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-ctx-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns undefined when no context file exists", () => {
    expect(loadProjectContext(dir)).toBeUndefined();
  });

  it("reads AGENTS.md", () => {
    writeFileSync(join(dir, "AGENTS.md"), "Use tabs, not spaces.");
    expect(loadProjectContext(dir)).toBe("Use tabs, not spaces.");
  });

  it("falls back to CLAUDE.md", () => {
    writeFileSync(join(dir, "CLAUDE.md"), "Run tests with pnpm test.");
    expect(loadProjectContext(dir)).toBe("Run tests with pnpm test.");
  });
});
