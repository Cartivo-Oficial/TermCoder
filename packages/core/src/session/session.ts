import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { generateText, streamText, type ModelMessage, type ToolSet } from "ai";
import { agentCanMutate, agentToolFilter, resolveAgent, type AgentDef } from "../agent/agents";
import { CheckpointManager, checkpointDir } from "../checkpoint/checkpoint";
import { formatFile } from "../format/formatters";
import type { Config } from "../config/config";
import type { PermissionManager } from "../permission/permission";
import { classifyTaskComplexity, pickAutoModel, resolveModel } from "../provider/provider";
import { firstKeyedModel, nextModelOnError, streamWithIdleTimeout, MODEL_RETRIES, type RetryState } from "../provider/reliability";
import { markProvider } from "../provider/health";
import { projectSummary } from "../knowledge/repomap";
import { buildRetrievalIndex, retrievalContext, type RetrievalIndex } from "../knowledge/retrieval";
import { buildSymbolIndex, type SymbolEntry } from "../knowledge/symbols";
import type { SessionStore, SessionRecord } from "../storage/storage";
import type { ToolContext } from "../tools/types";
import type { ToolRegistry } from "../tools";
import { loadProjectContext } from "../util/context";
import { capText, pruneMessagesForModel } from "../util/tokens";
import { discoverSkills, skillsMenu } from "../skill/skills";
import { discoverMemories, recallMemories } from "../memory/memory";
import { ensureFreshClaudeConfig } from "../auth/oauth";
import { ensureFreshChatGPTConfig } from "../auth/chatgpt-oauth";

export type SessionEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; id: string; name: string; args: unknown; title?: string; detail?: string }
  | { type: "tool-result"; id: string; name: string; output: string; isError: boolean }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "done" }
  | { type: "error"; error: string };

export interface ModelStreamResult {
  fullStream: AsyncIterable<{ type: string; text?: string; error?: unknown }>;
  response: Promise<{ messages: ModelMessage[] }>;
  finishReason: Promise<string>;
  toolCalls: Promise<Array<{ toolCallId: string; toolName: string; input: unknown }>>;
  usage?: Promise<{ inputTokens?: number; outputTokens?: number } | undefined>;
}

export type ModelRunner = (opts: {
  system: string;
  messages: ModelMessage[];
  tools: ToolSet;
  signal?: AbortSignal;
}) => ModelStreamResult;

export interface SessionDeps {
  store: SessionStore;
  registry: ToolRegistry;
  config: Config;
  permission: PermissionManager;
  env?: NodeJS.ProcessEnv;
  runner?: ModelRunner;
  reviewer?: () => Promise<string>;
  maxSteps?: number;
}

interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: { type: "text"; value: string };
}

type Persona = "coder" | "study";

