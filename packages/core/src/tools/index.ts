import { tool, type Schema, type ToolSet } from "ai";
import type { z } from "zod";
import type { TermTool } from "./types";
import { readTool } from "./read";
import { lsTool } from "./ls";
import { globTool } from "./glob";
import { grepTool } from "./grep";
import { writeTool } from "./write";
import { editTool } from "./edit";
import { bashTool } from "./bash";
import { webfetchTool } from "./webfetch";
import { websearchTool } from "./websearch";
import { skillTool } from "./skill";
import { memoryTool } from "./memory";
import { repomapTool } from "./repomap";
import { symbolsTool } from "./symbols";

export type { TermTool, ToolContext, ToolResult } from "./types";
export { defineTool } from "./types";

export const builtinTools: TermTool[] = [
  readTool,
  lsTool,
  globTool,
  grepTool,
  writeTool,
  editTool,
  bashTool,
  webfetchTool,
  websearchTool,
  skillTool,
  memoryTool,
  repomapTool,
  symbolsTool,
];

export class ToolRegistry {
  private readonly byName = new Map<string, TermTool>();

  constructor(tools: TermTool[] = builtinTools) {
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
