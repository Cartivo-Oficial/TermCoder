import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { z } from "zod";
import { globSync } from "tinyglobby";
import { gitignoreGlobs } from "../util/gitignore";
import { defineTool } from "./types";

const IGNORE = ["**/node_modules/**", "**/.git/**", "**/dist/**"];
const MAX_MATCHES = 200;
const MAX_FILE_BYTES = 512 * 1024;

/** Heuristic: treat a file as binary if its head contains a NUL byte. */
function looksBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 1024);
  for (let i = 0; i < len; i++) if (buf[i] === 0) return true;
  return false;
}

export const grepTool = defineTool({
  name: "grep",
  description:
    "Search file contents for a regular expression. Returns matching lines as path:line:text.",
  inputSchema: z.object({
    pattern: z.string().describe("Regular expression to search for."),
    glob: z
      .string()
      .optional()
      .describe('Optional glob to limit files, e.g. "src/**/*.ts". Defaults to all files.'),
    ignoreCase: z.boolean().optional().describe("Case-insensitive search."),
  }),
  readOnly: true,
  async run(args, ctx) {
    let regex: RegExp;
    try {
      regex = new RegExp(args.pattern, args.ignoreCase ? "i" : undefined);
    } catch (err) {
      throw new Error(`Invalid regular expression: ${(err as Error).message}`);
    }

    const files = globSync(args.glob ?? "**/*", {
      cwd: ctx.cwd,
      ignore: [...IGNORE, ...gitignoreGlobs(ctx.cwd)],
      dot: false,
      onlyFiles: true,
      absolute: true,
    });

    const results: string[] = [];
    let truncated = false;
    for (const file of files) {
      let buf: Buffer;
      try {
        buf = readFileSync(file);
      } catch {
        continue;
      }
      if (buf.length > MAX_FILE_BYTES || looksBinary(buf)) continue;
      const rel = relative(ctx.cwd, file).split("\\").join("/");
      const lines = buf.toString("utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i] ?? "")) {
          results.push(`${rel}:${i + 1}:${(lines[i] ?? "").trim()}`);
          if (results.length >= MAX_MATCHES) {
            truncated = true;
            break;
          }
        }
      }
      if (truncated) break;
    }

    if (results.length === 0) return { output: "(no matches)" };
    return {
      output: results.join("\n") + (truncated ? "\n… (truncated)" : ""),
      meta: { count: results.length },
    };
  },
});
