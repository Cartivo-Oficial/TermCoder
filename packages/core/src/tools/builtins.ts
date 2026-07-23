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
import { recipeTool } from "./recipe";
import { repomapTool } from "./repomap";
import { symbolsTool } from "./symbols";

export const builtinTools: TermTool[] = [
  readTool, lsTool, globTool, grepTool, writeTool, editTool, bashTool,
  webfetchTool, websearchTool, skillTool, memoryTool, recipeTool,
  repomapTool, symbolsTool,
];
