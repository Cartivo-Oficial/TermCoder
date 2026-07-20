import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { workspaceGlob } from "./workspace-glob";

function isInside(root: string, file: string): boolean {
  const rel = relative(root, file);
  return rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\") && !isAbsolute(rel);
}

describe("workspaceGlob", () => {
  let base: string;
  let workspace: string;
  let outside: string;

  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), "tc-wg-"));
    workspace = join(base, "workspace");
    outside = join(base, "outside");
    mkdirSync(join(workspace, "sub"), { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(workspace, "a.ts"), "a");
    writeFileSync(join(workspace, "sub", "b.ts"), "b");
    writeFileSync(join(workspace, ".hidden.ts"), "h");
    writeFileSync(join(outside, "secret.txt"), "s");
    writeFileSync(join(outside, ".env"), "e");
  });

  afterAll(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it("returns the inside files for a normal pattern", () => {
    const matches = workspaceGlob("**/*.ts", workspace, { ignore: [] });
    expect(matches.length).toBe(2);
    for (const m of matches) {
      expect(isInside(workspace, m)).toBe(true);
    }
  });

  it("throws for a pattern that escapes the workspace root", () => {
    expect(() => workspaceGlob("../**/*", workspace, { ignore: [] })).toThrow(
      "Pattern escapes workspace root",
    );
  });

  it("throws for a literal parent-relative file pattern", () => {
    expect(() => workspaceGlob("../outside/secret.txt", workspace, { ignore: [] })).toThrow(
      "Pattern escapes workspace root",
    );
  });

  it("throws for a parent-relative pattern targeting a dotfile", () => {
    expect(() => workspaceGlob("../**/.env", workspace, { ignore: [] })).toThrow(
      "Pattern escapes workspace root",
    );
  });

  it("throws for an absolute pattern", () => {
    expect(() => workspaceGlob(join(outside, "*"), workspace, { ignore: [] })).toThrow(
      "Pattern escapes workspace root",
    );
  });

  it("throws for a pattern with an interior escape", () => {
    expect(() =>
      workspaceGlob("sub/../../outside/*", workspace, { ignore: [] }),
    ).toThrow("Pattern escapes workspace root");
  });

  it("only ever returns paths under the workspace root", () => {
    const patterns = ["**/*.ts", "*.ts", "sub/*.ts", "**/*"];
    for (const pattern of patterns) {
      const matches = workspaceGlob(pattern, workspace, { ignore: [], dot: true });
      for (const m of matches) {
        expect(isInside(workspace, m)).toBe(true);
      }
    }
  });

  it("still returns dotfiles inside the workspace when dot is true", () => {
    const matches = workspaceGlob("**/*", workspace, { ignore: [], dot: true });
    expect(matches.some((m) => m.endsWith(".hidden.ts"))).toBe(true);
  });
});
