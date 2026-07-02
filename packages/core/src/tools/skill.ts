import { z } from "zod";
import { defineTool } from "./types";
import { discoverSkills, getSkill } from "../skill/skills";

/**
 * Loads the full instructions for a named skill. The skill menu (names +
 * descriptions) is injected into the system prompt; this tool fetches a skill's
 * body only when the agent decides it's relevant, so unused skills cost nothing.
 */
export const skillTool = defineTool({
  name: "skill",
  description:
    "Load the full instructions for a named skill (a reusable playbook). Call this when the user's task matches a skill listed under 'Available skills' in the system prompt.",
  inputSchema: z.object({
    name: z.string().describe("The skill name to load."),
  }),
  readOnly: true,
  describe(args) {
    return { title: `Load skill: ${args.name}` };
  },
  async run(args, ctx) {
    const skill = getSkill(ctx.cwd, args.name);
    if (!skill) {
      const names = discoverSkills({ cwd: ctx.cwd }).map((s) => s.name);
      return {
        output: names.length
          ? `No skill named "${args.name}". Available skills: ${names.join(", ")}.`
          : "No skills are defined in this project.",
      };
    }
    return { output: `# Skill: ${skill.name}\n\n${skill.body}` };
  },
});
