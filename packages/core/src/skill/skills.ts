import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseFrontmatter } from "../util/frontmatter";

export interface SkillDef {
  name: string;
  description: string;
  body: string;
  source: "project" | "global";
}

function readSkillDir(dir: string, source: SkillDef["source"]): SkillDef[] {
  if (!existsSync(dir)) return [];
  const out: SkillDef[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    try {
      const { data, body } = parseFrontmatter(readFileSync(join(dir, f), "utf8"));
      const name =
        typeof data.name === "string" && data.name.trim() ? data.name.trim() : f.replace(/\.md$/, "");
      const description = typeof data.description === "string" ? data.description : "";
      out.push({ name, description, body: body.trim(), source });
    } catch {
    }
  }
  return out;
}

export interface DiscoverSkillsOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

export function discoverSkills(opts: DiscoverSkillsOptions): SkillDef[] {
  const env = opts.env ?? process.env;
  const globalDir = join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "termcoder", "skills");
  const projectDir = join(opts.cwd, ".termcoder", "skills");

  const byName = new Map<string, SkillDef>();
  for (const s of readSkillDir(globalDir, "global")) byName.set(s.name, s);
  for (const s of readSkillDir(projectDir, "project")) byName.set(s.name, s);
  return [...byName.values()];
}

export function getSkill(cwd: string, name: string, env?: NodeJS.ProcessEnv): SkillDef | undefined {
  return discoverSkills({ cwd, env }).find((s) => s.name === name);
}

export function skillsMenu(skills: SkillDef[]): string {
  if (skills.length === 0) return "";
  const lines = skills.map((s) => `- ${s.name}: ${s.description || "(no description)"}`);
  return [
    "Available skills — reusable playbooks for specific tasks. When the user's",
    "request matches one, call the `skill` tool with its name to load the full",
    "instructions BEFORE proceeding. Do not guess a skill's contents:",
    ...lines,
  ].join("\n");
}
