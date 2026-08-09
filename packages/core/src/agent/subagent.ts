import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { z } from "zod";
import { discoverAgents as discoverInstalledAgents, type AgentSpec } from "../acp/registry";
import {
  runAgent as runInstalledAgent,
  type PermissionAsk,
  type PermissionChoice,
  type RunAgentOptions,
} from "../acp/run";
import type { Config } from "../config/config";
import type { PermissionKind, PermissionManager } from "../permission/permission";
import { Session, type ModelRunner, type SessionEvent } from "../session/session";
import type { SessionStore } from "../storage/storage";
import type { ToolRegistry } from "../tools";
import type { TermTool, ToolContext, ToolResult } from "../tools/types";

export interface SubagentDeps {
  store: SessionStore;
  registry: ToolRegistry;
  config: Config;
  permission: PermissionManager;
  env?: NodeJS.ProcessEnv;
  runner?: ModelRunner;
  runAgent?: (opts: RunAgentOptions) => Promise<void>;
  discoverAgents?: () => AgentSpec[];
}

interface CancellableContext extends ToolContext {
  signal?: AbortSignal;
}

const BASE_DESCRIPTION =
  "Delegate a focused, self-contained sub-task to a sub-agent that works autonomously and " +
  "returns a summary. Pick a specialist via `agent`: explore/scout (read-only research), " +
  "reviewer (critique a change), architect (design a plan), tester (write & run tests), " +
  "debugger (root-cause & fix a bug), or general (full access, default). Use it for " +
  "independent, well-scoped chunks so your own context stays lean.";

const BASE_ARG_DESCRIPTION =
  "Specialist to use: explore, scout, reviewer, architect, tester, debugger, or general.";

const SPECIALISTS = ["explore", "scout", "reviewer", "architect", "tester", "debugger", "general"];

const ALLOW_OPTION = /allow|approve|accept|proceed|yes/i;
const DENY_OPTION = /reject|deny|refuse|cancel|abort|stop/i;
const ALWAYS_OPTION = /always|all\b|session/i;

const TITLE_KINDS: Array<[RegExp, PermissionKind]> = [
  [/\b(bash|sh|shell|run|exec|execute|command|terminal|script|npm|git)\b/i, "bash"],
  [/\b(fetch|http|https|url|download|web|curl|request)\b/i, "network"],
  [/\b(write|create|new)\b/i, "write"],
  [/\b(edit|update|patch|modify|replace|delete|remove|move|rename)\b/i, "edit"],
];

function permissionKindFor(title: string): PermissionKind {
  for (const [pattern, kind] of TITLE_KINDS) {
    if (pattern.test(title)) return kind;
  }
  return "mcp";
}

function chooseOption(options: PermissionChoice[], allowed: boolean): string {
  const wanted = allowed ? ALLOW_OPTION : DENY_OPTION;
  const fits = options.filter((option) => wanted.test(option.id) || wanted.test(option.name));
  const once = fits.find(
    (option) => !ALWAYS_OPTION.test(option.id) && !ALWAYS_OPTION.test(option.name),
  );
  return (once ?? fits[0])?.id ?? "";
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

export function agentFailure(label: string, raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("authenticate") || s.includes("oauth") || s.includes("unauthorized") || s.includes("401")) {
    return `${label} is installed but not signed in. Run it once in a terminal and sign in, then try again.`;
  }
  if (s.includes("enoent") || s.includes("not recognized") || s.includes("command not found")) {
    return `${label} could not be launched. Check that it is installed and on your PATH.`;
  }
  if (s.includes("rate limit") || s.includes("429")) {
    return `${label} is rate limited right now. Try again shortly.`;
  }
  return `${label} failed: ${raw}`;
}

function externalNote(installed: AgentSpec[]): string {
  if (installed.length === 0) return "";
  const list = installed.map((spec) => `${spec.id} (${spec.label})`).join(", ");
  return (
    ` You can also hand the whole task to a coding agent installed on this machine: ${list}. ` +
    "Each runs in its own process, reports what it does, and asks before it touches anything."
  );
}

