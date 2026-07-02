import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseFrontmatter } from "../util/frontmatter";

/** A reusable slash command defined in a markdown file. */
export interface CommandDef {
  name: string;
  description?: string;
  /** Run the command as this agent. */
  agent?: string;
  /** Override the model for this command. */
  model?: string;
  /** Force the command to run as a delegated sub-task. */
  subtask?: boolean;
  /** The prompt template (markdown body). */
  template: string;
}

function fromMarkdown(name: string, text: string): CommandDef {
  const { data, body } = parseFrontmatter(text);
  return {
    name,
    description: typeof data.description === "string" ? data.description : undefined,
    agent: typeof data.agent === "string" ? data.agent : undefined,
    model: typeof data.model === "string" ? data.model : undefined,
    subtask: data.subtask === true,
    template: body,
  };
}

function readCommandDir(dir: string): CommandDef[] {
  if (!existsSync(dir)) return [];
  const out: CommandDef[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    try {
      out.push(fromMarkdown(f.replace(/\.md$/, ""), readFileSync(join(dir, f), "utf8")));
    } catch {
      /* skip unreadable command files */
    }
  }
  return out;
}

/** Built-in commands, overridable by a user file of the same name. */
const BUILTIN_COMMANDS: CommandDef[] = [
  {
    name: "init",
    description: "Analyze the project and write an AGENTS.md",
    template:
      "Analyze this project by inspecting the files with your tools: its structure, tech stack, " +
      "key scripts (build/test/lint/run), and coding conventions. Then create or update an AGENTS.md " +
      "at the repository root that documents how to work here — setup, the commands to run, conventions " +
      "to follow, and any gotchas — so future sessions follow it. Keep it concise and practical.",
  },
];

export interface DiscoverCommandsOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

/** Built-ins < global `commands/*.md` < project `.termcoder/commands/*.md` (by name). */
export function discoverCommands(opts: DiscoverCommandsOptions): CommandDef[] {
  const env = opts.env ?? process.env;
  const globalDir = join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "termcoder", "commands");
  const projectDir = join(opts.cwd, ".termcoder", "commands");
  const byName = new Map<string, CommandDef>();
  for (const c of BUILTIN_COMMANDS) byName.set(c.name, c);
  for (const c of readCommandDir(globalDir)) byName.set(c.name, c);
  for (const c of readCommandDir(projectDir)) byName.set(c.name, c);
  return [...byName.values()];
}

/**
 * Expand a command template into a final prompt:
 * - `$ARGUMENTS` → all args; `$1`, `$2`… → positional args
 * - `` !`cmd` `` → runs the command in `cwd` and injects its stdout
 * - `@path` → injects the file's contents
 */
export function expandCommand(template: string, argsString: string, cwd: string): string {
  const args = argsString.trim() ? argsString.trim().split(/\s+/) : [];
  let out = template;
  out = out.replace(/\$ARGUMENTS/g, argsString.trim());
  out = out.replace(/\$(\d+)/g, (_m, n: string) => args[Number(n) - 1] ?? "");
  out = out.replace(/!`([^`]+)`/g, (_m, command: string) => {
    try {
      const r = spawnSync(command, {
        cwd,
        shell: true,
        encoding: "utf8",
        timeout: 15_000,
        maxBuffer: 1_000_000,
      });
      return (r.stdout ?? "").trim();
    } catch {
      return "";
    }
  });
  out = out.replace(/@([^\s`]+)/g, (m: string, rel: string) => {
    try {
      const path = join(cwd, rel);
      if (existsSync(path)) {
        return `\n\n${rel}:\n\`\`\`\n${readFileSync(path, "utf8")}\n\`\`\`\n`;
      }
    } catch {
      /* leave the token as-is if it can't be read */
    }
    return m;
  });
  return out;
}
