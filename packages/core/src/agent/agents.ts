import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentConfig, Config, PermissionRule } from "../config/config";
import { resolvePermissionMode } from "../permission/permission";
import type { TermTool } from "../tools/types";
import { parseFrontmatter } from "../util/frontmatter";

export type AgentMode = "primary" | "subagent" | "all";
type PermMap = Partial<Record<"bash" | "write" | "edit" | "mcp" | "network", PermissionRule>>;

export interface AgentDef {
  name: string;
  description?: string;
  mode: AgentMode;
  model?: string;
  prompt?: string;
  temperature?: number;
  steps?: number;
  permission?: PermMap;
  tools?: string[];
  color?: string;
  builtin?: boolean;
}

const READONLY: PermMap = { write: "deny", edit: "deny", bash: "deny", mcp: "deny", network: "deny" };

export const BUILTIN_AGENTS: AgentDef[] = [
  { name: "build", description: "Full access — edits files and runs commands.", mode: "primary", builtin: true },
  { name: "plan", description: "Read-only — investigates and proposes a plan.", mode: "primary", permission: { ...READONLY }, builtin: true },
  { name: "general", description: "Full-access sub-agent for multi-step work.", mode: "subagent", builtin: true },
  { name: "explore", description: "Read-only sub-agent for navigating the codebase.", mode: "subagent", tools: ["read", "ls", "glob", "grep", "symbols", "repomap"], builtin: true },
  { name: "scout", description: "Read-only sub-agent for docs/dependency research.", mode: "subagent", tools: ["read", "ls", "glob", "grep", "symbols", "repomap", "webfetch", "websearch"], builtin: true },
  {
    name: "reviewer",
    description: "Read-only sub-agent that critiques code and diffs.",
    mode: "subagent",
    tools: ["read", "ls", "glob", "grep", "symbols", "repomap"],
    prompt:
      "You are a meticulous senior code reviewer. Inspect the relevant code (and the `git diff` when reviewing changes) and report concrete problems grouped by severity — Blocking, Should-fix, Nit — each with file:line and a suggested fix. Cover correctness, edge cases, security, and fit with the existing patterns. Do not modify files. Don't invent nitpicks; if it's solid, say so plainly.",
    builtin: true,
  },
  {
    name: "architect",
    description: "Read-only sub-agent that designs an approach and plan.",
    mode: "subagent",
    tools: ["read", "ls", "glob", "grep", "symbols", "repomap", "webfetch", "websearch"],
    prompt:
      "You are a software architect. Investigate the codebase, then produce a concrete design: the approach, the specific files/modules to change, the data flow, trade-offs, and risks. Do not modify files — propose the plan for a build agent to implement.",
    builtin: true,
  },
  {
    name: "tester",
    description: "Sub-agent that writes and runs focused tests.",
    mode: "subagent",
    prompt:
      "You specialize in tests. Study the target code and the project's existing test style, then add focused, independent unit tests covering the happy path, edge cases, and error branches. Run the suite to confirm they pass; fix real bugs you find rather than asserting wrong behavior.",
    builtin: true,
  },
  {
    name: "debugger",
    description: "Sub-agent that reproduces, root-causes and fixes bugs.",
    mode: "subagent",
    prompt:
      "You specialize in debugging. Reproduce the failure, form a hypothesis about the root cause, verify it by reading code and running commands, then apply the minimal fix and confirm the failure is gone. Explain the root cause concisely.",
    builtin: true,
  },
];

function normalizeTools(tools: AgentConfig["tools"] | unknown): string[] | undefined {
  if (Array.isArray(tools)) return tools.map(String);
  if (tools && typeof tools === "object") {
    return Object.entries(tools as Record<string, unknown>)
      .filter(([, v]) => v !== false)
      .map(([k]) => k);
  }
  return undefined;
}

function asMode(v: unknown): AgentMode {
  return v === "primary" || v === "subagent" || v === "all" ? v : "all";
}

function fromConfig(name: string, c: AgentConfig): AgentDef {
  return {
    name,
    description: c.description,
    mode: asMode(c.mode),
    model: c.model,
    prompt: c.prompt,
    temperature: c.temperature,
    steps: c.steps,
    permission: c.permission,
    tools: normalizeTools(c.tools),
    color: c.color,
  };
}

function fromMarkdown(name: string, text: string): AgentDef {
  const { data, body } = parseFrontmatter(text);
  return {
    name,
    description: typeof data.description === "string" ? data.description : undefined,
    mode: asMode(data.mode),
    model: typeof data.model === "string" ? data.model : undefined,
    prompt: body || (typeof data.prompt === "string" ? data.prompt : undefined),
    temperature: typeof data.temperature === "number" ? data.temperature : undefined,
    steps: typeof data.steps === "number" ? data.steps : undefined,
    permission:
      data.permission && typeof data.permission === "object"
        ? (data.permission as PermMap)
        : undefined,
    tools: normalizeTools(data.tools),
    color: typeof data.color === "string" ? data.color : undefined,
  };
}

function readAgentDir(dir: string): AgentDef[] {
  if (!existsSync(dir)) return [];
  const out: AgentDef[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    try {
      out.push(fromMarkdown(f.replace(/\.md$/, ""), readFileSync(join(dir, f), "utf8")));
    } catch {
    }
  }
  return out;
}

export interface DiscoverAgentsOptions {
  config: Config;
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

export function discoverAgents(opts: DiscoverAgentsOptions): AgentDef[] {
  const env = opts.env ?? process.env;
  const globalDir = join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "termcoder", "agents");
  const projectDir = join(opts.cwd, ".termcoder", "agents");

  const byName = new Map<string, AgentDef>();
  for (const a of BUILTIN_AGENTS) byName.set(a.name, { ...a });
  for (const [name, c] of Object.entries(opts.config.agent ?? {})) byName.set(name, fromConfig(name, c));
  for (const a of readAgentDir(globalDir)) byName.set(a.name, a);
  for (const a of readAgentDir(projectDir)) byName.set(a.name, a);
  return [...byName.values()];
}

export function resolveAgent(opts: DiscoverAgentsOptions, name: string | undefined): AgentDef {
  const all = discoverAgents(opts);
  return all.find((a) => a.name === name) ?? all.find((a) => a.name === "build")!;
}

export function agentCanMutate(agent: AgentDef): boolean {
  const allow = agent.tools ? new Set(agent.tools) : null;
  return ["write", "edit", "bash"].some(
    (n) => (!allow || allow.has(n)) && agent.permission?.[n as "write"] !== "deny",
  );
}

export function agentToolFilter(agent: AgentDef, config?: Config): (t: TermTool) => boolean {
  const allow = agent.tools ? new Set(agent.tools) : null;
  const mutates = agentCanMutate(agent);
  return (t: TermTool) => {
    if (allow && !allow.has(t.name)) return false;
    if (t.permissionKind) {
      const rule = agent.permission?.[t.permissionKind] ?? config?.permission?.[t.permissionKind];
      if (resolvePermissionMode(rule, undefined) === "deny") return false;
    }
    if (t.name === "task" && !mutates) return false;
    return true;
  };
}
