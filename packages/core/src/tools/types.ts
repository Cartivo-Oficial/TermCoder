import type { Schema } from "ai";
import type { z } from "zod";
import type { PermissionKind } from "../permission/permission";

/** Ambient information a tool needs to run. */
export interface ToolContext {
  cwd: string;
}

/** The outcome of running a tool. */
export interface ToolResult {
  /** Text returned to the model. */
  output: string;
  /** Optional structured data for the client to render (e.g. a diff). */
  meta?: Record<string, unknown>;
}

/** A short, human-readable summary of a pending action, shown when asking. */
export interface ToolDescription {
  title: string;
  detail?: string;
}

/**
 * A termcoder tool: its model-facing schema plus the host-side executor and the
 * metadata the permission gate needs. Tools that mutate the workspace set
 * `readOnly: false` and a `permissionKind`.
 */
export interface TermTool<Args = any> {
  name: string;
  description: string;
  /** A zod schema (built-in tools) or an AI SDK Schema (MCP tools via jsonSchema). */
  inputSchema: z.ZodType<Args> | Schema<Args>;
  readOnly: boolean;
  permissionKind?: PermissionKind;
  describe?: (args: Args, ctx: ToolContext) => ToolDescription;
  run: (args: Args, ctx: ToolContext) => Promise<ToolResult>;
}

/** Helper that preserves the inferred argument type from the zod schema. */
export function defineTool<S extends z.ZodType>(def: {
  name: string;
  description: string;
  inputSchema: S;
  readOnly: boolean;
  permissionKind?: PermissionKind;
  describe?: (args: z.infer<S>, ctx: ToolContext) => ToolDescription;
  run: (args: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
}): TermTool<z.infer<S>> {
  return def as TermTool<z.infer<S>>;
}
