import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, type Config } from "../config/config";
import { builtinTools } from "../tools";
import { agentCanMutate, agentToolFilter, discoverAgents, resolveAgent } from "./agents";

describe("agents", () => {
  let dir: string;
  let cwd: string;
  let config: Config;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-agents-"));
    cwd = join(dir, "proj");
    mkdirSync(join(cwd, ".termcoder", "agents"), { recursive: true });
    config = loadConfig({ cwd, configDir: join(dir, "cfg"), env: {} });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const allowed = (name: string) =>
    builtinTools.filter(agentToolFilter(resolveAgent({ config, cwd, env: {} }, name))).map((t) => t.name).sort();

  it("includes the built-in agents", () => {
    const names = discoverAgents({ config, cwd, env: {} }).map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(["build", "plan", "general", "explore", "scout"]));
  });

  it("build has full tool access; plan is read-only", () => {
    expect(allowed("build")).toContain("write");
    expect(allowed("build")).toContain("bash");
    const plan = allowed("plan");
    expect(plan).not.toContain("write");
    expect(plan).not.toContain("edit");
    expect(plan).not.toContain("bash");
    expect(plan).toContain("read");
  });

  it("explore exposes only read/search tools", () => {
    expect(allowed("explore")).toEqual(["glob", "grep", "ls", "read", "repomap", "symbols"]);
  });

  it("discovers a custom project agent from markdown and enforces read-only", () => {
    writeFileSync(
      join(cwd, ".termcoder", "agents", "reviewer.md"),
      "---\ndescription: Reviews code\npermission:\n  write: deny\n  edit: deny\n  bash: deny\n---\nReview only.",
    );
    const reviewer = resolveAgent({ config, cwd, env: {} }, "reviewer");
    expect(reviewer.description).toBe("Reviews code");
    expect(reviewer.prompt).toBe("Review only.");
    expect(agentCanMutate(reviewer)).toBe(false);
    expect(allowed("reviewer")).not.toContain("write");
    expect(allowed("reviewer")).toContain("read");
  });

  it("parses a glob-scoped permission map from an agent's frontmatter", () => {
    writeFileSync(
      join(cwd, ".termcoder", "agents", "scoped.md"),
      '---\ndescription: Docs only\npermission:\n  edit: { "docs/**": allow, "**": deny }\n---\nEdit docs.',
    );
    const scoped = resolveAgent({ config, cwd, env: {} }, "scoped");
    expect(scoped.permission?.edit).toEqual({ "docs/**": "allow", "**": "deny" });
    expect(agentCanMutate(scoped)).toBe(true);
    expect(allowed("scoped")).toContain("edit");
  });
});
