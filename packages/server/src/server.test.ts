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
      license: () => ({ active: true, tier: "pro" }),
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

  it("exposes classrooms locally and gates GitHub actions on a token", async () => {
    const list = await (await fetch(`${base()}/classrooms`)).json();
    expect(Array.isArray(list)).toBe(true); // local join list, no network

    const create = await fetch(`${base()}/classroom`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", name: "Math 101" }),
    });
    expect(create.status).toBe(401); // no token configured (env: {})
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

  it("starts a Claude oauth login and rejects completing without a start", async () => {
    const rejected = await fetch(`${base()}/auth/claude/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "x" }),
    });
    expect(rejected.status).toBe(400);

    const start = await fetch(`${base()}/auth/claude/start`, { method: "POST" });
    expect(start.status).toBe(200);
    const body = (await start.json()) as { url: string };
    expect(body.url).toContain("oauth");
  });

  it("reports ChatGPT device-login status without crashing", async () => {
    const status = await fetch(`${base()}/auth/chatgpt/status`);
    expect(status.status).toBe(200);
    const body = (await status.json()) as { state: string };
    expect(typeof body.state).toBe("string");

    const start = await fetch(`${base()}/auth/chatgpt/start`, { method: "POST" });
    expect([200, 502]).toContain(start.status);
    expect(start.headers.get("content-type")).toContain("json");
  });

  it("probes a provider and reports health", async () => {
    const bad = await fetch(`${base()}/providers/probe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "nope" }),
    });
    expect(bad.status).toBe(400);

    const res = await fetch(`${base()}/providers/probe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "groq" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);

    const list = (await (await fetch(`${base()}/providers`)).json()) as Array<{
      provider: string;
      keyUrl?: string;
      health?: string;
    }>;
    const groq = list.find((p) => p.provider === "groq");
    expect(groq?.health).toBe("bad");
    expect(groq?.keyUrl).toContain("groq");
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
      expect((await fetch(`http://localhost:${p}/some/route`)).status).toBe(200);
      expect((await fetch(`http://localhost:${p}/missing.js`)).status).toBe(404);
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

  it("broadcasts one participant's run, chat, and presence to the whole room", async () => {
    const record = (await (
      await fetch(`${base()}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: dir }),
      })
    ).json()) as { id: string };

    const ws1 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Alice`);
    const ws2 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Bob`);
    const seen2: Array<{ type: string; from?: string; count?: number; id?: string }> = [];

    // ws1 (the driver) answers permission prompts.
    ws1.on("message", (raw) => {
      const e = JSON.parse(raw.toString()) as { type: string; id?: string };
      if (e.type === "permission-request") {
        ws1.send(JSON.stringify({ type: "permission-decision", id: e.id, decision: "allow" }));
      }
    });

    // Attach Bob's collector before open so the join-time presence event is captured.
    const done = new Promise<void>((resolve, reject) => {
      ws2.on("message", (raw) => {
        const e = JSON.parse(raw.toString()) as { type: string; from?: string; count?: number; id?: string };
        seen2.push(e);
        if (e.type === "done") resolve();
        if (e.type === "error") reject(new Error("unexpected error event"));
      });
    });

    await Promise.all([
      new Promise<void>((r) => ws1.on("open", () => r())),
      new Promise<void>((r) => ws2.on("open", () => r())),
    ]);

    // Both are registered now — Bob chats and Alice drives the agent.
    ws2.send(JSON.stringify({ type: "chat", text: "hey team" }));
    ws1.send(JSON.stringify({ type: "prompt", text: "create file" }));
    await done;

    ws1.close();
    ws2.close();

    const types = seen2.map((e) => e.type);
    // Bob (who did not drive) still sees the agent's run:
    expect(types).toContain("tool-result");
    expect(types).toContain("done");
    // …and the room signals:
    expect(seen2.some((e) => e.type === "room-prompt" && e.from === "Alice")).toBe(true);
    expect(seen2.some((e) => e.type === "room-chat" && e.from === "Bob")).toBe(true);
    expect(seen2.some((e) => e.type === "room-presence" && (e.count ?? 0) >= 2)).toBe(true);
  });

  it("reports LAN addresses for sharing a room", async () => {
    const res = await fetch(`${base()}/room/addresses`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { addresses: string[]; port: string };
    expect(Array.isArray(body.addresses)).toBe(true);
  });

  it("relays a WebRTC signal peer-to-peer between two room members", async () => {
    const record = (await (
      await fetch(`${base()}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: dir }),
      })
    ).json()) as { id: string };

    const wsA = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Alice`);
    const wsB = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Bob`);
    let aPeerId = "";
    let bPeerId = "";
    let resolveSignal: (v: { from?: string; data?: { kind?: string; sdp?: string } }) => void = () => {};
    const gotSignal = new Promise<{ from?: string; data?: { kind?: string; sdp?: string } }>((res) => {
      resolveSignal = res;
    });

    const aReady = new Promise<void>((ra) => {
      wsA.on("message", (raw) => {
        const e = JSON.parse(raw.toString()) as { type: string; peerId?: string };
        if (e.type === "room-welcome") { aPeerId = e.peerId || ""; ra(); }
      });
    });
    const bReady = new Promise<void>((rb) => {
      wsB.on("message", (raw) => {
        const e = JSON.parse(raw.toString()) as { type: string; peerId?: string; from?: string; data?: { kind?: string; sdp?: string } };
        if (e.type === "room-welcome") { bPeerId = e.peerId || ""; rb(); }
        if (e.type === "signal") resolveSignal(e);
      });
    });

    await Promise.all([aReady, bReady]);
    // Alice sends a WebRTC offer targeted at Bob's peer id.
    wsA.send(JSON.stringify({ type: "signal", to: bPeerId, data: { kind: "offer", sdp: "test-sdp" } }));
    const sig = await gotSignal;
    wsA.close();
    wsB.close();

    expect(sig.from).toBe(aPeerId);          // Bob sees it came from Alice
    expect(sig.data?.kind).toBe("offer");    // payload relayed intact
    expect(sig.data?.sdp).toBe("test-sdp");
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

  it("lists, saves, and deletes memories", async () => {
    const save = await fetch(`${base()}/memory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "project", name: "arch", description: "monorepo", type: "project", body: "four packages" }),
    });
    expect(save.status).toBe(200);

    const list = (await (await fetch(`${base()}/memory`)).json()) as { memories: Array<{ name: string }> };
    expect(list.memories.some((m) => m.name === "arch")).toBe(true);

    const del = await fetch(`${base()}/memory/arch`, { method: "DELETE" });
    expect(del.status).toBe(200);
  });

  it("rejects a secret-shaped memory body with 400", async () => {
    const res = await fetch(`${base()}/memory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "project", name: "leak", description: "d", type: "project", body: "my key is AKIAIOSFODNN7EXAMPLE" }),
    });
    expect(res.status).toBe(400);
  });

  it("saves, lists, runs, and deletes recipes over HTTP", async () => {
    const save = await fetch(`${base()}/recipes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: "project",
        name: "Open a PR",
        description: "ship the branch",
        audience: "dev",
        steps: ["run the tests", "push the branch", "open a pull request"],
        cwd: dir,
      }),
    });
    expect(save.status).toBe(200);
    const saved = (await save.json()) as { name: string; steps: string[] };
    expect(saved.name).toBe("open-a-pr");
    expect(saved.steps).toHaveLength(3);

    const list = (await (await fetch(`${base()}/recipes?cwd=${encodeURIComponent(dir)}`)).json()) as Array<{ name: string }>;
    expect(list.some((r) => r.name === "open-a-pr")).toBe(true);

    const run = (await (
      await fetch(`${base()}/recipes/open-a-pr/run?cwd=${encodeURIComponent(dir)}`)
    ).json()) as { prompt: string };
    expect(run.prompt).toContain("open-a-pr");
    expect(run.prompt).toContain("open a pull request");

    const del = await fetch(`${base()}/recipes/open-a-pr?cwd=${encodeURIComponent(dir)}`, { method: "DELETE" });
    expect(del.status).toBe(200);

    const runMissing = await fetch(`${base()}/recipes/open-a-pr/run?cwd=${encodeURIComponent(dir)}`);
    expect(runMissing.status).toBe(404);
  });

  it("rejects a recipe with no steps", async () => {
    const res = await fetch(`${base()}/recipes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "empty", steps: [], cwd: dir }),
    });
    expect(res.status).toBe(400);
  });

  it("reports license status and rejects an invalid activation key", async () => {
    const status = (await (await fetch(`${base()}/license`)).json()) as { active: boolean; tier?: string };
    expect(status.active).toBe(true); // this server is injected as licensed
    const bad = await fetch(`${base()}/license`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "not-a-real-key" }),
    });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { active: boolean }).active).toBe(false);
  });

  it("lets a licensed host admit a second room participant", async () => {
    const record = (await (
      await fetch(`${base()}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: dir }),
      })
    ).json()) as { id: string };
    const ws1 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Host`);
    await new Promise<void>((r) => ws1.on("message", (raw) => { if (JSON.parse(raw.toString()).type === "room-welcome") r(); }));
    const ws2 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Guest`);
    const type = await new Promise<string>((r) => ws2.on("message", (raw) => r(JSON.parse(raw.toString()).type as string)));
    ws1.close();
    ws2.close();
    expect(type).toBe("room-welcome");
  });

  it("gives an unlicensed host one free guest, and gates classroom hosting", async () => {
    const free = createServer({
      config,
      store,
      registry: new ToolRegistry(),
      runner: scriptedRunner(),
      cwd: dir,
      license: () => ({ active: false }),
    });
    await new Promise<void>((r) => free.listen(0, r));
    const fport = (free.address() as AddressInfo).port;
    const fbase = `http://localhost:${fport}`;

    const create = await fetch(`${fbase}/classroom`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", name: "Bio 101" }),
    });
    expect(create.status).toBe(402);

    const record = (await (
      await fetch(`${fbase}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: dir }),
      })
    ).json()) as { id: string };
    const ws1 = new WebSocket(`ws://localhost:${fport}/sessions/${record.id}/stream?name=Host`);
    await new Promise<void>((r) => ws1.on("message", (raw) => { if (JSON.parse(raw.toString()).type === "room-welcome") r(); }));
    const ws2 = new WebSocket(`ws://localhost:${fport}/sessions/${record.id}/stream?name=Guest`);
    const guest = await new Promise<string>((r) => ws2.on("message", (raw) => r(JSON.parse(raw.toString()).type as string)));
    expect(guest).toBe("room-welcome");
    ws1.close();
    ws2.close();

    await new Promise<void>((r) => free.close(() => r()));
  });

  it("blocks a third room participant when unlicensed", async () => {
    const free = createServer({
      config,
      store,
      registry: new ToolRegistry(),
      runner: scriptedRunner(),
      cwd: dir,
      license: () => ({ active: false }),
    });
    await new Promise<void>((r) => free.listen(0, r));
    const fport = (free.address() as AddressInfo).port;

    const record = (await (
      await fetch(`http://localhost:${fport}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: dir }),
      })
    ).json()) as { id: string };
    const welcomed = (ws: WebSocket) =>
      new Promise<void>((r) => ws.on("message", (raw) => { if (JSON.parse(raw.toString()).type === "room-welcome") r(); }));

    const ws1 = new WebSocket(`ws://localhost:${fport}/sessions/${record.id}/stream?name=Host`);
    await welcomed(ws1);
    const ws2 = new WebSocket(`ws://localhost:${fport}/sessions/${record.id}/stream?name=Guest`);
    await welcomed(ws2);

    const ws3 = new WebSocket(`ws://localhost:${fport}/sessions/${record.id}/stream?name=Third`);
    const type = await new Promise<string>((r) => ws3.on("message", (raw) => r(JSON.parse(raw.toString()).type as string)));
    ws1.close();
    ws2.close();
    ws3.close();
    expect(type).toBe("room-locked");

    await new Promise<void>((r) => free.close(() => r()));
  });

  it("lets a licensed host admit a third room participant", async () => {
    const record = (await (
      await fetch(`${base()}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: dir }),
      })
    ).json()) as { id: string };
    const welcomed = (ws: WebSocket) =>
      new Promise<void>((r) => ws.on("message", (raw) => { if (JSON.parse(raw.toString()).type === "room-welcome") r(); }));

    const ws1 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Host`);
    await welcomed(ws1);
    const ws2 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Guest`);
    await welcomed(ws2);
    const ws3 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Third`);
    const type = await new Promise<string>((r) => ws3.on("message", (raw) => r(JSON.parse(raw.toString()).type as string)));
    ws1.close();
    ws2.close();
    ws3.close();
    expect(type).toBe("room-welcome");
  });

  it("lets a guest join by room token without knowing the session id", async () => {
    const record = (await (
      await fetch(`${base()}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cwd: dir }) })
    ).json()) as { id: string };

    const ws1 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Host`);
    const welcome = await new Promise<Record<string, unknown>>((r) =>
      ws1.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.type === "room-welcome") r(m); }));
    const token = welcome.joinToken as string;
    expect(token).toBeTruthy();
    expect(token).not.toBe(record.id);

    const ws2 = new WebSocket(`ws://localhost:${port}/sessions/${token}/stream?name=Guest`);
    const type = await new Promise<string>((r) => ws2.on("message", (raw) => r(JSON.parse(raw.toString()).type as string)));
    ws1.close();
    ws2.close();
    expect(type).toBe("room-welcome");
  });

  it("a bogus room token creates its own empty room, never joins another", async () => {
    const record = (await (
      await fetch(`${base()}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cwd: dir }) })
    ).json()) as { id: string };
    const ws1 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Host`);
    await new Promise<void>((r) => ws1.on("message", (raw) => { if (JSON.parse(raw.toString()).type === "room-welcome") r(); }));
    const ws2 = new WebSocket(`ws://localhost:${port}/sessions/deadbeefdeadbeefdeadbeef01/stream?name=Nobody`);
    const w2 = await new Promise<Record<string, unknown>>((r) => ws2.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.type === "room-welcome") r(m); }));
    ws1.close();
    ws2.close();
    expect(w2.participants).toEqual(["Nobody"]);
  });
});
