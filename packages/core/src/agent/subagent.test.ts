import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, type Config } from "../config/config";
import { PermissionManager } from "../permission/permission";
import { SessionStore } from "../storage/storage";
import { ToolRegistry } from "../tools";
import type { ModelRunner, SessionEvent } from "../session/session";
import type { AgentSpec } from "../acp/registry";
import type { PermissionAsk, RunAgentOptions } from "../acp/run";
import { agentFailure, createSubagentTool } from "./subagent";

interface Step {
  chunks: Array<{ type: string; text?: string }>;
  finishReason: string;
  toolCalls?: Array<{ toolCallId: string; toolName: string; input: unknown }>;
  responseMessages?: ModelMessage[];
}

function scriptedRunner(steps: Step[]): ModelRunner {
  let i = 0;
  return () => {
    const step = steps[i++]!;
    const chunks = step.chunks;
    async function* stream() {
      for (const c of chunks) yield c;
    }
    return {
      fullStream: stream(),
      response: Promise.resolve({ messages: step.responseMessages ?? [] }),
      finishReason: Promise.resolve(step.finishReason),
      toolCalls: Promise.resolve(step.toolCalls ?? []),
    };
  };
}

describe("createSubagentTool", () => {
  let dir: string;
  let store: SessionStore;
  let registry: ToolRegistry;
  let config: Config;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-subagent-"));
    store = new SessionStore(join(dir, "sessions"));
    registry = new ToolRegistry();
    config = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env: {} });
  });
  afterEach(() => {
    try {
      store.close();
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  });

  function tool(runner: ModelRunner) {
    const permission = new PermissionManager(config.permission, async () => "deny");
    return createSubagentTool({
      store,
      registry,
      config,
      permission,
      runner,
      discoverAgents: () => [],
    });
  }

  it("runs a sub-agent and returns its text", async () => {
    const t = tool(
      scriptedRunner([
        {
          chunks: [{ type: "text-delta", text: "Investigated and found the bug." }],
          finishReason: "stop",
          responseMessages: [{ role: "assistant", content: "Investigated and found the bug." }],
        },
      ]),
    );
    const res = await t.run({ prompt: "find the bug" }, { cwd: dir });
    expect(res.output).toContain("Investigated and found the bug.");
    expect(store.list()).toHaveLength(1);
  });

  it("lets the sub-agent use tools and reports them", async () => {
    config.permission.write = "allow";
    const t = tool(
      scriptedRunner([
        {
          chunks: [{ type: "text-delta", text: "Creating it." }],
          finishReason: "tool-calls",
          toolCalls: [
            { toolCallId: "t1", toolName: "write", input: { path: "out.txt", content: "ok" } },
          ],
          responseMessages: [{ role: "assistant", content: "Creating it." }],
        },
        {
          chunks: [{ type: "text-delta", text: "Created the file." }],
          finishReason: "stop",
          responseMessages: [{ role: "assistant", content: "Created the file." }],
        },
      ]),
    );
    const res = await t.run({ prompt: "create out.txt" }, { cwd: dir });
    expect(res.output).toContain("Created the file.");
    expect(res.output).toContain("tools used: write");
    expect(res.meta?.toolsUsed).toEqual(["write"]);
    expect(existsSync(join(dir, "out.txt"))).toBe(true);
    expect(readFileSync(join(dir, "out.txt"), "utf8")).toBe("ok");
  });

  it("is auto-allowed and named 'task'", () => {
    const t = tool(scriptedRunner([]));
    expect(t.name).toBe("task");
    expect(t.readOnly).toBe(true);
    expect(registry.get("task")).toBeUndefined();
  });

  it("emits start, forwards tagged sub-events, and emits end", async () => {
    const t = tool(
      scriptedRunner([
        {
          chunks: [
            { type: "reasoning-delta", text: "thinking" },
            { type: "text-delta", text: "hello from sub" },
          ],
          finishReason: "stop",
          responseMessages: [{ role: "assistant", content: "hello from sub" }],
        },
      ]),
    );
    const events: SessionEvent[] = [];
    const res = await t.run(
      { prompt: "do a thing", agent: "general" },
      { cwd: dir, toolCallId: "call-1", emit: (e) => events.push(e) },
    );
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("subagent-start");
    expect(types[types.length - 1]).toBe("subagent-end");
    const forwarded = events.filter((e) => e.sourceId);
    expect(forwarded.length).toBeGreaterThan(0);
    expect(forwarded.every((e) => e.sourceId === (res.meta as { sessionId: string }).sessionId)).toBe(true);
    expect(res.output).toContain("hello from sub");
  });
});

