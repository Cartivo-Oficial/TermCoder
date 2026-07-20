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
import { createSubagentTool } from "./subagent";

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
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function tool(runner: ModelRunner) {
    const permission = new PermissionManager(config.permission, async () => "deny");
    return createSubagentTool({ store, registry, config, permission, runner });
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
