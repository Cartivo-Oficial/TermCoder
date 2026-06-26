import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, type Config } from "../config/config";
import { PermissionManager } from "../permission/permission";
import { SessionStore } from "../storage/storage";
import { ToolRegistry } from "../tools";
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
});