function systemPrompt(cwd: string, agent: AgentDef, persona?: Persona): string {
  if (persona === "study") {
    const lines = [
      "You are termexplorer, a friendly and patient study assistant for students.",
      `Working directory: ${cwd}`,
      "Your job is to help students genuinely learn and get their schoolwork done well. On any request:",
      "- EXPLAIN clearly and step by step in plain language; define terms and give concrete examples or analogies.",
      "- Adapt to the student's level and subject; check their understanding and invite follow-up questions.",
      "- For problems and homework, show the reasoning and the worked steps so they can follow and learn it —",
      "  not just the final answer. Encourage them to attempt it, and correct mistakes kindly.",
      "- SUMMARIZE notes, texts or topics into clear, structured outlines with the key points and takeaways.",
      "- Make STUDY AIDS on request: flashcards (Q/A pairs), practice questions with answers, mind-map outlines,",
      "  essay outlines, and study plans or revision schedules.",
      "- When facts matter (dates, science, definitions, current events), use web search and cite your sources.",
      "- You can read files the student shares (notes, PDFs) and save a summary or study guide to a file when asked.",
      "  You generally don't need to run shell commands.",
      "Be warm, encouraging and concise. Use headings and bullet points so the material is easy to study from,",
      "and reply in the student's language. Help them understand the material and do their own best work honestly.",
      "If a defined skill matches the task, load it with the `skill` tool before proceeding.",
    ];
    if (agent.prompt) lines.push("", `Instructions for the "${agent.name}" agent:`, agent.prompt);
    const ctx = loadProjectContext(cwd);
    if (ctx) lines.push("", "Project/user notes to respect:", ctx);
    return lines.join("\n");
  }

  const lines = [
    "You are termcoder, an AI coding agent operating in a terminal.",
    `Working directory: ${cwd}`,
    "Be economical with context: read only what you need, prefer targeted greps and",
    "line-ranged reads over dumping whole files, and don't re-read files you've already",
    "seen unless they changed. Fewer, sharper tool calls save the user's tokens.",
  ];
  if (persona === "coder") {
    lines.push(
      "You are running as termcoder/auto — the orchestrator brain. Work like a senior engineer:",
      "1. UNDERSTAND — start from the project map below; call the `repomap` tool if the codebase is",
      "   unfamiliar, then use targeted grep/read on the exact code you'll touch. For broad, read-only",
      '   exploration, delegate to a sub-agent via the `task` tool (agent "explore" or "scout") so your',
      "   own context stays lean.",
      "2. PLAN — outline the smallest correct change and the files involved before editing.",
      "3. SELF-CRITIQUE — challenge your own plan first: what could break, which edge cases, is there a",
      "   simpler approach? Adjust before touching code.",
      "4. EXECUTE — make minimal diffs that match the existing style; never invent APIs — verify they",
      "   exist before using them.",
      "5. VERIFY — run the project's build/test/typecheck scripts (or re-read) to confirm, and fix what",
      "   you broke.",
      "6. REPORT — state what changed and why, concisely.",
      "Delegate whole sub-tasks to specialists via `task` to keep each phase focused and your",
      'context lean: "architect" (design a plan), "tester" (write & run tests), "debugger"',
      '(root-cause a failure), "reviewer" (critique a change), "explore"/"scout" (read-only research).',
      "If a defined skill matches the task, load it with the `skill` tool before proceeding.",
    );
  }
  if (!agentCanMutate(agent)) {
    lines.push(
      `You are the "${agent.name}" agent: read-only. You can inspect files and search,`,
      "but you cannot edit files or run commands. Investigate the request and reply with",
      "a clear, concrete plan (steps, files to change, risks). Do not claim you made",
      "changes — propose them so the user can switch to a Build-capable agent to apply them.",
    );
  } else {
    lines.push(
      "Use the provided tools to read and modify files and run shell commands.",
      "Inspect the project before making changes, and keep explanations concise.",
      "When you change files, briefly state what you did.",
      "Work in a tight loop: PLAN briefly, ACT with minimal diffs, then VERIFY (run the build/tests).",
      "Prefer small, correct changes. If unsure, read the relevant file before editing. Don't invent APIs — check first.",
      "Save a durable, high-value fact you learn (a convention, an architectural truth, a stated preference, a decision) with the memory tool — few and specific, never secrets.",
    );
  }
  lines.push(
    "",
    "Always talk to the user directly and conversationally — you are answering a person, not",
    "narrating to yourself. Finish every turn with a short first-person wrap-up (2–4 lines):",
    'lead with the outcome (e.g. "Done — I added X and updated Y" or "Here\'s the analysis:"),',
    "then the key points and, when useful, a recommendation or next step. Keep it confident and",
    "concise so the user can trust the result at a glance. Never end on a bare tool result.",
  );
  if (agent.prompt) {
    lines.push("", `Instructions for the "${agent.name}" agent:`, agent.prompt);
  }
  const projectContext = loadProjectContext(cwd);
  if (projectContext) {
    lines.push(
      "",
      "The project provides these instructions — follow them closely:",
      "<project-instructions>",
      projectContext,
      "</project-instructions>",
    );
  }
  return lines.join("\n");
}

function folderName(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "session";
}

function isDefaultTitle(title: string): boolean {
  return !title.trim() || title === "Untitled session";
}