export function createSubagentTool(deps: SubagentDeps): TermTool {
  const discover =
    deps.discoverAgents ??
    (() =>
      discoverInstalledAgents({
        exists: existsSync,
        path: deps.env?.PATH ?? process.env.PATH,
      }));

  let installed: AgentSpec[] = [];
  try {
    installed = discover().filter((spec) => !SPECIALISTS.includes(spec.id));
  } catch {
    installed = [];
  }
  const byId = new Map(installed.map((spec) => [spec.id, spec]));
  const runExternalAgent = deps.runAgent ?? runInstalledAgent;

  async function askForAgent(spec: AgentSpec, ask: PermissionAsk): Promise<string> {
    const allowed = await deps.permission.check({
      toolName: `task(${spec.id})`,
      kind: permissionKindFor(ask.title),
      title: `${spec.label}: ${ask.title}`,
      detail: ask.options.map((option) => option.name).join(" / "),
    });
    return chooseOption(ask.options, allowed);
  }

  async function delegateExternal(
    spec: AgentSpec,
    prompt: string,
    ctx: CancellableContext,
  ): Promise<ToolResult> {
    const sessionId = `acp-${spec.id}-${randomUUID()}`;
    ctx.emit?.({
      type: "subagent-start",
      sessionId,
      agent: spec.id,
      prompt,
      parentToolCallId: ctx.toolCallId,
    });

    const texts: string[] = [];
    const toolsUsed: string[] = [];
    let failed = false;

    const collect = (event: SessionEvent) => {
      ctx.emit?.(event);
      if (event.type === "text-delta") texts.push(event.text);
      else if (event.type === "tool-call") toolsUsed.push(event.name);
      else if (event.type === "error") failed = true;
    };

    try {
      await runExternalAgent({
        spec,
        cwd: ctx.cwd,
        prompt,
        sourceId: sessionId,
        emit: collect,
        askPermission: (ask) => askForAgent(spec, ask),
        signal: ctx.signal,
        env: deps.env,
      });
    } catch (error) {
      const message = agentFailure(spec.label, messageOf(error));
      ctx.emit?.({ type: "error", error: message, sourceId: sessionId });
      ctx.emit?.({ type: "subagent-end", sessionId, status: "error" });
      return {
        output: message,
        meta: { sessionId, agent: spec.id, external: true, failed: true },
      };
    }

    ctx.emit?.({ type: "subagent-end", sessionId, status: failed ? "error" : "done" });

    const summary = texts.join("").trim() || "(the agent produced no text)";
    const used = toolsUsed.length
      ? `\n\n(tools used: ${[...new Set(toolsUsed)].join(", ")})`
      : "";
    return {
      output: summary + used,
      meta: { sessionId, agent: spec.id, external: true, toolsUsed },
    };
  }

  return {
    name: "task",
    description: BASE_DESCRIPTION + externalNote(installed),
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("The task for the sub-agent, written as a complete, standalone instruction."),
      agent: z
        .string()
        .optional()
        .describe(
          installed.length
            ? `${BASE_ARG_DESCRIPTION} Or an installed coding agent: ${installed
                .map((spec) => spec.id)
                .join(", ")}.`
            : BASE_ARG_DESCRIPTION,
        ),
    }),
    readOnly: true,
    describe: (args: { prompt: string; agent?: string }) => ({
      title: args.agent ? `sub-agent: ${args.agent}` : "sub-agent task",
      detail: args.prompt,
    }),
    run: async (args: { prompt: string; agent?: string }, ctx: ToolContext) => {
      const external = args.agent ? byId.get(args.agent) : undefined;
      if (external) return delegateExternal(external, args.prompt, ctx as CancellableContext);

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
      let ended = false;
      try {
        for await (const event of sub.prompt(args.prompt)) {
          ctx.emit?.({ ...event, sourceId: sub.record.id });
          if (event.type === "text-delta") texts.push(event.text);
          else if (event.type === "tool-call") toolsUsed.push(event.name);
          else if (event.type === "error") {
            failed = true;
            ended = true;
            ctx.emit?.({ type: "subagent-end", sessionId: sub.record.id, status: "error" });
            return { output: `Sub-agent error: ${event.error}`, meta: { sessionId: sub.record.id } };
          }
        }
        ended = true;
        ctx.emit?.({ type: "subagent-end", sessionId: sub.record.id, status: failed ? "error" : "done" });
      } finally {
        if (!ended) ctx.emit?.({ type: "subagent-end", sessionId: sub.record.id, status: "error" });
      }

      const summary = texts.join("").trim() || "(sub-agent produced no text)";
      const used = toolsUsed.length
        ? `\n\n(tools used: ${[...new Set(toolsUsed)].join(", ")})`
        : "";
      return { output: summary + used, meta: { sessionId: sub.record.id, toolsUsed } };
    },
  };
}
