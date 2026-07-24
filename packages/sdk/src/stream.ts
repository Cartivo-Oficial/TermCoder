import type { SessionEvent, StreamEvent, PermissionDecision, WebSocketCtor } from "./types";

class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: Array<(r: IteratorResult<T>) => void> = [];
  private done = false;

  push(item: T): void {
    if (this.done) return;
    const w = this.waiters.shift();
    if (w) w({ value: item, done: false });
    else this.items.push(item);
  }

  close(): void {
    if (this.done) return;
    this.done = true;
    while (this.waiters.length) this.waiters.shift()!({ value: undefined as never, done: true });
  }

  async *drain(): AsyncGenerator<T> {
    while (true) {
      const item = this.items.shift();
      if (item !== undefined) {
        yield item;
        continue;
      }
      if (this.done) return;
      const next = await new Promise<IteratorResult<T>>((r) => this.waiters.push(r));
      if (next.done) return;
      yield next.value;
    }
  }
}

const SESSION_EVENT_TYPES = new Set([
  "text-delta",
  "reasoning-delta",
  "reasoning-end",
  "tool-call",
  "tool-result",
  "usage",
  "subagent-start",
  "subagent-end",
  "done",
]);

function toStreamEvent(frame: { type?: unknown; [k: string]: unknown }): StreamEvent | null {
  const type = typeof frame.type === "string" ? frame.type : "";
  if (type === "room-prompt") return { kind: "prompt", from: String(frame.from ?? ""), text: String(frame.text ?? "") };
  if (type === "permission-request") return { kind: "permission", id: String(frame.id ?? ""), request: frame.request };
  if (type === "stopped") return { kind: "stopped" };
  if (type === "error" || type === "room-locked") return { kind: "error", error: String(frame.error ?? "error") };
  if (SESSION_EVENT_TYPES.has(type)) return { kind: "event", event: frame as unknown as SessionEvent };
  return null;
}

function wsUrl(baseUrl: string, sessionId: string, name?: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const u = new URL(`sessions/${encodeURIComponent(sessionId)}/stream`, base);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  if (name) u.searchParams.set("name", name);
  return u.toString();
}

export interface SessionStream extends AsyncIterable<StreamEvent> {
  prompt(text: string, opts?: { images?: Array<{ dataUrl: string; mediaType: string }> }): void;
  background(goal: string): void;
  stop(): void;
  respondPermission(id: string, decision: PermissionDecision): void;
  close(): void;
}

export function openStream(opts: {
  baseUrl: string;
  WebSocket: WebSocketCtor;
  sessionId: string;
  name?: string;
}): SessionStream {
  const ws = new opts.WebSocket(wsUrl(opts.baseUrl, opts.sessionId, opts.name));
  const queue = new AsyncQueue<StreamEvent>();
  let open = false;
  const outbox: string[] = [];

  const send = (msg: unknown) => {
    const s = JSON.stringify(msg);
    if (open) ws.send(s);
    else outbox.push(s);
  };

  ws.addEventListener("open", () => {
    open = true;
    while (outbox.length) ws.send(outbox.shift()!);
  });
  ws.addEventListener("message", (ev) => {
    let frame: { type?: unknown };
    try {
      frame = JSON.parse(String(ev.data));
    } catch {
      console.warn("sdk: dropped non-JSON frame");
      return;
    }
    const mapped = toStreamEvent(frame);
    if (mapped) queue.push(mapped);
  });
  ws.addEventListener("close", () => queue.close());
  ws.addEventListener("error", () => queue.push({ kind: "error", error: "socket error" }));

  return {
    [Symbol.asyncIterator]: () => queue.drain(),
    prompt: (text, o) => send({ type: "prompt", text, images: o?.images }),
    background: (goal) => send({ type: "background", goal }),
    stop: () => send({ type: "stop" }),
    respondPermission: (id, decision) => send({ type: "permission-decision", id, decision }),
    close: () => {
      try {
        ws.close();
      } catch {
        queue.close();
      }
    },
  };
}
