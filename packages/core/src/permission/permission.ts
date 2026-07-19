import type { Config, PermissionMode, PermissionRule } from "../config/config";

export type PermissionKind = "bash" | "write" | "edit" | "mcp" | "network";

export type PermissionMap = Partial<Record<PermissionKind, PermissionRule>>;

export interface PermissionRequest {
  toolName: string;
  kind: PermissionKind;
  title: string;
  detail?: string;
  target?: string;
}

export type PermissionDecision = "allow" | "deny" | "allow-always";

export type PermissionAsker = (
  request: PermissionRequest,
) => Promise<PermissionDecision>;

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?"; // `**/` — zero or more leading directories
        } else {
          re += ".*"; // `**` — anything, across separators
        }
      } else {
        re += "[^/]*"; // `*` — anything within a single path segment
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

const globCache = new Map<string, RegExp>();
function matchesGlob(pattern: string, target: string): boolean {
  let re = globCache.get(pattern);
  if (!re) {
    re = globToRegExp(pattern);
    globCache.set(pattern, re);
  }
  return re.test(target);
}

export function resolvePermissionMode(
  rule: PermissionRule | undefined,
  target: string | undefined,
): PermissionMode {
  if (rule === undefined) return "ask";
  if (typeof rule === "string") return rule;
  let mode: PermissionMode = "ask";
  if (target !== undefined) {
    for (const [pattern, m] of Object.entries(rule)) {
      if (matchesGlob(pattern, target)) mode = m;
    }
  }
  return mode;
}

export class PermissionManager {
  private readonly always = new Set<PermissionKind>();
  private autoApprove = false;
  private agentPermission: PermissionMap | undefined;

  constructor(
    private readonly config: Config["permission"],
    private readonly asker: PermissionAsker,
  ) {}

  setAutoApprove(enabled: boolean): void {
    this.autoApprove = enabled;
  }

  isAutoApprove(): boolean {
    return this.autoApprove;
  }

  setAgentPermission(perm: PermissionMap | undefined): void {
    this.agentPermission = perm;
  }

  async check(request: PermissionRequest): Promise<boolean> {
    if (this.autoApprove) return true;
    const rule = this.agentPermission?.[request.kind] ?? this.config?.[request.kind];
    const mode = resolvePermissionMode(rule, request.target);
    if (mode === "allow") return true;
    if (mode === "deny") return false;

    if (this.always.has(request.kind)) return true;

    const decision = await this.asker(request);
    if (decision === "allow-always") {
      this.always.add(request.kind);
      return true;
    }
    return decision === "allow";
  }
}