function deriveTitle(text: string): string {
  const firstLine = text.replace(/\s+/g, " ").trim();
  if (!firstLine) return "Untitled session";
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

export function friendlyError(raw: string): string {
  const s = raw.toLowerCase();
  if (
    s.includes("credit balance") ||
    s.includes("billing") ||
    s.includes("insufficient_quota") ||
    s.includes("insufficient funds") ||
    s.includes("payment")
  ) {
    return "This provider account has no credits/billing set up, so it rejected the request. Add credits to the provider, or switch to another model — a local Ollama model runs free with no quota.";
  }
  if (
    s.includes("quota") ||
    s.includes("rate limit") ||
    s.includes("429") ||
    s.includes("resource_exhausted") ||
    s.includes("too many requests")
  ) {
    return "Rate limit or quota reached for this model (free tiers reset after a while). Wait a moment and retry, or switch to another model.";
  }
  if (
    s.includes("invalid x-api-key") ||
    s.includes("incorrect api key") ||
    s.includes("unauthorized") ||
    s.includes("401") ||
    s.includes("authentication")
  ) {
    return (
      "The API key for this provider is missing or invalid. Check it in Settings → Providers." +
      " (If you're signed in with a Claude subscription, run /login-claude again — the session may have expired.)"
    );
  }
  if (
    s.includes("fetch failed") ||
    s.includes("enotfound") ||
    s.includes("econnrefused") ||
    s.includes("connection refused") ||
    s.includes("cannot connect") ||
    s.includes("connect to api") ||
    s.includes("connect error") ||
    s.includes("network")
  ) {
    return "The free model is busy or unreachable right now. Try again in a moment — or connect a better model for fast, reliable answers: a free Gemini key (/upgrade), a local Ollama (https://ollama.com), or paste a provider key in Settings → Providers.";
  }
  if (s.includes("timed out") || s.includes("timeout") || s.includes("aborted")) {
    return "The model timed out without responding. Try again, switch models with /model, or connect a faster provider (/upgrade).";
  }
  return raw;
}

function healthIdOf(modelId: string): string {
  const provider = modelId.slice(0, Math.max(0, modelId.indexOf("/")));
  return provider === "termcoderfree" ? "pollinations" : provider;
}

export class Session {
  private _checkpoint?: CheckpointManager;
  private _retrievalIndex?: RetrievalIndex;
  private _symbolIndex?: SymbolEntry[];

  constructor(
    public readonly record: SessionRecord,
    private readonly deps: SessionDeps,
  ) {}

  private get checkpoint(): CheckpointManager {
    if (!this._checkpoint) {
      this._checkpoint = new CheckpointManager(checkpointDir(this.record.cwd, this.record.id));
    }
    return this._checkpoint;
  }

  static create(
    deps: SessionDeps,
    opts: {
      cwd: string;
      title?: string;
      mode?: "build" | "plan";
      agent?: string;
      temperature?: number;
      maxSteps?: number;
    },
  ): Session {
    const record = deps.store.create({
      cwd: opts.cwd,
      model: deps.config.model,
      title: opts.title ?? folderName(opts.cwd),
      mode: opts.mode,
      agent: opts.agent ?? opts.mode,
      temperature: opts.temperature,
      maxSteps: opts.maxSteps,
    });
    return new Session(record, deps);
  }

  static resume(deps: SessionDeps, id: string): Session {
    return new Session(deps.store.load(id), deps);
  }

  private persist(): void {
    this.deps.store.save(this.record);
  }

  private buildRunner(agent: AgentDef, modelOverride?: string): ModelRunner {
    const model = resolveModel(modelOverride ?? agent.model ?? this.record.model, {
      config: this.deps.config,
      env: this.deps.env,
    });
    const temperature = agent.temperature ?? this.record.temperature;
    return ({ system, messages, tools, signal }) =>
      streamText({
        model,
        system,
        messages,
        tools,
        temperature,
        abortSignal: signal,
      }) as unknown as ModelStreamResult;
  }

  private async reviewChanges(): Promise<string> {
    try {
      const diff =
        spawnSync("git", ["diff", "--no-color"], {
          cwd: this.record.cwd,
          encoding: "utf8",
          maxBuffer: 5_000_000,
        }).stdout ?? "";
      if (!diff.trim()) return "DONE";
      const model = resolveModel(this.record.model, {
        config: this.deps.config,
        env: this.deps.env,
      });
      const { text } = await generateText({
        model,
        system:
          "You are a strict senior code reviewer. Review ONLY for correctness bugs, missed edge " +
          "cases, broken logic, or incomplete changes — ignore style and nits. If the diff is correct " +
          "and complete, reply with exactly DONE. Otherwise list the concrete problems as short bullets " +
          "with what to fix.",
        messages: [{ role: "user", content: `Review this diff:\n\n${diff.slice(0, 30_000)}` }],
      });
      return text.trim() || "DONE";
    } catch {
      return "DONE";
    }
  }

  async *prompt(
    text: string,
    opts: {
      signal?: AbortSignal;
      attachments?: Array<{ dataUrl: string; mediaType: string }>;
    } = {},
  ): AsyncGenerator<SessionEvent, void> {
    const ctx: ToolContext = { cwd: this.record.cwd };
    if (this.deps.config.providers.anthropic?.oauth) {
      await ensureFreshClaudeConfig(this.deps.config);
    }
    if (this.deps.config.providers.openai?.oauth) {
      await ensureFreshChatGPTConfig(this.deps.config);
    }
    const agent = resolveAgent(
      { config: this.deps.config, cwd: this.record.cwd, env: this.deps.env },
      this.record.agent ?? this.record.mode,
    );
    const tools = this.deps.registry.toToolSet(agentToolFilter(agent));
    this.deps.permission.setAgentPermission(agent.permission);

    const coderBrain = this.record.model.startsWith("termcoder/");
    const studyBrain = this.record.model.startsWith("termexplorer/");
    const brain = coderBrain || studyBrain;
    const persona: Persona | undefined = coderBrain ? "coder" : studyBrain ? "study" : undefined;
    const routedModel =
      brain && !agent.model
        ? pickAutoModel(this.deps.config, this.deps.env, classifyTaskComplexity(text))
        : undefined;
    let activeRunner = this.deps.runner ?? this.buildRunner(agent, routedModel);
    let modelToUse = routedModel ?? this.record.model;
    const maxSteps = agent.steps ?? this.record.maxSteps ?? this.deps.maxSteps ?? 25;
    const { signal } = opts;

    const orchestrate = coderBrain && agentCanMutate(agent);
    let reviewsLeft = orchestrate ? 1 : 0;

    const skillMenu = skillsMenu(discoverSkills({ cwd: ctx.cwd, env: this.deps.env }));
    const repoSummary = projectSummary(ctx.cwd);
    const memoryRecall = recallMemories(
      discoverMemories({ cwd: ctx.cwd, env: this.deps.env }),
      this.deps.config.context?.memoryChars ?? 4000,
    );

    let retrievalHints = "";
    if (persona !== "study") {
      this._retrievalIndex ??= buildRetrievalIndex(ctx.cwd);
      this._symbolIndex ??= buildSymbolIndex(ctx.cwd);
      retrievalHints = retrievalContext(
        this._retrievalIndex,
        this._symbolIndex,
        text,
        this.deps.config.context?.retrievalFiles ?? 8,
      );
    }

    if (this.record.messages.length === 0 && isDefaultTitle(this.record.title)) {
      this.record.title = deriveTitle(text);
    }

    const attachments = opts.attachments ?? [];
    if (attachments.length > 0) {
      const content = [
        { type: "text" as const, text },
        ...attachments.map((a) => ({ type: "image" as const, image: a.dataUrl })),
      ];
      this.record.messages.push({ role: "user", content } as ModelMessage);
    } else {
      this.record.messages.push({ role: "user", content: text });
    }
    this.persist();

    this.checkpoint.begin();

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for (let step = 0; step < maxSteps; step++) {
        if (signal?.aborted) return;
        let attempt: RetryState = {
          model: modelToUse,
          retriesLeft: MODEL_RETRIES,
          fallback: firstKeyedModel(this.deps.config, this.deps.env ?? process.env),
        };
        let result!: ModelStreamResult;
        let stepFailed = false;

        while (true) {
          const attemptAbort = new AbortController();
          const attemptSignal = signal ? AbortSignal.any([signal, attemptAbort.signal]) : attemptAbort.signal;
          result = activeRunner({
            system:
              systemPrompt(ctx.cwd, agent, persona) +
              (persona !== "study" && repoSummary ? `\n\n${repoSummary}` : "") +
              (memoryRecall ? `\n\n${memoryRecall}` : "") +
              (retrievalHints ? `\n\n${retrievalHints}` : "") +
              (skillMenu ? `\n\n${skillMenu}` : ""),
            messages: pruneMessagesForModel(
              this.record.messages,
              this.deps.config.context?.keepRecentToolResults ?? 6,
            ),
            tools,
            signal: attemptSignal,
          });

          const idleMs = this.deps.config.reliability?.idleTimeoutMs ?? 45000;
          let streamError: string | null = null;
          let emittedText = false;
          for await (const chunk of streamWithIdleTimeout(result.fullStream, idleMs, () => attemptAbort.abort())) {
            if (chunk.type === "text-delta") {
              emittedText = true;
              yield { type: "text-delta", text: (chunk as { text?: string }).text ?? "" };
            } else if (chunk.type === "error") {
              if (signal?.aborted) return;
              streamError = friendlyError(stringifyError((chunk as { error?: unknown }).error));
              break;
            }
          }

          if (!streamError) {
            markProvider(healthIdOf(modelToUse), true);
            break;
          }
          markProvider(healthIdOf(modelToUse), false, streamError);

          const next = emittedText ? null : nextModelOnError(attempt);
          if (!next) {
            yield { type: "error", error: streamError };
            stepFailed = true;
            break;
          }
          attempt = next;
          if (attempt.model !== modelToUse) {
            activeRunner = this.deps.runner ?? this.buildRunner(agent, attempt.model);
            modelToUse = attempt.model;
            yield { type: "text-delta", text: `\n\n⚠️ Switching to ${attempt.model}…\n\n` };
          }
        }
        if (stepFailed) return;

        const response = await result.response;
        this.record.messages.push(...response.messages);

        if (result.usage) {
          try {
            const usage = await result.usage;
            inputTokens += usage?.inputTokens ?? 0;
            outputTokens += usage?.outputTokens ?? 0;
          } catch {
          }
        }

        const finishReason = await result.finishReason;
        if (finishReason !== "tool-calls") {
          if (orchestrate && reviewsLeft > 0 && this.checkpoint.hasPending() && !signal?.aborted) {
            reviewsLeft -= 1;
            yield { type: "text-delta", text: "\n\n🔎 Reviewing changes…\n" };
            const review = this.deps.reviewer ? await this.deps.reviewer() : await this.reviewChanges();
            if (review && !/^done\b/i.test(review) && review.length > 4) {
              yield { type: "text-delta", text: `${review}\n\n_Fixing the review's findings…_\n\n` };
              this.record.messages.push({
                role: "user",
                content: `A code review of your changes found issues. Fix them, then stop:\n${review}`,
              });
              this.persist();
              continue; // another execution round to apply the fixes
            }
            yield { type: "text-delta", text: "✓ Review passed.\n" };
          }
          this.persist();
          this.checkpoint.commit(String(this.record.messages.length));
          if (inputTokens || outputTokens) yield { type: "usage", inputTokens, outputTokens };
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
      if (signal?.aborted || (err as Error)?.name === "AbortError") return;
      yield { type: "error", error: friendlyError(stringifyError(err)) };
    } finally {
      if (inputTokens || outputTokens) {
        const prev = this.record.usage ?? { tokensIn: 0, tokensOut: 0 };
        this.record.usage = { tokensIn: prev.tokensIn + inputTokens, tokensOut: prev.tokensOut + outputTokens };
        this.persist();
      }
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
      if (tool.permissionKind === "write" || tool.permissionKind === "edit") {
        const inputPath = (call.input as { path?: unknown }).path;
        if (typeof inputPath === "string") {
          this.checkpoint.capture(join(ctx.cwd, inputPath));
        }
      }
      try {
        output = (await tool.run(call.input, ctx)).output;
        if (tool.permissionKind === "write" || tool.permissionKind === "edit") {
          const editedPath = (call.input as { path?: unknown }).path;
          if (typeof editedPath === "string") {
            try {
              formatFile(this.deps.config, join(ctx.cwd, editedPath), ctx.cwd);
            } catch {
            }
          }
        }
      } catch (err) {
        output = `Error: ${stringifyError(err)}`;
        isError = true;
      }
    }

    yield { type: "tool-result", id: call.toolCallId, name: call.toolName, output, isError };
    const cap = this.deps.config.context?.maxToolOutputChars ?? 8000;
    return {
      type: "tool-result",
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      output: { type: "text", value: capText(output, cap) },
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
      target: tool.target?.(input, ctx),
    });
  }
}
