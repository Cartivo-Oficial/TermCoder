import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadConfig,
  SessionStore,
  ToolRegistry,
  type Config,
  type ModelRunner,
} from "@termcoder/core";
import { createServer } from "./server";

function scriptedRunner(): ModelRunner {
  const steps = [
    {
      chunks: [{ type: "text-delta", text: "Creating." }],
      finishReason: "tool-calls",
      toolCalls: [
        { toolCallId: "t1", toolName: "write", input: { path: "hello.ts", content: "export const hi = 1;\n" } },
      ],
      responseMessages: [{ role: "assistant", content: "Creating." }],
    },
    {
      chunks: [{ type: "text-delta", text: "Done." }],
      finishReason: "stop",
      responseMessages: [{ role: "assistant", content: "Done." }],
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
      toolCalls: Promise.resolve(step.toolCalls ?? []),
    };
  };
}

describe("server", () => {
  let dir: string;
  let store: SessionStore;
  let config: Config;
  let server: ReturnType<typeof createServer>;
  let port: number;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "tc-server-"));
    store = new SessionStore(join(dir, "sessions"));
    config = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env: {} });
    config.permission.write = "ask";
    server = createServer({
      config,
      store,
      registry: new ToolRegistry(),
      runner: scriptedRunner(),
      cwd: dir,
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  });

  const base = () => `http://localhost:${port}`;

  it("creates and lists sessions over HTTP", async () => {
    const res = await fetch(`${base()}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: dir }),
    });
    expect(res.status).toBe(201);
    const record = (await res.json()) as { id: string };
    expect(record.id).toBeTruthy();

    const list = (await (await fetch(`${base()}/sessions`)).json()) as Array<{ id: string }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(record.id);
  });

  it("404s an unknown session", async () => {
    const res = await fetch(`${base()}/sessions/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it("GitHub-backed routes report a missing token instead of crashing", async () => {
    // No token configured (env: {}), so each should 401 with a clear message.
    const who = await fetch(`${base()}/github`);
    expect(who.status).toBe(401);
    expect(((await who.json()) as { error: string }).error).toMatch(/token/i);

    const imp = await fetch(`${base()}/sessions/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref: "abc123" }),
    });
    expect(imp.status).toBe(401);

    const push = await fetch(`${base()}/sync/push`, { method: "POST" });
    expect(push.status).toBe(401);

    const pack = await fetch(`${base()}/packs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "install", ref: "abc123" }),
    });
    expect(pack.status).toBe(401);
  });

  it("import without a ref is a 400 (bad request), not a 401", async () => {
    const res = await fetch(`${base()}/sessions/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("serves the study overview and validates generation input", async () => {
    const overview = (await (await fetch(`${base()}/study`)).json()) as {
      decks: unknown[];
      streak: number;
    };
    expect(Array.isArray(overview.decks)).toBe(true);
    expect(typeof overview.streak).toBe("number");

    const bad = await fetch(`${base()}/study/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(bad.status).toBe(400); // missing topic
  });

  it("lists connectable providers with their login methods", async () => {
    const list = (await (await fetch(`${base()}/providers`)).json()) as Array<{
      provider: string;
      methods: Array<{ id: string; available: boolean }>;
    }>;
    const openai = list.find((p) => p.provider === "openai");
    expect(openai?.methods.some((m) => m.id === "api-key" && m.available)).toBe(true);
  });

  it("serves a web UI directory with an SPA fallback", async () => {
    const webDir = mkdtempSync(join(tmpdir(), "tc-web-"));
    writeFileSync(join(webDir, "index.html"), "<!doctype html><div id=root></div>");
    const s = createServer({ config, store, registry: new ToolRegistry(), cwd: dir, webDir });
    await new Promise<void>((r) => s.listen(0, r));
    const p = (s.address() as AddressInfo).port;
    try {
      const root = await fetch(`http://localhost:${p}/`);
      expect(root.status).toBe(200);
      expect(await root.text()).toContain("id=root");
      // An extension-less route falls back to index.html (SPA); a missing asset 404s.
      expect((await fetch(`http://localhost:${p}/some/route`)).status).toBe(200);
      expect((await fetch(`http://localhost:${p}/missing.js`)).status).toBe(404);
      // API routes still win over static.
      expect((await fetch(`http://localhost:${p}/study`)).status).toBe(200);
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
      rmSync(webDir, { recursive: true, force: true });
    }
  });

  it("deletes a single session and 404s deleting a missing one", async () => {
    const record = store.create({ cwd: dir, model: "m" });

    const del = await fetch(`${base()}/sessions/${record.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect(store.exists(record.id)).toBe(false);

    const missing = await fetch(`${base()}/sessions/does-not-exist`, { method: "DELETE" });
    expect(missing.status).toBe(404);
  });

  it("renames a session via POST title", async () => {
    const record = store.create({ cwd: dir, model: "m", title: "Untitled session" });

    const res = await fetch(`${base()}/sessions/${record.id}/title`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "  My feature work  " }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()) as { title: string }).toMatchObject({ title: "My feature work" });
    expect(store.load(record.id).title).toBe("My feature work");
  });

  it("clears all sessions with a collection DELETE", async () => {
    store.create({ cwd: dir, model: "m" });
    store.create({ cwd: dir, model: "m" });

    const res = await fetch(`${base()}/sessions`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect((await res.json()) as { removed: number }).toMatchObject({ removed: 2 });

    const list = (await (await fetch(`${base()}/sessions`)).json()) as unknown[];
    expect(list).toHaveLength(0);
  });

  it("streams a turn and handles the permission round-trip over WS", async () => {
    const record = (await (
      await fetch(`${base()}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: dir }),
      })
    ).json()) as { id: string };

    const ws = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream`);
    const events: Array<{ type: string; id?: string }> = [];

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => ws.send(JSON.stringify({ type: "prompt", text: "create file" })));
      ws.on("message", (raw) => {
        const event = JSON.parse(raw.toString()) as { type: string; id?: string; error?: string };
        events.push(event);
        if (event.type === "permission-request") {
          ws.send(JSON.stringify({ type: "permission-decision", id: event.id, decision: "allow" }));
        } else if (event.type === "done") {
          resolve();
        } else if (event.type === "error") {
          reject(new Error(event.error));
        }
      });
      ws.on("error", reject);
    });
    ws.close();

    const types = events.map((e) => e.type);
    expect(types).toContain("permission-request");
    expect(types).toContain("tool-result");
    expect(types).toContain("done");
    expect(existsSync(join(dir, "hello.ts"))).toBe(true);
  });

  it("serves a shareable transcript as HTML and Markdown", async () => {
    const record = store.create({ cwd: dir, model: "m", title: "Shared" });
    record.messages.push({ role: "user", content: "hi <b>there</b>" });
    store.save(record);

    const html = await fetch(`${base()}/sessions/${record.id}/share`);
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toMatch(/text\/html/);
    const htmlBody = await html.text();
    expect(htmlBody).toContain("<!doctype html>");
    expect(htmlBody).toContain("&lt;b&gt;there&lt;/b&gt;");

    const md = await fetch(`${base()}/sessions/${record.id}/share?format=md`);
    expect(md.headers.get("content-type")).toMatch(/text\/markdown/);
    expect(await md.text()).toContain("# Shared");
  });
});
