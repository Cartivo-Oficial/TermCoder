import { z } from "zod";
import type { Config } from "../config/config";
import type { PermissionManager } from "../permission/permission";
import { Session, type ModelRunner } from "../session/session";
import type { SessionStore } from "../storage/storage";
import type { ToolRegistry } from "../tools";
import type { TermTool } from "../tools/types";

export interface SubagentDeps {
  store: SessionStore;
  registry: ToolRegistry;
  config: Config;
  permission: PermissionManager;
  env?: NodeJS.ProcessEnv;
  runner?: ModelRunner;
}

export function createSubagentTool(deps: SubagentDeps): TermTool {
  return {
    name: "task",
    description:
      "Delegate a focused, self-contained sub-task to a sub-agent that works autonomously and " +
      "returns a summary. Pick a specialist via `agent`: explore/scout (read-only research), " +
      "reviewer (critique a change), architect (design a plan), tester (write & run tests), " +
      "debugger (root-cause & fix a bug), or general (full access, default). Use it for " +
      "independent, well-scoped chunks so your own context stays lean.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("The task for the sub-agent, written as a complete, standalone instruction."),
      agent: z
        .string()
        .optional()
        .describe("Specialist to use: explore, scout, reviewer, architect, tester, debugger, or general."),
    }),
    readOnly: true,
    describe: (args: { prompt: string; agent?: string }) => ({
      title: args.agent ? `sub-agent: ${args.agent}` : "sub-agent task",
      detail: args.prompt,
    }),
    run: async (args: { prompt: string; agent?: string }, ctx) => {
      const sub = Session.create(
        {
          store: deps.store,
          registry: deps.registry,
          config: deps.config,
          permission: deps.permission,
          env: deps.env,
          runner: deps.runner,
        },
        { cwd: ctx.cwd, agent: args.agent, title: `Sub-agent: ${args.prompt.slice(0, 48)}` },
      );

      ctx.emit?.({
        type: "subagent-start",
        sessionId: sub.record.id,
        agent: args.agent ?? "general",
        prompt: args.prompt,
        parentToolCallId: ctx.toolCallId,
      });

      const texts: string[] = [];
      const toolsUsed: string[] = [];
      let failed = false;
      for await (const event of sub.prompt(args.prompt)) {
        ctx.emit?.({ ...event, sourceId: sub.record.id });
        if (event.type === "text-delta") texts.push(event.text);
        else if (event.type === "tool-call") toolsUsed.push(event.name);
        else if (event.type === "error") {
          failed = true;
          ctx.emit?.({ type: "subagent-end", sessionId: sub.record.id, status: "error" });
          return { output: `Sub-agent error: ${event.error}`, meta: { sessionId: sub.record.id } };
        }
      }
      ctx.emit?.({ type: "subagent-end", sessionId: sub.record.id, status: failed ? "error" : "done" });

      const summary = texts.join("").trim() || "(sub-agent produced no text)";
      const used = toolsUsed.length
        ? `\n\n(tools used: ${[...new Set(toolsUsed)].join(", ")})`
        : "";
      return { output: summary + used, meta: { sessionId: sub.record.id, toolsUsed } };
    },
  };
}
