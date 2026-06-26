import { readdirSync } from "node:fs";
import { z } from "zod";
import { resolveInside } from "../util/path";
import { defineTool } from "./types";

export const lsTool = defineTool({
  name: "ls",
  description: "List the entries of a directory in the workspace.",
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .describe("Directory to list, relative to the workspace root. Defaults to the root."),
  }),
  readOnly: true,
  async run(args, ctx) {
    const abs = resolveInside(ctx.cwd, args.path ?? ".");
    const entries = readdirSync(abs, { withFileTypes: true })
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort();
    return { output: entries.length ? entries.join("\n") : "(empty directory)" };
  },
});
