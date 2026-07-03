import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { generateText, streamText, type ModelMessage, type ToolSet } from "ai";
import { agentCanMutate, agentToolFilter, resolveAgent, type AgentDef } from "../agent/agents";
import { CheckpointManager, checkpointDir } from "../checkpoint/checkpoint";
import { formatFile } from "../format/formatters";
import type { Config } from "../config/config";
import type { PermissionManager } from "../permission/permission";
import { classifyTaskComplexity, pickAutoModel, resolveModel } from "../provider/provider";
import { projectSummary } from "../knowledge/repomap";
import type { SessionStore, SessionRecord } from "../storage/storage";
import type { ToolContext } from "../tools/types";
import type { ToolRegistry } from "../tools";
import { loadProjectContext } from "../util/context";
import { capText, pruneMessagesForModel } from "../util/tokens";
import { discoverSkills, skillsMenu } from "../skill/skills";

/** Events emitted while a turn runs. The client renders these; the core stays UI-agnostic. */
export type SessionEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; id: string; name: string; args: unknown; title?: string; detail?: string }
  | { type: "tool-result"; id: string; name: string; output: string; isError: boolean }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "done" }
  | { type: "error"; error: string };

/** Minimal shape the session needs from a model call — satisfied by AI SDK `streamText`. */
export interface ModelStreamResult {
  fullStream: AsyncIterable<{ type: string; text?: string; error?: unknown }>;
  response: Promise<{ messages: ModelMessage[] }>;
  finishReason: Promise<string>;
  toolCalls: Promise<Array<{ toolCallId: string; toolName: string; input: unknown }>>;
  usage?: Promise<{ inputTokens?: number; outputTokens?: number } | undefined>;
}

/** Runs one model turn. Overridable in tests with a scripted fake. */
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
  /** Override the model call (used by tests). */
  runner?: ModelRunner;
  /** Override the termcoder/auto review pass (used by tests). */
  reviewer?: () => Promise<string>;
  /** Safety cap on tool-execution rounds per prompt. */
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
  // termexplorer — the study assistant persona. A friendly tutor rather than a
  // coding agent, for students doing schoolwork, summaries and revision.
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

/** Last path segment of a working directory, used as a default session title. */
function folderName(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "session";
}

function isDefaultTitle(title: string): boolean {
  return !title.trim() || title === "Untitled session";
}

/** First line of the prompt, trimmed to a short, single-line session label. */
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

/** Turn a raw provider error into something actionable for the user. */
function friendlyError(raw: string): string {
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
    return "The API key for this provider is missing or invalid. Check it in Settings → Providers.";
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
    return "Couldn't reach the model. If you're using a local model, make sure Ollama is installed and running (https://ollama.com) and the model is pulled (e.g. `ollama pull llama3.1`). Otherwise connect a provider key in Settings → Providers (or run /setup) and pick a model.";
  }
  return raw;
}

/**
 * A live conversation with the model. {@link prompt} drives the manual agent
 * loop: stream text, run requested tools through the permission gate, append
 * results, and repeat until the model stops calling tools.
 */
export class Session {
  private _checkpoint?: CheckpointManager;

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
      // Default a new session to its working-folder name so the sidebar is
      // meaningful immediately; the user can rename it afterwards.
      title: opts.title ?? folderName(opts.cwd),
      // `agent` supersedes the legacy `mode`; keep both for back-compat.
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

