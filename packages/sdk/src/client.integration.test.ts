import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, SessionStore, ToolRegistry, type Config, type ModelRunner } from "@termcoder/core";
import { createServer } from "@termcoder/server";
import { createClient } from "./client";
import type { WebSocketCtor, StreamEvent } from "./types";

function scriptedRunner(): ModelRunner {
  const steps = [
    {
      chunks: [{ type: "text-delta", text: "Hi." }],
      finishReason: "stop",
      responseMessages: [{ role: "assistant", content: "Hi." }],
    },
  ];
  let i = 0;
  return () => {
    const step = steps[i++]!;
    const chunks = step.chunks;
    async function* stream() {
      for (const c of chunks) yield c;
    }
    return {
      fullStream: stream(),
      response: Promise.resolve({ messages: step.responseMessages as never }),
      finishReason: Promise.resolve(step.finishReason),
      toolCalls: Promise.resolve([]),
    };
  };
}

describe("sdk against a real server", () => {
  let dir: string;
  let store: SessionStore;
  let config: Config;
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  let webDir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "tc-sdk-"));
    store = new SessionStore(join(dir, "sessions"));
    config = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env: {} });
    webDir = mkdtempSync(join(tmpdir(), "tc-sdk-web-"));
    writeFileSync(join(webDir, "index.html"), "<!doctype html><div id=root></div>");
    server = createServer({
      config,
      store,
      registry: new ToolRegistry(),
      runner: scriptedRunner(),
      cwd: dir,
      webDir,
      license: () => ({ active: true, tier: "pro" }),
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      store.close();
    } catch {}
    rmSync(dir, { recursive: true, force: true });
    rmSync(webDir, { recursive: true, force: true });
  });

  it("creates a session, lists it, and reads status/models", async () => {
    const client = createClient({ baseUrl, WebSocket: WebSocket as unknown as WebSocketCtor });
    const rec = await client.sessions.create({ cwd: dir });
    expect(rec.id).toBeTruthy();
    const list = await client.sessions.list();
    expect(list.some((s) => s.id === rec.id)).toBe(true);
    const status = await client.status();
    expect(typeof status.model).toBe("string");
    expect(Array.isArray(status.providers)).toBe(true);
    const models = await client.models();
    expect(Array.isArray(models)).toBe(true);
  });

  it("streams typed events for a prompt through to done", async () => {
    const client = createClient({ baseUrl, WebSocket: WebSocket as unknown as WebSocketCtor });
    const rec = await client.sessions.create({ cwd: dir });
    const stream = client.sessions.stream(rec.id);
    const collected: StreamEvent[] = [];
    const drain = (async () => {
      for await (const ev of stream) {
        collected.push(ev);
        if (ev.kind === "event" && ev.event.type === "done") break;
      }
    })();
    stream.prompt("hello");
    await drain;
    stream.close();
    const kinds = collected.map((e) => (e.kind === "event" ? `event:${e.event.type}` : e.kind));
    expect(kinds).toContain("event:done");
    expect(kinds.some((k) => k === "event:text-delta")).toBe(true);
  });
});
