import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverSkills, getSkill, skillsMenu } from "./skills";
import { skillTool } from "../tools/skill";

describe("skills", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "tc-skills-"));
    mkdirSync(join(cwd, ".termcoder", "skills"), { recursive: true });
  });
  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  const write = (name: string, text: string) =>
    writeFileSync(join(cwd, ".termcoder", "skills", name), text, "utf8");

  it("discovers a skill with frontmatter and body", () => {
    write("pr-review.md", "---\nname: pr-review\ndescription: Review a pull request\n---\nStep 1. Read the diff.");
    const skills = discoverSkills({ cwd, env: {} });
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "pr-review",
      description: "Review a pull request",
      source: "project",
    });
    expect(skills[0]!.body).toContain("Read the diff");
  });

  it("falls back to the filename when no name is given", () => {
    write("deploy.md", "---\ndescription: Ship it\n---\nRun the deploy script.");
    expect(discoverSkills({ cwd, env: {} })[0]!.name).toBe("deploy");
  });

  it("builds a prompt menu of names + descriptions, empty when none", () => {
    expect(skillsMenu([])).toBe("");
    write("a.md", "---\nname: a\ndescription: does A\n---\nbody");
    const menu = skillsMenu(discoverSkills({ cwd, env: {} }));
    expect(menu).toContain("a: does A");
    expect(menu).toContain("skill");
    expect(menu).not.toContain("body"); // body is NOT in the menu (progressive disclosure)
  });

  it("the skill tool loads a body on demand and reports unknown names", async () => {
    write("fix-flaky.md", "---\nname: fix-flaky\ndescription: x\n---\nRerun the test 10x.");
    const ok = await skillTool.run({ name: "fix-flaky" }, { cwd });
    expect(ok.output).toContain("Rerun the test 10x.");

    const missing = await skillTool.run({ name: "nope" }, { cwd });
    expect(missing.output).toContain("fix-flaky"); // lists available
  });

  it("getSkill returns undefined for a missing skill", () => {
    expect(getSkill(cwd, "ghost", {})).toBeUndefined();
  });
});
