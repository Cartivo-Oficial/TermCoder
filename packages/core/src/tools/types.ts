import type { Schema } from "ai";
import type { z } from "zod";
import type { PermissionKind } from "../permission/permission";
import type { SessionEvent } from "../session/session";

export interface ToolContext {
  cwd: string;
  toolCallId?: string;
  emit?: (event: SessionEvent) => void;
  tools?: TermTool[];
}

export interface ToolResult {
  output: string;
  meta?: Record<string, unknown>;
}

export interface ToolDescription {
  title: string;
  detail?: string;
}

export interface TermTool<Args = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<Args> | Schema<Args>;
  readOnly: boolean;
  permissionKind?: PermissionKind;
  describe?: (args: Args, ctx: ToolContext) => ToolDescription;
  target?: (args: Args, ctx: ToolContext) => string | undefined;
  run: (args: Args, ctx: ToolContext) => Promise<ToolResult>;
}

export function defineTool<S extends z.ZodType>(def: {
  name: string;
  description: string;
  inputSchema: S;
  readOnly: boolean;
  permissionKind?: PermissionKind;
  describe?: (args: z.infer<S>, ctx: ToolContext) => ToolDescription;
  target?: (args: z.infer<S>, ctx: ToolContext) => string | undefined;
  run: (args: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
}): TermTool<z.infer<S>> {
  return def as TermTool<z.infer<S>>;
}
