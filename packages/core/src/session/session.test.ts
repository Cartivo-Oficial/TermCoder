import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { ModelMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig, type Config } from "../config/config";
import { PermissionManager } from "../permission/permission";
import { SessionStore } from "../storage/storage";
import { ToolRegistry } from "../tools";
import type { TermTool } from "../tools/types";
import { Session, type ModelRunner, type SessionEvent } from "./session";

interface ScriptedStep {
  chunks: Array<{ type: string; text?: string; error?: unknown }>;
  finishReason: string;
  toolCalls?: Array<{ toolCallId: string; toolName: string; input: unknown }>;
  responseMessages?: ModelMessage[];
}

/** A model runner that replays one scripted step per call. */
function scriptedRunner(steps: ScriptedStep[]): ModelRunner {
  let i = 0;
  return () => {
    const step = steps[i++];
    if (!step) throw new Error("scriptedRunner: ran out of steps");
    const chunks = step.chunks;
    async function* stream() {
      for (const chunk of chunks) yield chunk;
    }
    return {
      fullStream: stream(),
      response: Promise.resolve({ messages: step.responseMessages ?? [] }),
      finishReason: Promise.resolve(step.finishReason),
      toolCalls: Promise.resolve(step.toolCalls ?? []),
    };
  };
}

async function collect(session: Session, text: string): Promise<SessionEvent[]> {
  const events: SessionEvent[] = [];
  for await (const event of session.prompt(text)) events.push(event);
  return events;
}

