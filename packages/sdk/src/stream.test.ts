import { describe, expect, it } from "vitest";
import { openStream } from "./stream";
import type { WebSocketCtor } from "./types";

class FakeWebSocket {
  static last: FakeWebSocket | undefined;
  url: string;
  sent: string[] = [];
  private listeners: Record<string, Array<(ev: { data?: unknown }) => void>> = {};
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.last = this;
  }
  addEventListener(type: string, cb: (ev: { data?: unknown }) => void) {
    (this.listeners[type] ??= []).push(cb);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.fire("close", {});
  }
  fire(type: string, ev: { data?: unknown }) {
    for (const cb of this.listeners[type] ?? []) cb(ev);
  }
  emit(frame: unknown) {
    this.fire("message", { data: JSON.stringify(frame) });
  }
}

const ctor = FakeWebSocket as unknown as WebSocketCtor;

describe("openStream", () => {
  it("builds a ws:// url with the session id and name", () => {
    openStream({ baseUrl: "http://localhost:9000", WebSocket: ctor, sessionId: "s1", name: "cli" });
    expect(FakeWebSocket.last!.url).toBe("ws://localhost:9000/sessions/s1/stream?name=cli");
  });

  it("maps a SessionEvent frame to {kind:'event'} and a control frame to its kind", async () => {
    const stream = openStream({ baseUrl: "https://h:8443", WebSocket: ctor, sessionId: "s1" });
    expect(FakeWebSocket.last!.url.startsWith("wss://h:8443/sessions/s1/stream")).toBe(true);
    const ws = FakeWebSocket.last!;
    ws.fire("open", {});
    ws.emit({ type: "text-delta", text: "hi" });
    ws.emit({ type: "permission-request", id: "p1", request: { toolName: "write" } });
    ws.emit({ type: "stopped" });
    const it = stream[Symbol.asyncIterator]();
    expect((await it.next()).value).toEqual({ kind: "event", event: { type: "text-delta", text: "hi" } });
    expect((await it.next()).value).toEqual({ kind: "permission", id: "p1", request: { toolName: "write" } });
    expect((await it.next()).value).toEqual({ kind: "stopped" });
  });

  it("ignores room-welcome/presence frames", async () => {
    const stream = openStream({ baseUrl: "http://h:1", WebSocket: ctor, sessionId: "s1" });
    const ws = FakeWebSocket.last!;
    ws.fire("open", {});
    ws.emit({ type: "room-welcome", you: "cli" });
    ws.emit({ type: "done" });
    const it = stream[Symbol.asyncIterator]();
    expect((await it.next()).value).toEqual({ kind: "event", event: { type: "done" } });
  });

  it("buffers a pre-open prompt and flushes it on open, and sends the right frames", () => {
    const stream = openStream({ baseUrl: "http://h:1", WebSocket: ctor, sessionId: "s1" });
    const ws = FakeWebSocket.last!;
    stream.prompt("hello");
    expect(ws.sent).toHaveLength(0);
    ws.fire("open", {});
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: "prompt", text: "hello", images: undefined });
    stream.stop();
    stream.respondPermission("p1", "allow");
    expect(JSON.parse(ws.sent[1]!)).toEqual({ type: "stop" });
    expect(JSON.parse(ws.sent[2]!)).toEqual({ type: "permission-decision", id: "p1", decision: "allow" });
  });

  it("ends the iterator when the socket closes", async () => {
    const stream = openStream({ baseUrl: "http://h:1", WebSocket: ctor, sessionId: "s1" });
    const ws = FakeWebSocket.last!;
    ws.fire("open", {});
    const it = stream[Symbol.asyncIterator]();
    ws.close();
    expect((await it.next()).done).toBe(true);
  });
});
