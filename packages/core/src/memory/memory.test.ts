import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  discoverMemories,
  saveMemory,
  deleteMemory,
  memoryIndex,
  recallMemories,
  slugifyMemoryName,
  looksLikeSecret,
} from "./memory";

let dir: string;
let cfg: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-mem-"));
  cfg = mkdtempSync(join(tmpdir(), "tc-cfg-"));
  env = { XDG_CONFIG_HOME: cfg };
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
});

describe("saveMemory + discoverMemories", () => {
  it("round-trips a project memory and a user memory; project overrides user by name", () => {
    saveMemory({ scope: "user", name: "Uses PNPM", description: "prefers pnpm", type: "preference", body: "always pnpm", cwd: dir, env });
    saveMemory({ scope: "project", name: "arch", description: "monorepo", type: "project", body: "four packages", cwd: dir, env });
    // same name in both scopes → project wins
    saveMemory({ scope: "user", name: "arch", description: "user arch", type: "project", body: "user body", cwd: dir, env });

    const mems = discoverMemories({ cwd: dir, env });
    const byName = Object.fromEntries(mems.map((m) => [m.name, m]));
    expect(byName["uses-pnpm"].scope).toBe("user");           // slugified
    expect(byName["uses-pnpm"].description).toBe("prefers pnpm");
    expect(byName["arch"].scope).toBe("project");             // project overrode user
    expect(byName["arch"].body).toBe("four packages");
    expect(existsSync(join(dir, ".termcoder", "memory", "arch.md"))).toBe(true);
    expect(existsSync(join(cfg, "termcoder", "memory", "uses-pnpm.md"))).toBe(true);
  });

  it("refuses to store a secret-shaped body", () => {
    expect(() => saveMemory({ scope: "user", name: "k", description: "d", type: "preference", body: "my key is sk-ant-abc123def456", cwd: dir, env })).toThrow(/secret/i);
  });
});

describe("deleteMemory", () => {
  it("removes a memory and returns whether it existed", () => {
    saveMemory({ scope: "project", name: "gone", description: "d", type: "project", body: "b", cwd: dir, env });
    expect(deleteMemory({ name: "gone", cwd: dir, env })).toBe(true);
    expect(deleteMemory({ name: "gone", cwd: dir, env })).toBe(false);
    expect(discoverMemories({ cwd: dir, env }).length).toBe(0);
  });
});

describe("memoryIndex + recallMemories", () => {
  it("index lists one line per memory; empty when none", () => {
    expect(memoryIndex([])).toBe("");
    saveMemory({ scope: "project", name: "a", description: "first", type: "project", body: "x", cwd: dir, env });
    const idx = memoryIndex(discoverMemories({ cwd: dir, env }));
    expect(idx).toContain("- a: first");
  });

  it("recall includes newest bodies until the budget, rest stay index-only; empty when none", () => {
    expect(recallMemories([], 4000)).toBe("");
    saveMemory({ scope: "project", name: "old", description: "old one", type: "project", body: "OLD_BODY " + "x".repeat(50), cwd: dir, env });
    saveMemory({ scope: "project", name: "new", description: "new one", type: "project", body: "NEW_BODY " + "y".repeat(50), cwd: dir, env });
    const mems = discoverMemories({ cwd: dir, env });
    const tiny = recallMemories(mems, 80); // only room for the index + at most one body
    expect(tiny).toContain("- old: old one");
    expect(tiny).toContain("- new: new one");
    // at least one full body is omitted under the tight budget
    const bodiesShown = (tiny.match(/_BODY/g) ?? []).length;
    expect(bodiesShown).toBeLessThan(2);
  });
});

describe("helpers", () => {
  it("slugifies names", () => {
    expect(slugifyMemoryName("Uses PNPM!")).toBe("uses-pnpm");
    expect(slugifyMemoryName("  A / B  ")).toBe("a-b");
  });
  it("flags secret-shaped text", () => {
    expect(looksLikeSecret("sk-ant-abc123def456ghi")).toBe(true);
    expect(looksLikeSecret("AIzaSyA1234567890abcdef")).toBe(true);
    expect(looksLikeSecret("ghp_abcdef1234567890")).toBe(true);
    expect(looksLikeSecret("just a normal note about pnpm")).toBe(false);
  });
});
