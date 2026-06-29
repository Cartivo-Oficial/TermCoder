import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

declare global {
  interface Window {
    api?: { serverPort: number; pickFolder: () => Promise<string | null> };
  }
}

const port =
  window.api?.serverPort || Number(new URLSearchParams(location.search).get("port")) || 4096;
const httpBase = `http://localhost:${port}`;
const wsBase = `ws://localhost:${port}`;

interface Message {
  role: "user" | "assistant" | "tool" | "notice" | "error";
  text: string;
  name?: string;
  status?: "running" | "done" | "error";
  detail?: string;
}

interface SessionSummary {
  id: string;
  title: string;
  messageCount: number;
}

interface Segment {
  role: "user" | "assistant" | "tool";
  label?: string;
  code?: boolean;
  text: string;
}

// deno-lint-ignore no-explicit-any
type StreamEvent = any;

function isDiff(text: string): boolean {
  return /^[+-] /m.test(text);
}

function DiffBlock({ text }: { text: string }) {
  return (
    <pre className="diff">
      {text.split("\n").map((line, i) => (
        <div
          key={i}
          className={line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "ctx"}
        >
          {line}
        </div>
      ))}
    </pre>
  );
}

function segToMessage(seg: Segment): Message {
  if (seg.role === "user") return { role: "user", text: seg.text };
  if (seg.role === "assistant" && !seg.label) return { role: "assistant", text: seg.text };
  if (seg.role === "assistant") {
    return { role: "tool", name: seg.label?.replace("→ ", ""), status: "done", text: "", detail: seg.text };
  }
  return {
    role: "tool",
    name: seg.label ?? "tool",
    status: "done",
    text: (seg.text || "").split("\n")[0]?.slice(0, 120) ?? "",
  };
}

export function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [cwd, setCwd] = useState<string | null>(null);
  const [perm, setPerm] = useState<{ id: string; title: string; detail?: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const assistantIdx = useRef<number | null>(null);
  const started = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      await refreshSessions();
      await newSession();
    })();
    return () => wsRef.current?.close();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function refreshSessions() {
    try {
      const list = (await (await fetch(`${httpBase}/sessions`)).json()) as SessionSummary[];
      setSessions(list);
    } catch {
      /* ignore */
    }
  }

  function connect(id: string) {
    wsRef.current?.close();
    assistantIdx.current = null;
    const ws = new WebSocket(`${wsBase}/sessions/${id}/stream`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => onEvent(JSON.parse(ev.data) as StreamEvent);
  }

  async function newSession() {
    try {
      const body = JSON.stringify(cwd ? { cwd } : {});
      const record = (await (
        await fetch(`${httpBase}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        })
      ).json()) as { id: string };
      setCurrentId(record.id);
      setMessages([]);
      connect(record.id);
      void refreshSessions();
    } catch {
      setMessages([{ role: "error", text: "Could not reach the termcoder server." }]);
    }
  }

  async function openSession(id: string) {
    if (id === currentId) return;
    try {
      const segments = (await (await fetch(`${httpBase}/sessions/${id}/transcript`)).json()) as Segment[];
      setMessages(segments.map(segToMessage));
      setCurrentId(id);
      connect(id);
    } catch {
      /* ignore */
    }
  }

  async function chooseFolder() {
    const folder = await window.api?.pickFolder();
    if (folder) {
      setCwd(folder);
      // Start a fresh session rooted at the chosen folder.
      const body = JSON.stringify({ cwd: folder });
      const record = (await (
        await fetch(`${httpBase}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        })
      ).json()) as { id: string };
      setCurrentId(record.id);
      setMessages([]);
      connect(record.id);
      void refreshSessions();
    }
  }

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
          next.push({ role: "tool", name: e.name, text: e.title ?? "", status: "running", detail: e.detail });
          break;
        case "tool-result":
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i]!.role === "tool" && next[i]!.status === "running") {
              next[i] = { ...next[i]!, status: e.isError ? "error" : "done" };
              break;
            }
          }
          break;
        case "error":
          next.push({ role: "error", text: e.error });
          break;
        case "done":
          setBusy(false);
          void refreshSessions();
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
      <aside className="sidebar">
        <div className="brand">❯ termcoder</div>
        <button className="primary" onClick={() => void newSession()}>+ New chat</button>
        <button className="ghost" onClick={() => void chooseFolder()}>
          📁 {cwd ? cwd.split(/[\\/]/).pop() : "Choose folder"}
        </button>
        <div className="sessions">
          {sessions.map((s) => (
            <button
              key={s.id}
              className={`session ${s.id === currentId ? "active" : ""}`}
              onClick={() => void openSession(s.id)}
            >
              <span className="title">{s.title}</span>
              <span className="muted">{s.messageCount} msgs</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className={`dot ${connected ? "on" : "off"}`} />
          <span className="muted">{connected ? "connected" : "connecting…"}</span>
        </header>

        <div className="transcript" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="empty">Ask termcoder to write code, run commands, or search the web.</div>
          ) : null}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "user" ? <div className="bubble user">{m.text}</div> : null}
              {m.role === "assistant" ? (
                <div className="bubble assistant markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {m.text}
                  </ReactMarkdown>
                </div>
              ) : null}
              {m.role === "tool" ? (
                <div className="tool-wrap">
                  <div className="tool">
                    <span className={`status ${m.status}`}>
                      {m.status === "error" ? "✗" : m.status === "done" ? "✓" : "•"}
                    </span>
                    <span className="toolname">{m.name}</span>
                    {m.text ? <span className="muted"> {m.text}</span> : null}
                  </div>
                  {m.detail ? (
                    isDiff(m.detail) ? <DiffBlock text={m.detail} /> : <pre className="detail">{m.detail}</pre>
                  ) : null}
                </div>
              ) : null}
              {m.role === "error" ? <div className="bubble error">✗ {m.text}</div> : null}
            </div>
          ))}
          {busy ? <div className="bubble muted">▍ thinking…</div> : null}
        </div>

        {perm ? (
          <div className="perm">
            <div className="perm-card">
              <div className="perm-title">Allow this action?</div>
              <div className="perm-detail">{perm.title}</div>
              {perm.detail ? (
                isDiff(perm.detail) ? <DiffBlock text={perm.detail} /> : <pre className="detail">{perm.detail}</pre>
              ) : null}
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
            placeholder="Ask termcoder to do something…  (Enter to send, Shift+Enter for newline)"
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
      </main>
    </div>
  );
}