const CLAUDE: AgentSpec = {
  id: "claude",
  label: "Claude Code",
  requires: "claude",
  command: "npx",
  args: ["-y", "@agentclientprotocol/claude-agent-acp"],
};

describe("delegating to an installed coding agent", () => {
  let dir: string;
  let registry: ToolRegistry;
  let config: Config;
  let storeTouched: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-subagent-acp-"));
    registry = new ToolRegistry();
    config = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env: {} });
    storeTouched = [];
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function watchedStore(): SessionStore {
    return new Proxy(
      {},
      {
        get(_target, prop) {
          storeTouched.push(String(prop));
          return () => {
            throw new Error("the specialist path opened a session");
          };
        },
      },
    ) as SessionStore;
  }

  function tool(opts: {
    installed?: AgentSpec[];
    runAgent?: (o: RunAgentOptions) => Promise<void>;
    asker?: () => Promise<"allow" | "deny">;
  }) {
    const permission = new PermissionManager(
      config.permission,
      opts.asker ?? (async () => "deny"),
    );
    return createSubagentTool({
      store: watchedStore(),
      registry,
      config,
      permission,
      discoverAgents: () => opts.installed ?? [CLAUDE],
      runAgent: opts.runAgent ?? (async () => {}),
    });
  }

  it("names the agent, forwards its events with one sourceId, and ends", async () => {
    let seen: RunAgentOptions | null = null;
    const t = tool({
      runAgent: async (o) => {
        seen = o;
        o.emit({ type: "reasoning-delta", text: "planning", sourceId: o.sourceId });
        o.emit({ type: "tool-call", id: "t1", name: "edit", args: {}, sourceId: o.sourceId });
        o.emit({ type: "text-delta", text: "renamed the symbol", sourceId: o.sourceId });
        o.emit({ type: "done", sourceId: o.sourceId });
      },
    });

    const events: SessionEvent[] = [];
    const res = await t.run(
      { prompt: "rename the symbol", agent: "claude" },
      { cwd: dir, toolCallId: "call-9", emit: (e) => events.push(e) },
    );

    const start = events[0];
    expect(start?.type).toBe("subagent-start");
    expect(start).toMatchObject({ agent: "claude", prompt: "rename the symbol", parentToolCallId: "call-9" });
    const last = events[events.length - 1];
    expect(last?.type).toBe("subagent-end");
    expect(last).toMatchObject({ status: "done" });

    const sessionId = (res.meta as { sessionId: string }).sessionId;
    expect((start as { sessionId: string }).sessionId).toBe(sessionId);
    expect((last as { sessionId: string }).sessionId).toBe(sessionId);
    const forwarded = events.filter((e) => e.sourceId);
    expect(forwarded.map((e) => e.type)).toEqual([
      "reasoning-delta",
      "tool-call",
      "text-delta",
      "done",
    ]);
    expect(forwarded.every((e) => e.sourceId === sessionId)).toBe(true);

    expect(res.output).toContain("renamed the symbol");
    expect(res.output).toContain("tools used: edit");
    expect(seen).not.toBeNull();
    expect(seen!.spec).toBe(CLAUDE);
    expect(seen!.cwd).toBe(dir);
    expect(seen!.prompt).toBe("rename the symbol");
    expect(storeTouched).toEqual([]);
  });

  it("ends with an error instead of unwinding the turn when the agent blows up", async () => {
    const t = tool({
      runAgent: async () => {
        throw new Error("spawn npx ENOENT");
      },
    });
    const events: SessionEvent[] = [];
    const res = await t.run(
      { prompt: "do it", agent: "claude" },
      { cwd: dir, emit: (e) => events.push(e) },
    );
    const errors = events.filter((e) => e.type === "error");
    expect(errors).toHaveLength(1);
    expect((errors[0] as { error: string }).error).toContain("PATH");
    const last = events[events.length - 1];
    expect(last).toMatchObject({ type: "subagent-end", status: "error" });
    expect(res.output).toContain("PATH");
    expect(res.output).toContain("Claude Code");
  });

  it("ends with an error when the agent reports one", async () => {
    const t = tool({
      runAgent: async (o) => {
        o.emit({ type: "error", error: "the agent stopped: refusal", sourceId: o.sourceId });
      },
    });
    const events: SessionEvent[] = [];
    await t.run({ prompt: "do it", agent: "claude" }, { cwd: dir, emit: (e) => events.push(e) });
    expect(events[events.length - 1]).toMatchObject({ type: "subagent-end", status: "error" });
  });

  it("gates the agent's tool calls through the permission manager", async () => {
    const asked: string[] = [];
    const ask: PermissionAsk = {
      title: "Write src/main.ts",
      options: [
        { id: "allow-once", name: "Allow once" },
        { id: "allow-always", name: "Allow always" },
        { id: "reject-once", name: "Reject" },
      ],
    };
    let answer = "";
    const t = tool({
      asker: async () => {
        asked.push("asked");
        return "deny";
      },
      runAgent: async (o) => {
        answer = await o.askPermission(ask);
      },
    });
    await t.run({ prompt: "do it", agent: "claude" }, { cwd: dir });
    expect(asked).toHaveLength(1);
    expect(answer).toBe("reject-once");

    let allowed = "";
    const t2 = tool({
      asker: async () => "allow",
      runAgent: async (o) => {
        allowed = await o.askPermission(ask);
      },
    });
    await t2.run({ prompt: "do it", agent: "claude" }, { cwd: dir });
    expect(allowed).toBe("allow-once");
  });

  it("passes the turn's abort signal to the agent", async () => {
    const control = new AbortController();
    let got: AbortSignal | undefined;
    const t = tool({
      runAgent: async (o) => {
        got = o.signal;
      },
    });
    const ctx = { cwd: dir, signal: control.signal };
    await t.run({ prompt: "do it", agent: "claude" }, ctx);
    expect(got).toBe(control.signal);
  });

  it("falls through to the specialist path for a name that is not installed", async () => {
    let spawned = 0;
    const t = tool({
      runAgent: async () => {
        spawned += 1;
      },
    });
    for (const agent of ["reviewer", "nonesuch", undefined]) {
      await expect(t.run({ prompt: "review it", agent }, { cwd: dir })).rejects.toThrow(
        "the specialist path opened a session",
      );
    }
    expect(spawned).toBe(0);
    expect(storeTouched).toEqual(["create", "create", "create"]);
  });

  it("tells the model only about agents installed this session", () => {
    const none = tool({ installed: [] });
    expect(none.description).not.toContain("claude");
    expect(none.description).toBe(
      "Delegate a focused, self-contained sub-task to a sub-agent that works autonomously and " +
        "returns a summary. Pick a specialist via `agent`: explore/scout (read-only research), " +
        "reviewer (critique a change), architect (design a plan), tester (write & run tests), " +
        "debugger (root-cause & fix a bug), or general (full access, default). Use it for " +
        "independent, well-scoped chunks so your own context stays lean.",
    );

    const one = tool({ installed: [CLAUDE] });
    expect(one.description).toContain("claude (Claude Code)");
    expect(one.description).not.toContain("codex");
  });
});

describe("what the user is told when an external agent fails", () => {
  it("names the sign-in, because that is the fix", () => {
    const raw = "Internal error: Failed to authenticate: OAuth session expired and could not be refreshed";
    const said = agentFailure("Claude Code", raw);
    expect(said).toContain("not signed in");
    expect(said).toContain("Claude Code");
    expect(said).not.toContain("Internal error");
  });

  it("names the PATH when the binary is missing", () => {
    expect(agentFailure("Codex", "spawn codex ENOENT")).toContain("PATH");
  });

  it("says to wait when the agent is rate limited", () => {
    expect(agentFailure("Codex", "429 rate limit exceeded")).toContain("rate limited");
  });

  it("passes anything it does not recognise through, rather than swallowing it", () => {
    const said = agentFailure("Goose", "socket hang up");
    expect(said).toContain("socket hang up");
  });
});
