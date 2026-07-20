import { relative } from "node:path";
import { z } from "zod";
import { gitignoreGlobs } from "../util/gitignore";
import { workspaceGlob } from "../util/workspace-glob";
import { defineTool } from "./types";

const IGNORE = ["**/node_modules/**", "**/.git/**", "**/dist/**"];
const MAX_RESULTS = 200;

export const globTool = defineTool({
  name: "glob",
  description:
    "Find files by glob pattern (e.g. \"src/**/*.ts\"). Returns paths relative to the workspace root.",
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern, e.g. "**/*.ts".'),
  }),
  readOnly: true,
  async run(args, ctx) {
    const abs = workspaceGlob(args.pattern, ctx.cwd, {
      ignore: [...IGNORE, ...gitignoreGlobs(ctx.cwd)],
    });
    const matches = abs.map((f) => relative(ctx.cwd, f).split("\\").join("/"));
    matches.sort();
    const shown = matches.slice(0, MAX_RESULTS);
    const suffix =
      matches.length > MAX_RESULTS
        ? `\n… and ${matches.length - MAX_RESULTS} more`
        : "";
    return {
      output: shown.length ? shown.join("\n") + suffix : "(no matches)",
      meta: { count: matches.length },
    };
  },
});
