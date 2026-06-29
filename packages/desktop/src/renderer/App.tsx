import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { FileTree } from "./FileTree";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import {
  IconBack,
  IconClose,
  IconForward,
  IconMaximize,
  IconMinimize,
  IconMoon,
  IconNewChat,
  IconPanelRight,
  IconPlus,
  IconSearch,
  IconSend,
  IconSidebar,
  IconSun,
} from "./Icons";

declare global {
  interface Window {
    api?: {
      serverPort: number;
      pickFolder: () => Promise<string | null>;
      listDir: (dir: string) => Promise<Array<{ name: string; dir: boolean }>>;
      allFiles: (dir: string) => Promise<string[]>;
      readFile: (path: string) => Promise<{ content: string; error?: string }>;
      gitStatus: (dir: string) => Promise<{ map: Record<string, string>; count: number }>;
      minimize: () => void;
      maximize: () => void;
      closeWindow: () => void;
    };
  }
}

const port =
  window.api?.serverPort || Number(new URLSearchParams(location.search).get("port")) || 4096;
const httpBase = `http://localhost:${port}`;
const wsBase = `ws://localhost:${port}`;

const MODELS = [
  "google/gemini-2.5-flash",
  "anthropic/claude-opus-4-8",
  "anthropic/claude-sonnet-4-6",
  "openai/gpt-4o",
  "ollama/llama3.1",
];

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

const isDiff = (t: string) => /^[+-] /m.test(t);
const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? "project";
const shortPath = (p: string) => {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.length > 3 ? `…\\${parts.slice(-2).join("\\")}` : p;
};
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function DiffBlock({ text }: { text: string }) {
  return (
    <pre className="diff">
      {text.split("\n").map((line, i) => (
        <div key={i} className={line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "ctx"}>
          {line}
        </div>
      ))}
    </pre>
  );
}

function Viewer({ name, content, onClose }: { name: string; content: string; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.removeAttribute("data-highlighted");
      try {
        hljs.highlightElement(ref.current);
      } catch {
        /* ignore */
      }
    }
  }, [name, content]);
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  return (
    <div className="viewer" onClick={onClose}>
      <div className="viewer-card" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-head">
          <span className="vname">{name}</span>
          <button className="icon" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <pre className="viewer-body">
          <code ref={ref} className={`language-${ext}`}>
            {content}
          </code>
        </pre>
      </div>
    </div>
  );
}

