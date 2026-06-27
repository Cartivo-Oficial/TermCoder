import { z } from "zod";
import type { Config } from "../config/config";
import type { PermissionManager } from "../permission/permission";
import { Session, type ModelRunner } from "../session/session";
import type { SessionStore } from "../storage/storage";
import type { ToolRegistry } from "../tools";
import type { TermTool } from "../tools/types";

export interface SubagentDeps {
  store: SessionStore;
  /** Tools available to the sub-agent. MUST NOT include the task tool itself. */
  registry: ToolRegistry;
  config: Config;
  permission: PermissionManager;
  env?: NodeJS.ProcessEnv;
  runner?: ModelRunner;
}

/**
 * Build the `task` tool: it delegates a self-contained instruction to a fresh
 * sub-agent (a nested Session) that runs to completion with its own message
 * history, then returns the sub-agent's text plus which tools it used.
 *
 * The sub-agent reuses the caller's permission gate, so mutating actions still
 * prompt the user. Its registry deliberately excludes the task tool, bounding
 * delegation to a single level.
 */
export function createSubagentTool(deps: SubagentDeps): TermTool {
  return {
    name: "task",
    description:
      "Delegate a focused, self-contained sub-task to a sub-agent. It works autonomously " +
      "with the same tools and returns a summary. Use it for independent, well-scoped chunks of work.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("The task for the sub-agent, written as a complete, standalone instruction."),
    }),
    // The call itself is auto-allowed; the sub-agent's own tool calls are gated.
    readOnly: true,
    describe: (args: { prompt: string }) => ({ title: "sub-agent task", detail: args.prompt }),
    run: async (args: { prompt: string }, ctx) => {
      const sub = Session.create(
        {
          store: deps.store,
          registry: deps.registry,
          config: deps.config,
          permission: deps.permission,
          env: deps.env,
          runner: deps.runner,
        },
        { cwd: ctx.cwd, title: `Sub-agent: ${args.prompt.slice(0, 48)}` },
      );

      const texts: string[] = [];
      const toolsUsed: string[] = [];
      for await (const event of sub.prompt(args.prompt)) {
        if (event.type === "text-delta") texts.push(event.text);
        else if (event.type === "tool-call") toolsUsed.push(event.name);
        else if (event.type === "error") {
          return { output: `Sub-agent error: ${event.error}`, meta: { sessionId: sub.record.id } };
        }
      }

      const summary = texts.join("").trim() || "(sub-agent produced no text)";
      const used = toolsUsed.length
        ? `\n\n(tools used: ${[...new Set(toolsUsed)].join(", ")})`
        : "";
      return { output: summary + used, meta: { sessionId: sub.record.id, toolsUsed } };
    },
  };
}