  /**
   * The termcoder/auto reviewer: a grounded second opinion over the working-tree
   * diff. Returns "DONE" when the change looks correct, or a list of concrete
   * problems to fix. Best-effort — any failure just approves.
   */
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
      /** Image attachments (data URLs) to send alongside the text. */
      attachments?: Array<{ dataUrl: string; mediaType: string }>;
    } = {},
  ): AsyncGenerator<SessionEvent, void> {
    const ctx: ToolContext = { cwd: this.record.cwd };
    // Resolve the active agent (built-in or custom). It decides the model,
    // system prompt, permitted tools and step budget for this turn.
    const agent = resolveAgent(
      { config: this.deps.config, cwd: this.record.cwd, env: this.deps.env },
      this.record.agent ?? this.record.mode,
    );
    // The agent's tool filter enforces allowlists + permission denies, and
    // withholds `task` from read-only agents so they can't bypass via a subagent.
    const tools = this.deps.registry.toToolSet(agentToolFilter(agent));
    // Apply the agent's (possibly glob-scoped) permission overrides for this turn.
    this.deps.permission.setAgentPermission(agent.permission);

    const coderBrain = this.record.model.startsWith("termcoder/");
    const studyBrain = this.record.model.startsWith("termexplorer/");
    const brain = coderBrain || studyBrain;
    const persona: Persona | undefined = coderBrain ? "coder" : studyBrain ? "study" : undefined;
    // Our brains route by task complexity: a fast model for simple asks, the
    // strongest available for hard/complex ones.
    const routedModel =
      brain && !agent.model
        ? pickAutoModel(this.deps.config, this.deps.env, classifyTaskComplexity(text))
        : undefined;
    let activeRunner = this.deps.runner ?? this.buildRunner(agent, routedModel);
    const maxSteps = agent.steps ?? this.record.maxSteps ?? this.deps.maxSteps ?? 25;
    const { signal } = opts;
    // Auto-escalation: if a fast-tier termcoder/auto turn errors, retry once on
    // the strongest available model before giving up.
    const canEscalate = brain && !agent.model;
    let escalated = false;

    // termcoder/auto adds a grounded review pass after it edits files (coding
    // only). One review-fix cycle per turn.
    const orchestrate = coderBrain && agentCanMutate(agent);
    let reviewsLeft = orchestrate ? 1 : 0;

    // Progressive disclosure: only skill names + descriptions go in the prompt;
    // the agent loads a full skill body via the `skill` tool when it's relevant.
    const skillMenu = skillsMenu(discoverSkills({ cwd: ctx.cwd, env: this.deps.env }));
    // A short, always-on grounding block so the agent starts with real knowledge
    // of the project's shape (the repomap tool gives the full detail on demand).
    const repoSummary = projectSummary(ctx.cwd);

    // Derive a human title from the first prompt so the sidebar isn't a wall
    // of "Untitled session".
    if (this.record.messages.length === 0 && isDefaultTitle(this.record.title)) {
      this.record.title = deriveTitle(text);
    }

    const attachments = opts.attachments ?? [];
    if (attachments.length > 0) {
      // Multimodal message: text plus one image part per attachment. Models
      // without vision will error, surfaced through friendlyError.
      const content = [
        { type: "text" as const, text },
        ...attachments.map((a) => ({ type: "image" as const, image: a.dataUrl })),
      ];
      this.record.messages.push({ role: "user", content } as ModelMessage);
    } else {
      this.record.messages.push({ role: "user", content: text });
    }
    this.persist();

    // Snapshot files this turn touches, so it can be reverted as one unit.
    this.checkpoint.begin();

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for (let step = 0; step < maxSteps; step++) {
        if (signal?.aborted) return;
        const result = activeRunner({
          system:
            systemPrompt(ctx.cwd, agent, persona) +
            (persona !== "study" && repoSummary ? `\n\n${repoSummary}` : "") +
            (skillMenu ? `\n\n${skillMenu}` : ""),
          // Send a token-frugal view: full record, but older tool outputs elided.
          messages: pruneMessagesForModel(
            this.record.messages,
            this.deps.config.context?.keepRecentToolResults ?? 6,
          ),
          tools,
          signal,
        });

        let streamError: string | null = null;
        for await (const chunk of result.fullStream) {
          if (chunk.type === "text-delta") {
            yield { type: "text-delta", text: chunk.text ?? "" };
          } else if (chunk.type === "error") {
            if (signal?.aborted) return;
            streamError = friendlyError(stringifyError(chunk.error));
            break;
          }
        }
        if (streamError) {
          // Retry once on a stronger model before surfacing the error.
          if (canEscalate && !escalated) {
            const strong = pickAutoModel(this.deps.config, this.deps.env, "complex");
            if (strong !== routedModel) {
              escalated = true;
              activeRunner = this.deps.runner ?? this.buildRunner(agent, strong);
              yield { type: "text-delta", text: `\n\n⚠️ That model struggled — retrying with ${strong}…\n\n` };
              continue; // redo this step on the escalated model
            }
          }
          yield { type: "error", error: streamError };
          return;
        }

        const response = await result.response;
        this.record.messages.push(...response.messages);

        if (result.usage) {
          try {
            const usage = await result.usage;
            inputTokens += usage?.inputTokens ?? 0;
            outputTokens += usage?.outputTokens ?? 0;
          } catch {
            // usage is best-effort
          }
        }

        const finishReason = await result.finishReason;
        if (finishReason !== "tool-calls") {
          // termcoder/auto: review the diff once before finishing; if the
          // reviewer flags real problems, feed them back for one fix round.
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
      // Snapshot the target file before a write/edit so the turn can be reverted.
      if (tool.permissionKind === "write" || tool.permissionKind === "edit") {
        const inputPath = (call.input as { path?: unknown }).path;
        if (typeof inputPath === "string") {
          this.checkpoint.capture(join(ctx.cwd, inputPath));
        }
      }
      try {
        output = (await tool.run(call.input, ctx)).output;
        // Auto-format the edited file if formatters are enabled (best-effort).
        if (tool.permissionKind === "write" || tool.permissionKind === "edit") {
          const editedPath = (call.input as { path?: unknown }).path;
          if (typeof editedPath === "string") {
            try {
              formatFile(this.deps.config, join(ctx.cwd, editedPath), ctx.cwd);
            } catch {
              /* formatting never blocks or fails an edit */
            }
          }
        }
      } catch (err) {
        output = `Error: ${stringifyError(err)}`;
        isError = true;
      }
    }

    // The UI event carries the full output; the copy stored for the model is
    // capped so one big read/command can't bloat every later turn.
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
