import { z } from "zod";
import { defineTool } from "./types";
import { repoDetail } from "../knowledge/repomap";

export const repomapTool = defineTool({
  name: "repomap",
  description:
    "Get a structured overview of the project: tech stack, build/test scripts, key directories, and entry-point exports. Call this first when you're unfamiliar with the codebase, before exploring by hand.",
  inputSchema: z.object({}),
  readOnly: true,
  describe() {
    return { title: "Map the repository" };
  },
  async run(_args, ctx) {
    const detail = repoDetail(ctx.cwd);
    return { output: detail || "No recognizable project structure was found in this directory." };
  },
});
