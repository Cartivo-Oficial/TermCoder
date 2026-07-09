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
    saveMemory({ scope: "user", name: "arch", description: "user arch", type: "project", body: "user body", cwd: dir, env });

    const mems = discoverMemories({ cwd: dir, env });
    const byName = Object.fromEntries(mems.map((m) => [m.name, m]));
    expect(byName["uses-pnpm"]!.scope).toBe("user");           // slugified
    expect(byName["uses-pnpm"]!.description).toBe("prefers pnpm");
    expect(byName["arch"]!.scope).toBe("project");             // project overrode user
    expect(byName["arch"]!.body).toBe("four packages");
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
    expect(looksLikeSecret("risk-mitigation-strategy-for-the-project")).toBe(false);
    expect(looksLikeSecret("sk-ant-abc123def456ghi789")).toBe(true);
    expect(looksLikeSecret("AKIAIOSFODNN7EXAMPLE")).toBe(true);
    expect(looksLikeSecret("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc")).toBe(true);
    expect(looksLikeSecret("postgres://user:hunter2@db.example.com/app")).toBe(true);
    expect(looksLikeSecret("api_key = sk_live_supersecretvalue")).toBe(true);
    expect(looksLikeSecret("password: hunter2longvalue")).toBe(true);
    expect(looksLikeSecret("the baseline is commit a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0")).toBe(false);
    expect(looksLikeSecret("remember to run the tests before merging")).toBe(false);
  });

  it("stores a description shaped like YAML as a plain string (round-trips)", () => {
    const d = mkdtempSync(join(tmpdir(), "tc-mem-desc-"));
    const c = mkdtempSync(join(tmpdir(), "tc-cfg-desc-"));
    try {
      saveMemory({ scope: "project", name: "yaml-desc", description: "[a, b] and true", type: "project", body: "x", cwd: d, env: { XDG_CONFIG_HOME: c } });
      const got = discoverMemories({ cwd: d, env: { XDG_CONFIG_HOME: c } }).find((m) => m.name === "yaml-desc");
      expect(got?.description).toBe("[a, b] and true");
    } finally {
      rmSync(d, { recursive: true, force: true });
      rmSync(c, { recursive: true, force: true });
    }
  });
});
