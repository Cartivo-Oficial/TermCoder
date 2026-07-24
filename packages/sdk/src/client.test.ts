import { describe, expect, it } from "vitest";
import { createClient } from "./client";
import { createHttp } from "./http";
import { createSessions } from "./sessions";
import type { WebSocketCtor } from "./types";

function recordingFetch(body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

class FakeWebSocket {
  static last: FakeWebSocket | undefined;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.last = this;
  }
  addEventListener() {}
  send() {}
  close() {}
}

describe("createClient", () => {
  it("sessions.create POSTs the body to /sessions", async () => {
    const { fetchImpl, calls } = recordingFetch({ id: "s1", title: "x" });
    const client = createClient({ baseUrl: "http://localhost:9000", fetch: fetchImpl });
    const rec = await client.sessions.create({ cwd: "/proj" });
    expect(rec).toMatchObject({ id: "s1" });
    expect(calls[0]!.url).toBe("http://localhost:9000/sessions");
    expect(calls[0]!.init.method).toBe("POST");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ cwd: "/proj" });
  });

  it("setSettings POSTs to /sessions/:id/settings", async () => {
    const { fetchImpl, calls } = recordingFetch({ mode: "plan" });
    const client = createClient({ baseUrl: "http://localhost:9000", fetch: fetchImpl });
    await client.sessions.setSettings("s1", { mode: "plan" });
    expect(calls[0]!.url).toBe("http://localhost:9000/sessions/s1/settings");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ mode: "plan" });
  });

  it("status/models/config hit their GET routes", async () => {
    const { fetchImpl, calls } = recordingFetch({ model: "m", providers: [], mcp: [], lsp: [], plugins: [] });
    const client = createClient({ baseUrl: "http://localhost:9000", fetch: fetchImpl });
    await client.status();
    await client.models();
    await client.config();
    expect(calls.map((c) => c.url)).toEqual([
      "http://localhost:9000/status",
      "http://localhost:9000/models",
      "http://localhost:9000/config",
    ]);
  });

  it("sessions.stream opens a socket when a WebSocket is available", () => {
    const { fetchImpl } = recordingFetch({});
    const client = createClient({
      baseUrl: "http://localhost:9000",
      fetch: fetchImpl,
      WebSocket: FakeWebSocket as unknown as WebSocketCtor,
    });
    client.sessions.stream("s1");
    expect(FakeWebSocket.last!.url).toBe("ws://localhost:9000/sessions/s1/stream");
  });

  it("sessions.stream throws a helpful error when no WebSocket is available", () => {
    const { fetchImpl } = recordingFetch({});
    const http = createHttp({ baseUrl: "http://localhost:9000", fetch: fetchImpl });
    const sessions = createSessions(http, { baseUrl: "http://localhost:9000", WebSocket: undefined });
    expect(() => sessions.stream("s1")).toThrow(/WebSocket/);
  });
});
