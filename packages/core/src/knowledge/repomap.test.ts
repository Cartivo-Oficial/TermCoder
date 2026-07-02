import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectSummary, repoDetail } from "./repomap";

describe("repomap", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-repomap-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function scaffold() {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "demo",
        dependencies: { react: "^18", next: "^14" },
        devDependencies: { typescript: "^5", vitest: "^2" },
        scripts: { build: "tsc", test: "vitest run", dev: "next dev" },
      }),
    );
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "index.ts"), "export function main() {}\nexport const VERSION = 1;\n");
  }

  it("detects the stack, scripts and key dirs in a summary", () => {
    scaffold();
    const summary = projectSummary(dir);
    expect(summary).toContain("TypeScript");
    expect(summary).toContain("React");
    expect(summary).toContain("Next.js");
    expect(summary).toContain("build");
    expect(summary).toContain("test");
    expect(summary).toContain("src/");
    expect(summary).toContain("src/index.ts"); // entry point
  });

  it("keeps script command bodies out of the always-on summary", () => {
    scaffold();
    expect(projectSummary(dir)).not.toContain("next dev"); // commands live in the tool detail
  });

  it("repoDetail includes commands and entry-point exports", () => {
    scaffold();
    const detail = repoDetail(dir);
    expect(detail).toContain("next dev"); // full command
    expect(detail).toContain("main"); // exported symbol
    expect(detail).toContain("VERSION");
  });

  it("returns empty for a directory with no recognizable project", () => {
    expect(projectSummary(dir)).toBe("");
  });
});
