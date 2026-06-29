import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { z } from "zod";
import { formatDiff } from "../util/diff";
import { resolveInside } from "../util/path";
import { defineTool } from "./types";

export const writeTool = defineTool({
  name: "write",
  description:
    "Create a new file or overwrite an existing one with the given content.",
  inputSchema: z.object({
    path: z.string().describe("Path to the file, relative to the workspace root."),
    content: z.string().describe("The full content to write."),
  }),
  readOnly: false,
  permissionKind: "write",
  describe(args, ctx) {
    const abs = resolveInside(ctx.cwd, args.path);
    const rel = relative(ctx.cwd, abs).split("\\").join("/");
    const exists = existsSync(abs);
    const previous = exists ? readFileSync(abs, "utf8") : "";
    return {
      title: `${exists ? "Overwrite" : "Create"} ${rel}`,
      detail: formatDiff(previous, args.content),
    };
  },
  async run(args, ctx) {
    const abs = resolveInside(ctx.cwd, args.path);
    const existed = existsSync(abs);
    const previousLength = existed ? readFileSync(abs, "utf8").length : 0;
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, args.content, "utf8");
    const rel = relative(ctx.cwd, abs).split("\\").join("/");
    return {
      output: `${existed ? "Overwrote" : "Created"} ${rel} (${args.content.length} bytes).`,
      meta: { created: !existed, previousLength, newLength: args.content.length },
    };
  },
});
