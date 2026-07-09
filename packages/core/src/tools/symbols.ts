import { z } from "zod";
import { defineTool } from "./types";
import { buildSymbolIndex, findSymbols } from "../knowledge/symbols";

export const symbolsTool = defineTool({
  name: "symbols",
  description:
    "Search the codebase's definitions (functions, classes, types, consts) by name and get their file:line locations, ranked by relevance. Use this to locate where something is defined before reading it.",
  inputSchema: z.object({
    query: z.string().describe("A symbol name or fragment to look up, e.g. 'resolveModel'."),
  }),
  readOnly: true,
  describe(args) {
    return { title: `Find symbol: ${args.query}` };
  },
  async run(args, ctx) {
    const index = buildSymbolIndex(ctx.cwd);
    const hits = findSymbols(index, args.query);
    if (hits.length === 0) {
      return { output: `No definitions matching "${args.query}" found (indexed ${index.length} symbols).` };
    }
    const lines = hits.map((s) => `${s.file}:${s.line}  ${s.kind} ${s.name}`);
    return { output: `Definitions matching "${args.query}":\n${lines.join("\n")}` };
  },
});
