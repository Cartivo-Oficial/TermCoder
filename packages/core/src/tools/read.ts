import { readFileSync, statSync } from "node:fs";
import { z } from "zod";
import { resolveInside } from "../util/path";
import { defineTool } from "./types";

const MAX_BYTES = 256 * 1024;

export const readTool = defineTool({
  name: "read",
  description:
    "Read a UTF-8 text file from the workspace. Optionally start at a line offset and limit the number of lines.",
  inputSchema: z.object({
    path: z.string().describe("Path to the file, relative to the workspace root."),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Zero-based line to start reading from."),
    limit: z.number().int().min(1).optional().describe("Maximum number of lines to read."),
  }),
  readOnly: true,
  async run(args, ctx) {
    const abs = resolveInside(ctx.cwd, args.path);
    const stat = statSync(abs);
    if (stat.size > MAX_BYTES) {
      throw new Error(
        `File is too large to read (${stat.size} bytes, limit ${MAX_BYTES}). Use offset/limit.`,
      );
    }
    const content = readFileSync(abs, "utf8");
    if (args.offset === undefined && args.limit === undefined) {
      return { output: content };
    }
    const lines = content.split("\n");
    const start = args.offset ?? 0;
    const end = args.limit === undefined ? lines.length : start + args.limit;
    return { output: lines.slice(start, end).join("\n") };
  },
});
