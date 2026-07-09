import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { ModelMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig, type Config } from "../config/config";
import { saveMemory } from "../memory/memory";
import { clearProviderHealth } from "../provider/health";
import { PermissionManager } from "../permission/permission";
import { SessionStore } from "../storage/storage";
import { ToolRegistry } from "../tools";
import type { TermTool } from "../tools/types";
import { Session, friendlyError, type ModelRunner, type SessionEvent } from "./session";

interface ScriptedStep {
  chunks: Array<{ type: string; text?: string; error?: unknown }>;
  finishReason: string;
  toolCalls?: Array<{ toolCallId: string; toolName: string; input: unknown }>;
  responseMessages?: ModelMessage[];
  usage?: Promise<{ inputTokens?: number; outputTokens?: number }>;
}

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
      usage: step.usage,
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
    clearProviderHealth();
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

  it("retries the model on a transient stream error and recovers", async () => {
    let calls = 0;
    const flakyRunner: ModelRunner = () => {
      calls += 1;
      const failing = calls === 1;
      async function* stream() {
        if (failing) yield { type: "error" as const, error: new Error("Cannot connect to API") };
        else yield { type: "text-delta" as const, text: "Recovered." };
      }
      return {
        fullStream: stream(),
        response: Promise.resolve({ messages: [{ role: "assistant", content: "Recovered." }] as ModelMessage[] }),
        finishReason: Promise.resolve("stop"),
        toolCalls: Promise.resolve([]),
      };
    };
    const session = makeSession(flakyRunner);
    const events: string[] = [];
    for await (const e of session.prompt("hi")) events.push(e.type);
    expect(calls).toBe(2); // failed once, retried once
    expect(events).toContain("done");
    expect(events).not.toContain("error");
  });

  it("aborts a silent stream at the idle timeout and retries", async () => {
    const hangConfig = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env: {} });
    hangConfig.reliability = { idleTimeoutMs: 40 };
    let calls = 0;
    const runner: ModelRunner = () => {
      calls += 1;
      const hang = calls === 1;
      async function* stream() {
        if (hang) {
          await new Promise(() => {});
        } else {
          yield { type: "text-delta" as const, text: "recovered" };
        }
      }
      return {
        fullStream: stream(),
        response: Promise.resolve({ messages: [{ role: "assistant", content: "recovered" }] as ModelMessage[] }),
        finishReason: Promise.resolve("stop"),
        toolCalls: Promise.resolve([]),
      };
    };
    const permission = new PermissionManager(hangConfig.permission, async () => "deny");
    const session = Session.create({ store, registry, config: hangConfig, permission, runner }, { cwd: dir });
    const events: string[] = [];
    for await (const e of session.prompt("hello")) events.push(e.type);
    expect(calls).toBe(2);
    expect(events).toContain("done");
    expect(events).not.toContain("error");
  });

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

  it("injects saved memories into the system prompt, and nothing when there are none", async () => {
    const prevXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = join(dir, "xdg"); // isolate user memory from the real machine
    try {
      let captured = "";
      const runner: ModelRunner = (opts) => {
        captured = opts.system;
        async function* stream() { yield { type: "text-delta", text: "ok" }; }
        return { fullStream: stream(), response: Promise.resolve({ messages: [] }), finishReason: Promise.resolve("stop"), toolCalls: Promise.resolve([]) };
      };
      await collect(makeSession(runner), "hi");
      expect(captured).not.toMatch(/What you remember/);

      saveMemory({ scope: "project", name: "arch", description: "monorepo of four packages", type: "project", body: "core, server, tui, desktop", cwd: dir });
      await collect(makeSession(runner), "hi again");
      expect(captured).toMatch(/What you remember/);
      expect(captured).toContain("- arch: monorepo of four packages");
    } finally {
      if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = prevXdg;
    }
  });

  it("the editing system prompt states a plan->act->verify protocol", async () => {
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
    expect(captured).toMatch(/PLAN/);
    expect(captured).toMatch(/VERIFY/);
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
    expect(captured).not.toContain("Files likely relevant");
  });

  it("injects retrieval file pointers for a matching prompt, and nothing otherwise", async () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "src", "billing.ts"),
      "export function processInvoice(customerId: string) {\n  return customerId;\n}\n",
    );
    let captured = "";
    const runner: ModelRunner = (opts) => {
      captured = opts.system;
      async function* stream() { yield { type: "text-delta", text: "ok" }; }
      return { fullStream: stream(), response: Promise.resolve({ messages: [] }), finishReason: Promise.resolve("stop"), toolCalls: Promise.resolve([]) };
    };
    await collect(makeSession(runner), "update the processInvoice billing logic");
    expect(captured).toContain("Files likely relevant");
    expect(captured).toContain("src/billing.ts");

    await collect(makeSession(runner), "qwzx vbnm asdf");
    expect(captured).not.toContain("Files likely relevant");
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

  it("retries and recovers when a termcoder/auto turn errors", async () => {
    const env = { GEMINI_API_KEY: "x" };
    const brainConfig = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env });
    brainConfig.model = "termcoder/auto";
    const runner = scriptedRunner([
      { chunks: [{ type: "error", error: "model overloaded" }], finishReason: "error" },
      {
        chunks: [{ type: "text-delta", text: "recovered after a retry" }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "recovered after a retry" }],
      },
    ]);
    const permission = new PermissionManager(brainConfig.permission, async () => "deny");
    const session = Session.create(
      { store, registry, config: brainConfig, permission, runner, env },
      { cwd: dir },
    );
    const events = await collect(session, "add a small helper function");
    const text = events.filter((e) => e.type === "text-delta").map((e) => (e as { text: string }).text).join("");
    expect(text).toContain("recovered after a retry");
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

  it("connection errors suggest retry or connecting a better model", () => {
    const msg = friendlyError("Cannot connect to API");
    expect(msg).toMatch(/busy|try again/i);
    expect(msg).toMatch(/connect|key|Gemini/i);
  });

  it("timeout errors read as a friendly timeout", () => {
    const msg = friendlyError("The model produced no output for 45s (timed out)");
    expect(msg).toMatch(/timed out/i);
    expect(msg).toMatch(/model|try again/i);
  });

  it("surfaces a stream error after retries are exhausted", async () => {
    const runner = scriptedRunner([
      { chunks: [{ type: "error", error: new Error("boom") }], finishReason: "error" },
      { chunks: [{ type: "error", error: new Error("boom") }], finishReason: "error" },
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

  it("accumulates token usage across turns", async () => {
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "First response." }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "First response." }],
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 3 }),
      },
      {
        chunks: [{ type: "text-delta", text: "Second response." }],
        finishReason: "stop",
        responseMessages: [{ role: "assistant", content: "Second response." }],
        usage: Promise.resolve({ inputTokens: 20, outputTokens: 6 }),
      },
    ]);
    const session = makeSession(runner);
    await collect(session, "first prompt");
    expect(session.record.usage).toEqual({ tokensIn: 10, tokensOut: 3 });

    await collect(session, "second prompt");
    expect(session.record.usage).toEqual({ tokensIn: 30, tokensOut: 9 });
  });

  it("persists token usage even when a later step errors out", async () => {
    config.permission.write = "allow";
    const runner = scriptedRunner([
      {
        chunks: [{ type: "text-delta", text: "Writing." }],
        finishReason: "tool-calls",
        toolCalls: [{ toolCallId: "t1", toolName: "write", input: { path: "note.txt", content: "hi" } }],
        responseMessages: [{ role: "assistant", content: "Writing." }],
        usage: Promise.resolve({ inputTokens: 15, outputTokens: 4 }),
      },
      {
        chunks: [
          { type: "text-delta", text: "partial" },
          { type: "error", error: new Error("stream blew up") },
        ],
        finishReason: "stop",
      },
    ]);
    const permission = new PermissionManager(config.permission, async () => "allow");
    const session = Session.create({ store, registry, config, permission, runner }, { cwd: dir });
    const events = await collect(session, "write a note");
    expect(events.some((e) => e.type === "error")).toBe(true);
    expect(session.record.usage).toEqual({ tokensIn: 15, tokensOut: 4 });
  });
});
