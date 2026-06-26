import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { z } from "zod";
import { resolveInside } from "../util/path";
import { defineTool } from "./types";

function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/** A compact preview of the replacement for the permission prompt. */
function previewDiff(oldString: string, newString: string): string {
  const minus = oldString.split("\n").map((l) => `- ${l}`);
  const plus = newString.split("\n").map((l) => `+ ${l}`);
  return [...minus, ...plus].slice(0, 12).join("\n");
}

export const editTool = defineTool({
  name: "edit",
  description:
    "Replace an exact string in a file. The old string must be unique unless replaceAll is set.",
  inputSchema: z.object({
    path: z.string().describe("Path to the file, relative to the workspace root."),
    oldString: z.string().describe("Exact text to find."),
    newString: z.string().describe("Text to replace it with."),
    replaceAll: z
      .boolean()
      .optional()
      .describe("Replace every occurrence instead of requiring a unique match."),
  }),
  readOnly: false,
  permissionKind: "edit",
  describe(args, ctx) {
    const rel = relative(ctx.cwd, resolveInside(ctx.cwd, args.path)).split("\\").join("/");
    return { title: `Edit ${rel}`, detail: previewDiff(args.oldString, args.newString) };
  },
  async run(args, ctx) {
    const abs = resolveInside(ctx.cwd, args.path);
    const original = readFileSync(abs, "utf8");
    const occurrences = countOccurrences(original, args.oldString);

    if (occurrences === 0) {
      throw new Error("oldString not found in file.");
    }
    if (occurrences > 1 && !args.replaceAll) {
      throw new Error(
        `oldString is not unique (${occurrences} matches). Provide more context or set replaceAll.`,
      );
    }

    const updated = args.replaceAll
      ? original.split(args.oldString).join(args.newString)
      : original.replace(args.oldString, args.newString);
    writeFileSync(abs, updated, "utf8");

    const rel = relative(ctx.cwd, abs).split("\\").join("/");
    return {
      output: `Edited ${rel} (${occurrences} replacement(s)).`,
      meta: { replacements: occurrences },
    };
  },
});
