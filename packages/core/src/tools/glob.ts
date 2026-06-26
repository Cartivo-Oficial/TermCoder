import { z } from "zod";
import { globSync } from "tinyglobby";
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
    const matches = globSync(args.pattern, {
      cwd: ctx.cwd,
      ignore: IGNORE,
      dot: false,
      onlyFiles: true,
    });
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
