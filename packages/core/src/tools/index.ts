import { tool, type Schema, type ToolSet } from "ai";
import type { z } from "zod";
import type { TermTool } from "./types";
import { builtinTools } from "./builtins";
import { runCodeTool } from "../codemode";

export type { TermTool, ToolContext, ToolResult } from "./types";
export { defineTool } from "./types";
export { builtinTools } from "./builtins";

export const registryTools: TermTool[] = [...builtinTools, runCodeTool];

export class ToolRegistry {
  private readonly byName = new Map<string, TermTool>();

  constructor(tools: TermTool[] = registryTools) {
    for (const t of tools) this.byName.set(t.name, t);
  }

  get(name: string): TermTool | undefined {
    return this.byName.get(name);
  }

  list(): TermTool[] {
    return [...this.byName.values()];
  }

  toToolSet(filter?: (t: TermTool) => boolean): ToolSet {
    const set: ToolSet = {};
    for (const t of this.byName.values()) {
      if (filter && !filter(t)) continue;
      set[t.name] = tool({
        description: t.description,
        inputSchema: t.inputSchema as z.ZodType | Schema,
      });
    }
    return set;
  }
}
