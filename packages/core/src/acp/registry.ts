import { delimiter, join } from "node:path";

export interface AgentSpec {
  id: string;
  label: string;
  requires: string;
  command: string;
  args: string[];
}

export const KNOWN_AGENTS: AgentSpec[] = [
  {
    id: "claude",
    label: "Claude Code",
    requires: "claude",
    command: "npx",
    args: ["-y", "@agentclientprotocol/claude-agent-acp"],
  },
  {
    id: "codex",
    label: "Codex",
    requires: "codex",
    command: "npx",
    args: ["-y", "@agentclientprotocol/codex-acp"],
  },
  { id: "opencode", label: "opencode", requires: "opencode", command: "opencode", args: ["acp"] },
  {
    id: "gemini",
    label: "Gemini CLI",
    requires: "gemini",
    command: "gemini",
    args: ["--experimental-acp"],
  },
  { id: "goose", label: "Goose", requires: "goose", command: "goose", args: ["acp"] },
];

const WINDOWS_EXT = ["", ".exe", ".cmd", ".bat"];

function onPath(command: string, path: string, exists: (file: string) => boolean): boolean {
  if (command.includes("/") || command.includes("\\")) return exists(command);
  for (const dir of path.split(delimiter).filter(Boolean)) {
    for (const ext of WINDOWS_EXT) {
      if (exists(join(dir, command + ext))) return true;
    }
  }
  return false;
}

export function discoverAgents(deps: {
  path?: string;
  exists: (file: string) => boolean;
  extra?: AgentSpec[];
}): AgentSpec[] {
  const path = deps.path ?? process.env.PATH ?? "";
  const byId = new Map<string, AgentSpec>();
  for (const spec of KNOWN_AGENTS) byId.set(spec.id, spec);
  for (const spec of deps.extra ?? []) byId.set(spec.id, spec);
  return [...byId.values()].filter((spec) => onPath(spec.requires, path, deps.exists));
}
