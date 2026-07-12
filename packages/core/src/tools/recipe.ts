import { z } from "zod";
import { defineTool } from "./types";
import { discoverRecipes, saveRecipe, deleteRecipe, getRecipe, recipeIndex, composeRecipeRun } from "../recipe/recipe";

export const recipeTool = defineTool({
  name: "recipe",
  description:
    "Saved, shareable multi-step workflows. command=save stores a named recipe (an ordered list of steps — a dev automation like 'open a PR' or a study lesson); read shows one; list shows the index; delete removes one; run returns a recipe's steps composed as a ready-to-follow task. Prefer updating an existing recipe over a near-duplicate.",
  inputSchema: z.object({
    command: z.enum(["save", "read", "list", "delete", "run"]),
    scope: z
      .enum(["project", "user"])
      .optional()
      .describe("save: 'project' (this repo, shared via git) or 'user' (your global recipe). Default project."),
    name: z.string().optional().describe("save/read/delete/run: the recipe's short slug name."),
    description: z.string().optional().describe("save: one-line summary."),
    audience: z
      .enum(["dev", "study", "any"])
      .optional()
      .describe("save: 'dev' (execute in order), 'study' (tutor one step at a time), or 'any'. Default any."),
    steps: z.array(z.string()).optional().describe("save: the ordered steps, one instruction per item."),
  }),
  readOnly: true,
  describe(args) {
    return { title: args.command === "save" ? `Recipe: ${args.name ?? "new"}` : `recipe ${args.command}` };
  },
  async run(args, ctx) {
    const cwd = ctx.cwd;
    if (args.command === "list") {
      const idx = recipeIndex(discoverRecipes({ cwd }));
      return { output: idx || "No recipes yet." };
    }
    if (args.command === "read" || args.command === "run") {
      const r = getRecipe(args.name ?? "", { cwd });
      if (!r) return { output: `No recipe named "${args.name ?? ""}".` };
      if (args.command === "run") return { output: composeRecipeRun(r) };
      const steps = r.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
      return { output: `# Recipe: ${r.name}${r.description ? `\n${r.description}` : ""}\n\n${steps}` };
    }
    if (args.command === "delete") {
      const removed = deleteRecipe({ name: args.name ?? "", cwd });
      return { output: removed ? `Deleted recipe "${args.name}".` : `No recipe named "${args.name ?? ""}".` };
    }
    if (!args.name || !args.steps || args.steps.length === 0) {
      return { output: "To save a recipe, provide name and at least one step." };
    }
    try {
      const r = saveRecipe({
        scope: args.scope ?? "project",
        name: args.name,
        description: args.description ?? "",
        audience: args.audience ?? "any",
        steps: args.steps,
        cwd,
      });
      return { output: `Saved ${r.scope} recipe "${r.name}" (${r.steps.length} steps).` };
    } catch (err) {
      return { output: err instanceof Error ? err.message : String(err) };
    }
  },
});
