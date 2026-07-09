import { z } from "zod";
import { defineTool } from "./types";
import { discoverMemories, saveMemory, deleteMemory, memoryIndex } from "../memory/memory";

export const memoryTool = defineTool({
  name: "memory",
  description:
    "Remember durable, high-value facts across sessions. command=save stores a fact (a project convention, an architectural truth, a stated user preference, or a decision and why); read loads one by name; list shows the index; delete removes one. Never store secrets or transient task state. Prefer updating an existing memory over a near-duplicate.",
  inputSchema: z.object({
    command: z.enum(["save", "read", "list", "delete"]),
    scope: z.enum(["project", "user"]).optional().describe("save: 'project' (this repo, shared via git) or 'user' (your global preference). Default project."),
    name: z.string().optional().describe("save/read/delete: the memory's short slug name."),
    description: z.string().optional().describe("save: one-line summary shown in the always-on index."),
    type: z.enum(["project", "preference", "decision"]).optional(),
    body: z.string().optional().describe("save: the fact itself."),
  }),
  readOnly: true,
  describe(args) {
    return { title: args.command === "save" ? `Remember: ${args.name ?? "note"}` : `memory ${args.command}` };
  },
  async run(args, ctx) {
    const cwd = ctx.cwd;
    if (args.command === "list") {
      const idx = memoryIndex(discoverMemories({ cwd }));
      return { output: idx || "No memories yet." };
    }
    if (args.command === "read") {
      const m = discoverMemories({ cwd }).find((x) => x.name === args.name);
      return { output: m ? `# Memory: ${m.name}\n\n${m.body}` : `No memory named "${args.name ?? ""}".` };
    }
    if (args.command === "delete") {
      const removed = deleteMemory({ name: args.name ?? "", cwd });
      return { output: removed ? `Deleted memory "${args.name}".` : `No memory named "${args.name ?? ""}".` };
    }
    if (!args.name || !args.body) return { output: "To save a memory, provide name and body." };
    try {
      const m = saveMemory({
        scope: args.scope ?? "project",
        name: args.name,
        description: args.description ?? "",
        type: args.type ?? "project",
        body: args.body,
        cwd,
      });
      return { output: `Saved ${m.scope} memory "${m.name}".` };
    } catch (err) {
      return { output: err instanceof Error ? err.message : String(err) };
    }
  },
});