describe("Session agent loop", () => {
  let dir: string;
  let store: SessionStore;
  let registry: ToolRegistry;
  let config: Config;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-session-"));
    store = new SessionStore(join(dir, "sessions"));
    registry = new ToolRegistry();
    config = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env: {} });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeSession(runner: ModelRunner): Session {
    const permission = new PermissionManager(config.permission, async () => "deny");
    return Session.create(
      { store, registry, config, permission, runner },
      { cwd: dir },
    );
  }

  function makeUntitledSession(runner: ModelRunner): Session {
    const permission = new PermissionManager(config.permission, async () => "deny");
    return Session.create(
      { store, registry, config, permission, runner },
      { cwd: dir, title: "Untitled session" },
    );
  }

  it("injects a discovered skill's name+description (not its body) into the system prompt", async () => {
    mkdirSync(join(dir, ".termcoder", "skills"), { recursive: true });
    writeFileSync(
      join(dir, ".termcoder", "skills", "pr-review.md"),
      "---\nname: pr-review\ndescription: Review a pull request\n---\nRead the diff carefully.",
    );
    let captured = "";
    const runner: ModelRunner = (opts) => {
      captured = opts.system;
      async function* stream() {
        yield { type: "text-delta", text: "ok" };
      }
      return {
        fullStream: stream(),
        response: Promise.resolve({ messages: [] }),
        finishReason: Promise.resolve("stop"),
        toolCalls: Promise.resolve([]),
      };
    };
    await collect(makeSession(runner), "help me");
    expect(captured).toContain("pr-review");
    expect(captured).toContain("Review a pull request");
    expect(captured).not.toContain("Read the diff carefully."); // body stays out of the prompt
  });

  it("uses the termexplorer study persona (not the coding brain) for termexplorer/auto", async () => {
    const studyConfig = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env: {} });
    studyConfig.model = "termexplorer/auto";
    let captured = "";
    const runner: ModelRunner = (opts) => {
      captured = opts.system;
      async function* stream() {
        yield { type: "text-delta", text: "ok" };
      }
      return {
        fullStream: stream(),
        response: Promise.resolve({ messages: [] }),
        finishReason: Promise.resolve("stop"),
        toolCalls: Promise.resolve([]),
      };
    };
    const permission = new PermissionManager(studyConfig.permission, async () => "deny");
    const session = Session.create({ store, registry, config: studyConfig, permission, runner }, { cwd: dir });
    await collect(session, "summarize the French Revolution for my exam");
    expect(captured).toContain("termexplorer");
    expect(captured).toContain("study assistant");
    expect(captured).toContain("flashcards");
    expect(captured).not.toContain("senior engineer"); // not the coding brain
  });

  it("injects an auto-detected project map into the system prompt", async () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "d", devDependencies: { typescript: "^5" }, scripts: { test: "vitest" } }),
    );
    let captured = "";
    const runner: ModelRunner = (opts) => {
      captured = opts.system;
      async function* stream() {
        yield { type: "text-delta", text: "ok" };
      }
      return {
        fullStream: stream(),
        response: Promise.resolve({ messages: [] }),
        finishReason: Promise.resolve("stop"),
        toolCalls: Promise.resolve([]),
      };
    };
    await collect(makeSession(runner), "hi");
    expect(captured).toContain("Project map");
    expect(captured).toContain("TypeScript");
  });

  it("auto-escalates to a stronger model once when a termcoder/auto turn errors", async () => {
    const env = { GEMINI_API_KEY: "x" };
    const brainConfig = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env });
    brainConfig.model = "termcoder/auto";
    const runner = scriptedRunner([
      { chunks: [{ type: "error", error: "model overloaded" }], finishReason: "error" },
      {
        chunks: [{ type: "text-delta", text: "recovered on the strong model" }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "recovered on the strong model" }],
      },
    ]);
    const permission = new PermissionManager(brainConfig.permission, async () => "deny");
    const session = Session.create(
      { store, registry, config: brainConfig, permission, runner, env },
      { cwd: dir },
    );
    const events = await collect(session, "add a small helper function");
    const text = events.filter((e) => e.type === "text-delta").map((e) => (e as { text: string }).text).join("");
    expect(text).toContain("retrying with google/gemini-2.5-pro");
    expect(text).toContain("recovered on the strong model");
    expect(events.filter((e) => e.type === "error")).toHaveLength(0); // recovered, no surfaced error
  });

  it("streams text and finishes on a plain answer", async () => {
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "Hello there." }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "Hello there." }],
      },
    ]);
    const session = makeSession(runner);
    const events = await collect(session, "hi");

    expect(events).toEqual([
      { type: "text-delta", text: "Hello there." },
      { type: "done" },
    ]);
    // Persisted: the user prompt plus the assistant reply.
    expect(store.load(session.record.id).messages).toHaveLength(2);
  });

  it("defaults a new session title to its folder name", () => {
    const runner = scriptedRunner([]);
    const session = makeSession(runner);
    expect(session.record.title).toBe(basename(dir));
  });

  it("titles a legacy untitled session from its first prompt", async () => {
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "Sure." }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "Sure." }],
      },
    ]);
    const session = makeUntitledSession(runner);
    expect(session.record.title).toBe("Untitled session");
    await collect(session, "Add a dark mode toggle to the settings page");

    expect(store.load(session.record.id).title).toBe(
      "Add a dark mode toggle to the settings page",
    );
  });

  it("truncates a long first prompt when titling", async () => {
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "ok" }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "ok" }],
      },
    ]);
    const session = makeUntitledSession(runner);
    const long = "Please refactor ".repeat(20);
    await collect(session, long);

    const title = store.load(session.record.id).title;
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("builds a multimodal user message from image attachments", async () => {
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "ok" }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "ok" }],
      },
    ]);
    const session = makeSession(runner);
    for await (const _e of session.prompt("what is this?", {
      attachments: [{ dataUrl: "data:image/png;base64,AAAA", mediaType: "image/png" }],
    })) {
      void _e;
    }

    const userMsg = store.load(session.record.id).messages.find((m) => m.role === "user");
    const parts = userMsg?.content as Array<{ type: string }>;
    expect(Array.isArray(parts)).toBe(true);
    expect(parts[0]).toMatchObject({ type: "text", text: "what is this?" });
    expect(parts[1]).toMatchObject({ type: "image" });
  });

  it("termcoder/auto reviews changes and applies the reviewer's fixes", async () => {
    config.model = "termcoder/auto";
    config.permission.write = "allow";
    let reviewCalls = 0;
    const reviewer = async () => {
      reviewCalls += 1;
      return reviewCalls === 1 ? "Bug: the greeting is wrong, fix it." : "DONE";
    };
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "Creating." }],
        finishReason: "tool-calls",
        toolCalls: [{ toolCallId: "t1", toolName: "write", input: { path: "hi.txt", content: "hi" } }],
        responseMessages: [{ role: "assistant", content: "Creating." }],
      },
      {
        chunks: [{ type: "text-delta", text: "Done." }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "Done." }],
      },
      {
        chunks: [{ type: "text-delta", text: "Fixing." }],
        finishReason: "tool-calls",
        toolCalls: [{ toolCallId: "t2", toolName: "write", input: { path: "hi.txt", content: "hello" } }],
        responseMessages: [{ role: "assistant", content: "Fixing." }],
      },
      {
        chunks: [{ type: "text-delta", text: "Fixed." }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "Fixed." }],
      },
    ]);
    const permission = new PermissionManager(config.permission, async () => "allow");
    const session = Session.create(
      { store, registry, config, permission, runner, reviewer },
      { cwd: dir },
    );
    const events = await collect(session, "make a greeting file");

    expect(reviewCalls).toBe(1); // reviewed once, found a bug → one fix cycle
    const msgs = store.load(session.record.id).messages;
    expect(msgs.some((m) => m.role === "user" && String(m.content).includes("code review"))).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(readFileSync(join(dir, "hi.txt"), "utf8")).toBe("hello"); // fix applied
  });

  it("exposes only read-only tools in plan mode", async () => {
    let seenTools: string[] = [];
    const runner: ModelRunner = ({ tools }) => {
      seenTools = Object.keys(tools);
      return {
        fullStream: (async function* () {})(),
        response: Promise.resolve({ messages: [] }),
        finishReason: Promise.resolve("stop"),
        toolCalls: Promise.resolve([]),
      };
    };
    const permission = new PermissionManager(config.permission, async () => "deny");
    // A read-only-but-delegating tool like `task` must NOT be exposed in plan
    // mode, since its sub-agent would run unrestricted.
    const taskTool: TermTool = {
      name: "task",
      description: "delegate",
      inputSchema: z.object({ prompt: z.string() }),
      readOnly: true,
      run: async () => ({ output: "" }),
    };
    const planRegistry = new ToolRegistry([...registry.list(), taskTool]);
    const session = Session.create(
      { store, registry: planRegistry, config, permission, runner },
      { cwd: dir, mode: "plan" },
    );
    await collect(session, "investigate this");

    expect(seenTools).toEqual(expect.arrayContaining(["read", "ls", "glob", "grep"]));
    expect(seenTools).not.toContain("write");
    expect(seenTools).not.toContain("edit");
    expect(seenTools).not.toContain("bash");
    expect(seenTools).not.toContain("task");
  });

  it("runs an allowed tool call and feeds the result back", async () => {
    config.permission.write = "allow";
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "Creating the file." }],
        finishReason: "tool-calls",
        toolCalls: [
          { toolCallId: "t1", toolName: "write", input: { path: "hello.txt", content: "hi" } },
        ],
        responseMessages: [{ role: "assistant", content: "Creating the file." }],
      },
      {
        chunks: [{ type: "text-delta", text: "Done." }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "Done." }],
      },
    ]);
    const session = makeSession(runner);
    const events = await collect(session, "create hello.txt");

    const call = events.find((e) => e.type === "tool-call");
    const result = events.find((e) => e.type === "tool-result");
    expect(call).toMatchObject({ name: "write" });
    expect(result).toMatchObject({ name: "write", isError: false });
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(readFileSync(join(dir, "hello.txt"), "utf8")).toBe("hi");
  });

  it("reports a denied tool call without running it", async () => {
    config.permission.write = "deny";
    const runner = scriptedRunner([
      {
        chunks: [],
        finishReason: "tool-calls",
        toolCalls: [
          { toolCallId: "t1", toolName: "write", input: { path: "blocked.txt", content: "x" } },
        ],
        responseMessages: [{ role: "assistant", content: "" }],
      },
      {
        chunks: [{ type: "text-delta", text: "Okay, skipped." }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "Okay, skipped." }],
      },
    ]);
    const session = makeSession(runner);
    const events = await collect(session, "create blocked.txt");

    const result = events.find((e) => e.type === "tool-result");
    expect(result).toMatchObject({ isError: true });
    expect(result && "output" in result ? result.output : "").toMatch(/Permission denied/);
    expect(existsSync(join(dir, "blocked.txt"))).toBe(false);
  });

  it("surfaces a stream error", async () => {
    const runner = scriptedRunner([
      {
        chunks: [{ type: "error", error: new Error("boom") }],
        finishReason: "error",
      },
    ]);
    const session = makeSession(runner);
    const events = await collect(session, "fail please");

    expect(events).toEqual([{ type: "error", error: "boom" }]);
  });

  it("stops immediately when the abort signal is already aborted", async () => {
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "should not appear" }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "x" }],
      },
    ]);
    const session = makeSession(runner);
    const events: SessionEvent[] = [];
    for await (const e of session.prompt("hi", { signal: AbortSignal.abort() })) events.push(e);
    expect(events).toEqual([]);
  });
});
