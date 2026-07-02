import type { Config, PermissionMode, PermissionRule } from "../config/config";

/** Classes of action that can be gated. Read-only tools never reach the gate. */
export type PermissionKind = "bash" | "write" | "edit" | "mcp";

/** A per-kind permission map (from an agent or the global config). */
export type PermissionMap = Partial<Record<PermissionKind, PermissionRule>>;

export interface PermissionRequest {
  /** The tool requesting permission, e.g. "write". */
  toolName: string;
  kind: PermissionKind;
  /** One-line summary, e.g. `Write src/index.ts`. */
  title: string;
  /** Optional preview: a diff, the command to run, etc. */
  detail?: string;
  /**
   * What the action targets — a workspace-relative file path (write/edit) or the
   * command string (bash). Used to resolve glob-based permission rules.
   */
  target?: string;
}

/** A user's answer to a permission request. */
export type PermissionDecision = "allow" | "deny" | "allow-always";

/**
 * Asks the user to decide on a request. Provided by the client (the TUI shows a
 * modal). The core stays interface-agnostic by depending only on this callback.
 */
export type PermissionAsker = (
  request: PermissionRequest,
) => Promise<PermissionDecision>;

/**
 * Translate a glob pattern into an anchored RegExp. Supports `**` (any depth,
 * including none when written as `**\/`), `*` (anything but a path separator),
 * and `?` (a single non-separator char). Everything else is matched literally.
 */
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

/**
 * Resolve an effective mode from a rule and the action's target. A plain string
 * rule applies unconditionally; a glob map is scanned in order and the last
 * matching pattern wins (so a broad default like `"**"` can be listed first and
 * overridden by later, more specific entries). Falls back to `"ask"`.
 */
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

/**
 * Decides whether gated tool calls may proceed, combining static config
 * (allow/deny/ask per kind, optionally glob-scoped) with interactive prompts and
 * per-session "allow always" memory. An agent's own permission map, when set,
 * takes precedence over the global config for the kinds it specifies.
 */
export class PermissionManager {
  private readonly always = new Set<PermissionKind>();
  private autoApprove = false;
  private agentPermission: PermissionMap | undefined;

  constructor(
    private readonly config: Config["permission"],
    private readonly asker: PermissionAsker,
  ) {}

  /** Approve every gated action without prompting (the "auto/yolo" mode). */
  setAutoApprove(enabled: boolean): void {
    this.autoApprove = enabled;
  }

  isAutoApprove(): boolean {
    return this.autoApprove;
  }

  /**
   * Apply an agent's permission overrides for subsequent checks. Called once per
   * turn with the active agent's map (or `undefined` to clear back to config).
   */
  setAgentPermission(perm: PermissionMap | undefined): void {
    this.agentPermission = perm;
  }

  /** Returns true if the action is permitted to run. */
  async check(request: PermissionRequest): Promise<boolean> {
    if (this.autoApprove) return true;
    const rule = this.agentPermission?.[request.kind] ?? this.config?.[request.kind];
    const mode = resolvePermissionMode(rule, request.target);
    if (mode === "allow") return true;
    if (mode === "deny") return false;

    // mode === "ask"
    if (this.always.has(request.kind)) return true;

    const decision = await this.asker(request);
    if (decision === "allow-always") {
      this.always.add(request.kind);
      return true;
    }
    return decision === "allow";
  }
}
