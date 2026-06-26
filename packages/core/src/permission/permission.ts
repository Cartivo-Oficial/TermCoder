import type { Config } from "../config/config";

/** Classes of action that can be gated. Read-only tools never reach the gate. */
export type PermissionKind = "bash" | "write" | "edit" | "mcp";

export interface PermissionRequest {
  /** The tool requesting permission, e.g. "write". */
  toolName: string;
  kind: PermissionKind;
  /** One-line summary, e.g. `Write src/index.ts`. */
  title: string;
  /** Optional preview: a diff, the command to run, etc. */
  detail?: string;
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
 * Decides whether gated tool calls may proceed, combining static config
 * (allow/deny/ask per kind) with interactive prompts and per-session
 * "allow always" memory.
 */
export class PermissionManager {
  private readonly always = new Set<PermissionKind>();

  constructor(
    private readonly config: Config["permission"],
    private readonly asker: PermissionAsker,
  ) {}

  /** Returns true if the action is permitted to run. */
  async check(request: PermissionRequest): Promise<boolean> {
    const mode = this.config[request.kind];
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