function segToMessage(seg: Segment): Message {
  if (seg.role === "user") return { role: "user", text: seg.text };
  if (seg.role === "assistant" && !seg.label) return { role: "assistant", text: seg.text };
  if (seg.role === "assistant")
    return { role: "tool", name: seg.label?.replace("→ ", ""), status: "done", text: "", detail: seg.text };
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
  const [model, setModel] = useState<string>(MODELS[0]!);
  const [tokens, setTokens] = useState(0);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [changes, setChanges] = useState(0);
  const [perm, setPerm] = useState<{ id: string; title: string; detail?: string } | null>(null);
  const [viewer, setViewer] = useState<{ name: string; content: string } | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"files" | "changes">("files");
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("tc-theme") as "dark" | "light") || "dark",
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [fileList, setFileList] = useState<string[]>([]);
  const [mention, setMention] = useState<{ query: string; items: string[]; active: number } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const assistantIdx = useRef<number | null>(null);
  const started = useRef(false);
  const cwdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tc-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      setSessions((await (await fetch(`${httpBase}/sessions`)).json()) as SessionSummary[]);
    } catch {
      /* ignore */
    }
  }

  async function refreshGit() {
    const dir = cwdRef.current;
    if (!dir) return;
    const res = await window.api?.gitStatus(dir);
    if (res) {
      setStatus(res.map);
      setChanges(res.count);
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

  function setWorkingDir(dir: string) {
    setCwd(dir);
    cwdRef.current = dir;
    void refreshGit();
    void window.api?.allFiles(dir).then(setFileList);
  }

  async function createSession(folder?: string) {
    const body = JSON.stringify(folder ? { cwd: folder } : {});
    const record = (await (
      await fetch(`${httpBase}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body })
    ).json()) as { id: string; cwd: string; model: string };
    setCurrentId(record.id);
    setModel(record.model);
    setMessages([]);
    setWorkingDir(record.cwd);
    connect(record.id);
    void refreshSessions();
  }

  async function newSession() {
    try {
      await createSession(cwdRef.current ?? undefined);
    } catch {
      setMessages([{ role: "error", text: "Could not reach the termcoder server." }]);
    }
  }

  async function openSession(id: string) {
    if (id === currentId) return;
    try {
      const [record, segments] = await Promise.all([
        fetch(`${httpBase}/sessions/${id}`).then((r) => r.json()) as Promise<{ cwd: string; model: string }>,
        fetch(`${httpBase}/sessions/${id}/transcript`).then((r) => r.json()) as Promise<Segment[]>,
      ]);
      setCurrentId(id);
      setModel(record.model);
      setMessages(segments.map(segToMessage));
      setWorkingDir(record.cwd);
      connect(id);
    } catch {
      /* ignore */
    }
  }

  async function chooseFolder() {
    const folder = await window.api?.pickFolder();
    if (folder) await createSession(folder);
  }

  async function openFile(path: string) {
    const res = await window.api?.readFile(path);
    if (res) setViewer({ name: baseName(path), content: res.content });
  }

  function changeModel(m: string) {
    setModel(m);
    if (currentId) {
      void fetch(`${httpBase}/sessions/${currentId}/model`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: m }),
      });
    }
  }

  function onEvent(e: StreamEvent) {
    if (e.type === "permission-request") {
      setPerm({ id: e.id, title: e.request.title, detail: e.request.detail });
      return;
    }
    if (e.type === "usage") {
      setTokens((t) => t + e.inputTokens + e.outputTokens);
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
          void refreshGit();
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
    setMention(null);
    assistantIdx.current = null;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    wsRef.current?.send(JSON.stringify({ type: "prompt", text }));
  }

  function updateMention(value: string, caret: number) {
    const m = /@([\w./\\-]*)$/.exec(value.slice(0, caret));
    if (!m) {
      setMention(null);
      return;
    }
    const q = m[1]!.toLowerCase();
    const items = fileList.filter((f) => f.toLowerCase().includes(q)).slice(0, 8);
    setMention(items.length ? { query: m[1]!, items, active: 0 } : null);
  }

  function insertMention(file: string) {
    const el = inputRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? input.length;
    const upto = input.slice(0, caret);
    const m = /@([\w./\\-]*)$/.exec(upto);
    if (!m) return;
    const before = upto.slice(0, m.index);
    const next = `${before}@${file} ${input.slice(caret)}`;
    setInput(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = `${before}@${file} `.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  const project = cwd ? baseName(cwd) : "termcoder";
  const currentTitle = sessions.find((s) => s.id === currentId)?.title ?? "New session";
  const changedFiles = Object.entries(status);

  const paletteItems: PaletteItem[] = [
    { id: "new", label: "New session", hint: "command", run: () => void newSession() },
    { id: "folder", label: "Choose folder…", hint: "command", run: () => void chooseFolder() },
    { id: "left", label: "Toggle sessions panel", hint: "command", run: () => setLeftOpen((v) => !v) },
    { id: "right", label: "Toggle files panel", hint: "command", run: () => setRightOpen((v) => !v) },
    {
      id: "theme",
      label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
      hint: "command",
      run: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    },
    ...MODELS.map((m) => ({ id: `model:${m}`, label: m, hint: "model", run: () => changeModel(m) })),
    ...sessions.map((s) => ({ id: `sess:${s.id}`, label: s.title, hint: "session", run: () => void openSession(s.id) })),
    ...fileList.slice(0, 600).map((f) => ({
      id: `file:${f}`,
      label: f,
      hint: "file",
      run: () => cwd && void openFile(`${cwd}/${f}`),
    })),
  ];

  return (
    <div className="shell">
      <header className="toolbar">
        <div className="tb-left">
          <button className="icon" title="Toggle sidebar" onClick={() => setLeftOpen((v) => !v)}><IconSidebar /></button>
          <button className="icon dim" title="Back"><IconBack /></button>
          <button className="icon dim" title="Forward"><IconForward /></button>
        </div>
        <div className="tb-center">
          <button className="search" onClick={() => setPaletteOpen(true)}>
            <IconSearch />
            <span className="search-label">Search {project}</span>
            <span className="kbd">Ctrl K</span>
          </button>
        </div>
        <div className="tb-right">
          <button className="icon" title="New session" onClick={() => void newSession()}><IconNewChat /></button>
          <button className="icon" title="Toggle files" onClick={() => setRightOpen((v) => !v)}><IconPanelRight /></button>
          <button
            className="icon"
            title="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
          <div className="win-controls">
            <button className="win-btn" title="Minimize" onClick={() => window.api?.minimize()}><IconMinimize /></button>
            <button className="win-btn" title="Maximize" onClick={() => window.api?.maximize()}><IconMaximize /></button>
            <button className="win-btn close" title="Close" onClick={() => window.api?.closeWindow()}><IconClose /></button>
          </div>
        </div>
      </header>

      <div className="body">
        {leftOpen ? (
          <aside className="left">
            <div className="project">
              <div className="avatar">{project.charAt(0).toUpperCase()}</div>
              <div className="pinfo">
                <div className="pname">{project}</div>
                {cwd ? <div className="ppath">{shortPath(cwd)}</div> : null}
              </div>
              <button className="icon" title="Choose folder" onClick={() => void chooseFolder()}>…</button>
            </div>
            <button className="new-session" onClick={() => void newSession()}>
              <IconNewChat /> New session
            </button>
            <div className="session-list">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  className={`session ${s.id === currentId ? "active" : ""}`}
                  onClick={() => void openSession(s.id)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <main className="center">
          <div className="chat-head">
            <span className="ch-title">{currentTitle}</span>
            <span className={`dot ${connected ? "on" : "off"}`} title={connected ? "connected" : "connecting"} />
            <div className="ch-right">
              {tokens > 0 ? <span className="muted">{fmtTokens(tokens)} tok</span> : null}
            </div>
          </div>

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
                    {m.detail ? (isDiff(m.detail) ? <DiffBlock text={m.detail} /> : <pre className="detail">{m.detail}</pre>) : null}
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
                {perm.detail ? (isDiff(perm.detail) ? <DiffBlock text={perm.detail} /> : <pre className="detail">{perm.detail}</pre>) : null}
                <div className="perm-actions">
                  <button className="allow" onClick={() => decide("allow")}>Allow</button>
                  <button className="always" onClick={() => decide("allow-always")}>Always</button>
                  <button className="deny" onClick={() => decide("deny")}>Deny</button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="dock">
            {mention ? (
              <div className="mention-pop">
                {mention.items.map((f, i) => (
                  <div
                    key={f}
                    className={`mention-item ${i === mention.active ? "active" : ""}`}
                    onMouseEnter={() => setMention((m) => (m ? { ...m, active: i } : m))}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(f);
                    }}
                  >
                    {f}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="composer">
              <button className="attach" title="Attach"><IconPlus /></button>
              <textarea
                ref={inputRef}
                value={input}
                placeholder="Ask anything…  (@ to add a file)"
                onChange={(e) => {
                  setInput(e.target.value);
                  updateMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onKeyDown={(e) => {
                  if (mention) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMention((m) => (m ? { ...m, active: Math.min(m.active + 1, m.items.length - 1) } : m));
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMention((m) => (m ? { ...m, active: Math.max(m.active - 1, 0) } : m));
                      return;
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      insertMention(mention.items[mention.active]!);
                      return;
                    }
                    if (e.key === "Escape") {
                      setMention(null);
                      return;
                    }
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button className="send" onClick={send} disabled={busy || !connected}><IconSend /></button>
            </div>
            <div className="selectors">
              <span className="chip">Build ▾</span>
              <span className="chip model">
                <select value={model} onChange={(e) => changeModel(e.target.value)}>
                  {MODELS.includes(model) ? null : <option value={model}>{model}</option>}
                  {MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </span>
              <span className="chip">Default ▾</span>
            </div>
          </div>
        </main>

        {rightOpen ? (
          <aside className="right">
            <div className="right-tabs">
              <button className={rightTab === "changes" ? "active" : ""} onClick={() => setRightTab("changes")}>
                {changes} Changes
              </button>
              <button className={rightTab === "files" ? "active" : ""} onClick={() => setRightTab("files")}>
                All files
              </button>
            </div>
            {rightTab === "files" ? (
              <FileTree root={cwd} status={status} onOpen={(p) => void openFile(p)} />
            ) : changedFiles.length === 0 ? (
              <div className="muted tree-empty">No changes.</div>
            ) : (
              <div className="tree">
                {changedFiles.map(([path, letter]) => (
                  <div
                    key={path}
                    className="tree-row"
                    onClick={() => cwd && void openFile(`${cwd}/${path}`)}
                  >
                    <span
                      className="git-badge"
                      style={{ color: letter === "A" ? "var(--ok)" : letter === "D" ? "var(--bad)" : "var(--warn)" }}
                    >
                      {letter}
                    </span>
                    <span className="fname">{path}</span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        ) : null}
      </div>

      {viewer ? <Viewer name={viewer.name} content={viewer.content} onClose={() => setViewer(null)} /> : null}
      {paletteOpen ? <CommandPalette items={paletteItems} onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
