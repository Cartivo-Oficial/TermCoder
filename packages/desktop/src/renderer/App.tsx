import { useEffect, useRef, useState } from "react";

const port = new URLSearchParams(location.search).get("port") ?? "4096";
const httpBase = `http://localhost:${port}`;
const wsBase = `ws://localhost:${port}`;

interface Message {
  role: "user" | "assistant" | "tool" | "notice" | "error";
  text: string;
  name?: string;
  status?: "running" | "done" | "error";
}

interface PermissionPrompt {
  id: string;
  title: string;
  detail?: string;
}

// deno-lint-ignore no-explicit-any
type StreamEvent = any;

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [perm, setPerm] = useState<PermissionPrompt | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const assistantIdx = useRef<number | null>(null);
  const started = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await fetch(`${httpBase}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        const record = (await res.json()) as { id: string };
        const ws = new WebSocket(`${wsBase}/sessions/${record.id}/stream`);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onmessage = (ev) => onEvent(JSON.parse(ev.data) as StreamEvent);
      } catch {
        setMessages([{ role: "error", text: "Could not reach the termcoder server." }]);
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  function onEvent(e: StreamEvent) {
    if (e.type === "permission-request") {
      setPerm({ id: e.id, title: e.request.title, detail: e.request.detail });
      return;
    }
    setMessages((prev) => {
      const next = [...prev];
      switch (e.type) {
        case "text-delta":
          if (assistantIdx.current === null) {
            next.push({ role: "assistant", text: e.text });
            assistantIdx.current = next.length - 1;
          } else {
            const cur = next[assistantIdx.current]!;
            next[assistantIdx.current] = { ...cur, text: cur.text + e.text };
          }
          break;
        case "tool-call":
          assistantIdx.current = null;
          next.push({ role: "tool", name: e.name, text: e.title ?? "", status: "running" });
          break;
        case "tool-result":
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i]!.role === "tool" && next[i]!.status === "running") {
              const summary = String(e.output ?? "").split("\n")[0]?.slice(0, 120) ?? "";
              next[i] = { ...next[i]!, status: e.isError ? "error" : "done", text: next[i]!.text ? `${next[i]!.text} — ${summary}` : summary };
              break;
            }
          }
          break;
        case "error":
          next.push({ role: "error", text: e.error });
          break;
        case "done":
          setBusy(false);
          break;
      }
      return next;
    });
  }

  function decide(decision: "allow" | "deny" | "allow-always") {
    if (perm) wsRef.current?.send(JSON.stringify({ type: "permission-decision", id: perm.id, decision }));
    setPerm(null);
  }

  function send() {
    const text = input.trim();
    if (!text || busy || !connected) return;
    setInput("");
    assistantIdx.current = null;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    wsRef.current?.send(JSON.stringify({ type: "prompt", text }));
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">❯ termcoder</span>
        <span className={`dot ${connected ? "on" : "off"}`} />
        <span className="muted">{connected ? "connected" : "connecting…"}</span>
      </header>

      <div className="transcript" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="empty">Ask termcoder to write code, run commands, or search the web.</div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "user" ? <span className="who">you</span> : null}
            {m.role === "tool" ? (
              <div className="tool">
                <span className={`status ${m.status}`}>
                  {m.status === "error" ? "✗" : m.status === "done" ? "✓" : "•"}
                </span>
                <span className="toolname">{m.name}</span>
                {m.text ? <span className="muted"> {m.text}</span> : null}
              </div>
            ) : (
              <div className="bubble">{m.text}</div>
            )}
          </div>
        ))}
        {busy ? <div className="msg assistant"><div className="bubble muted">▍ thinking…</div></div> : null}
      </div>

      {perm ? (
        <div className="perm">
          <div className="perm-card">
            <div className="perm-title">Allow this action?</div>
            <div className="perm-detail">{perm.title}</div>
            {perm.detail ? <pre className="perm-pre">{perm.detail}</pre> : null}
            <div className="perm-actions">
              <button className="allow" onClick={() => decide("allow")}>Allow</button>
              <button className="always" onClick={() => decide("allow-always")}>Always</button>
              <button className="deny" onClick={() => decide("deny")}>Deny</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="composer">
        <textarea
          value={input}
          placeholder="Ask termcoder to do something…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button onClick={send} disabled={busy || !connected}>Send</button>
      </div>
    </div>
  );
}
