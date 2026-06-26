import { streamText, type ModelMessage, type ToolSet } from "ai";
import type { Config } from "../config/config";
import type { PermissionManager } from "../permission/permission";
import { resolveModel } from "../provider/provider";
import type { SessionStore, SessionRecord } from "../storage/storage";
import type { ToolContext } from "../tools/types";
import type { ToolRegistry } from "../tools";

/** Events emitted while a turn runs. The client renders these; the core stays UI-agnostic. */
export type SessionEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; id: string; name: string; args: unknown; title?: string; detail?: string }
  | { type: "tool-result"; id: string; name: string; output: string; isError: boolean }
  | { type: "done" }
  | { type: "error"; error: string };

/** Minimal shape the session needs from a model call — satisfied by AI SDK `streamText`. */
export interface ModelStreamResult {
  fullStream: AsyncIterable<{ type: string; text?: string; error?: unknown }>;
  response: Promise<{ messages: ModelMessage[] }>;
  finishReason: Promise<string>;
  toolCalls: Promise<Array<{ toolCallId: string; toolName: string; input: unknown }>>;
}

/** Runs one model turn. Overridable in tests with a scripted fake. */
export type ModelRunner = (opts: {
  system: string;
  messages: ModelMessage[];
  tools: ToolSet;
}) => ModelStreamResult;

export interface SessionDeps {
  store: SessionStore;
  registry: ToolRegistry;
  config: Config;
  permission: PermissionManager;
  env?: NodeJS.ProcessEnv;
  /** Override the model call (used by tests). */
  runner?: ModelRunner;
  /** Safety cap on tool-execution rounds per prompt. */
  maxSteps?: number;
}

interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: { type: "text"; value: string };
}

function systemPrompt(cwd: string): string {
  return [
    "You are termcoder, an AI coding agent operating in a terminal.",
    `Working directory: ${cwd}`,
    "Use the provided tools to read and modify files and run shell commands.",
    "Inspect the project before making changes, and keep explanations concise.",
    "When you change files, briefly state what you did.",
  ].join("\n");
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

/**
 * A live conversation with the model. {@link prompt} drives the manual agent
 * loop: stream text, run requested tools through the permission gate, append
 * results, and repeat until the model stops calling tools.
 */
export class Session {
  constructor(
    public readonly record: SessionRecord,
    private readonly deps: SessionDeps,
  ) {}

  static create(deps: SessionDeps, opts: { cwd: string; title?: string }): Session {
    const record = deps.store.create({
      cwd: opts.cwd,
      model: deps.config.model,
      title: opts.title,
    });
    return new Session(record, deps);
  }

  static resume(deps: SessionDeps, id: string): Session {
    return new Session(deps.store.load(id), deps);
  }

  private persist(): void {
    this.deps.store.save(this.record);
  }

  private buildRunner(): ModelRunner {
    const model = resolveModel(this.record.model, {
      config: this.deps.config,
      env: this.deps.env,
    });
    return ({ system, messages, tools }) =>
      streamText({ model, system, messages, tools }) as unknown as ModelStreamResult;
  }

  async *prompt(text: string): AsyncGenerator<SessionEvent, void> {
    const ctx: ToolContext = { cwd: this.record.cwd };
    const tools = this.deps.registry.toToolSet();
    const runner = this.deps.runner ?? this.buildRunner();
    const maxSteps = this.deps.maxSteps ?? 25;

    this.record.messages.push({ role: "user", content: text });
    this.persist();

    try {
      for (let step = 0; step < maxSteps; step++) {
        const result = runner({
          system: systemPrompt(ctx.cwd),
          messages: this.record.messages,
          tools,
        });

        for await (const chunk of result.fullStream) {
          if (chunk.type === "text-delta") {
            yield { type: "text-delta", text: chunk.text ?? "" };
          } else if (chunk.type === "error") {
            yield { type: "error", error: stringifyError(chunk.error) };
            return;
          }
        }

        const response = await result.response;
        this.record.messages.push(...response.messages);

        const finishReason = await result.finishReason;
        if (finishReason !== "tool-calls") {
          this.persist();
          yield { type: "done" };
          return;
        }

        const toolCalls = await result.toolCalls;
        const resultParts: ToolResultPart[] = [];
        for (const call of toolCalls) {
          const part = yield* this.runToolCall(call, ctx);
          resultParts.push(part);
        }
        this.record.messages.push({ role: "tool", content: resultParts } as ModelMessage);
        this.persist();
      }
      yield { type: "error", error: `Stopped after ${maxSteps} tool-execution rounds.` };
    } catch (err) {
      yield { type: "error", error: stringifyError(err) };
    }
  }

  private async *runToolCall(
    call: { toolCallId: string; toolName: string; input: unknown },
    ctx: ToolContext,
  ): AsyncGenerator<SessionEvent, ToolResultPart> {
    const tool = this.deps.registry.get(call.toolName);
    const described = tool?.describe?.(call.input, ctx);
    yield {
      type: "tool-call",
      id: call.toolCallId,
      name: call.toolName,
      args: call.input,
      title: described?.title,
      detail: described?.detail,
    };

    let output: string;
    let isError = false;

    if (!tool) {
      output = `Unknown tool: ${call.toolName}`;
      isError = true;
    } else if (!(await this.allow(tool, call.input, ctx))) {
      output = "Permission denied by the user.";
      isError = true;
    } else {
      try {
        output = (await tool.run(call.input, ctx)).output;
      } catch (err) {
        output = `Error: ${stringifyError(err)}`;
        isError = true;
      }
    }

    yield { type: "tool-result", id: call.toolCallId, name: call.toolName, output, isError };
    return {
      type: "tool-result",
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      output: { type: "text", value: output },
    };
  }

  private async allow(
    tool: NonNullable<ReturnType<ToolRegistry["get"]>>,
    input: unknown,
    ctx: ToolContext,
  ): Promise<boolean> {
    if (tool.readOnly || !tool.permissionKind) return true;
    const described = tool.describe?.(input, ctx) ?? { title: tool.name };
    return this.deps.permission.check({
      toolName: tool.name,
      kind: tool.permissionKind,
      title: described.title,
      detail: described.detail,
    });
  }
}
