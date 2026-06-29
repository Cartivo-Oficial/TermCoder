import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { FileTree } from "./FileTree";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { Settings, type ServerStatus, type SettingsTab } from "./Settings";
import {
  IconBack,
  IconClose,
  IconForward,
  IconGear,
  IconHelp,
  IconMaximize,
  IconMenu,
  IconMinimize,
  IconMoon,
  IconNewChat,
  IconPanelRight,
  IconServer,
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
      gitDiff: (dir: string, path: string) => Promise<{ diff: string }>;
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
  "google/gemini-2.0-flash",
  "google/gemini-2.5-pro",
  "anthropic/claude-opus-4-8",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-haiku-4-5",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/o3-mini",
  "ollama/llama3.1",
  "ollama/qwen2.5",
  "ollama/mistral-nemo",
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
  return parts.length > 3 ? `â€¦\\${parts.slice(-2).join("\\")}` : p;
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

interface Tab {
  id: string;
  name: string;
  kind: "file" | "diff";
  content: string;
}

function FileBody({ name, content }: { name: string; content: string }) {
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
    <pre className="viewer-body">
      <code ref={ref} className={`language-${ext}`}>
        {content}
      </code>
    </pre>
  );
}

function DiffBody({ content }: { content: string }) {
  return (
    <pre className="viewer-body diff">
      {content.split("\n").map((line, i) => {
        const cls =
          line.startsWith("+") && !line.startsWith("+++") ? "add"
          : line.startsWith("-") && !line.startsWith("---") ? "del"
          : line.startsWith("@@") ? "hunk"
          : "ctx";
        return (
          <div key={i} className={cls}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

function TabbedViewer({
  tabs,
  activeTab,
  onActivate,
  onClose,
  onCloseTab,
}: {
  tabs: Tab[];
  activeTab: string | null;
  onActivate: (id: string) => void;
  onClose: () => void;
  onCloseTab: (id: string) => void;
}) {
  const tab = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  if (!tab) return null;
  return (
    <div className="viewer" onClick={onClose}>
      <div className="viewer-card" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-tabs">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={`vtab ${t.id === tab.id ? "active" : ""}`}
              onClick={() => onActivate(t.id)}
            >
              <span className="vtab-name">{t.kind === "diff" ? "Â± " : ""}{t.name}</span>
              <button
                className="vtab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(t.id);
                }}
              >
                <IconClose />
              </button>
            </div>
          ))}
          <div className="vtab-spacer" />
          <button className="icon" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        {tab.kind === "file" ? (
          <FileBody name={tab.name} content={tab.content} />
        ) : (
          <DiffBody content={tab.content} />
        )}
      </div>
    </div>
  );
}

function segToMessage(seg: Segment): Message {
  if (seg.role === "user") return { role: "user", text: seg.text };
  if (seg.role === "assistant" && !seg.label) return { role: "assistant", text: seg.text };
  if (seg.role === "assistant")
    return { role: "tool", name: seg.label?.replace("â†’ ", ""), status: "done", text: "", detail: seg.text };
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
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"files" | "changes">("files");
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("tc-theme") as "dark" | "light") || "dark",
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [autoApprove, setAutoApprove] = useState(() => localStorage.getItem("tc-auto") === "1");
  const [defaultModel, setDefaultModel] = useState(() => localStorage.getItem("tc-model") || "");
  const [sendOnEnter, setSendOnEnter] = useState(() => localStorage.getItem("tc-enter") !== "0");
  const [expandTools, setExpandTools] = useState(() => localStorage.getItem("tc-expand") === "1");
  const [progressBar, setProgressBar] = useState(() => localStorage.getItem("tc-progress") !== "0");
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem("tc-fs")) || 14);
  const [menuOpen, setMenuOpen] = useState(false);
  const [serversOpen, setServersOpen] = useState(false);
  const [fileList, setFileList] = useState<string[]>([]);
  const autoApproveRef = useRef(autoApprove);
  const navStack = useRef<string[]>([]);
  const navPos = useRef(-1);
  const navigating = useRef(false);
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
    autoApproveRef.current = autoApprove;
    localStorage.setItem("tc-auto", autoApprove ? "1" : "0");
  }, [autoApprove]);

  useEffect(() => {
    if (defaultModel) localStorage.setItem("tc-model", defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    document.documentElement.style.setProperty("--fs", `${fontSize}px`);
    localStorage.setItem("tc-fs", String(fontSize));
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem("tc-enter", sendOnEnter ? "1" : "0");
  }, [sendOnEnter]);
  useEffect(() => {
    localStorage.setItem("tc-expand", expandTools ? "1" : "0");
  }, [expandTools]);
  useEffect(() => {
    localStorage.setItem("tc-progress", progressBar ? "1" : "0");
  }, [progressBar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && k === "n") {
        e.preventDefault();
        void newSession();
      } else if (mod && k === "b") {
        e.preventDefault();
        setLeftOpen((v) => !v);
      } else if (mod && k === "j") {
        e.preventDefault();
        setRightOpen((v) => !v);
      } else if (mod && k === "o") {
        e.preventDefault();
        void chooseFolder();
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setViewerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const list = (await (await fetch(`${httpBase}/sessions`)).json()) as SessionSummary[];
        setSessions(list);
        const savedSession = localStorage.getItem("tc-session");
        const savedCwd = localStorage.getItem("tc-cwd");
        if (savedSession && list.some((s) => s.id === savedSession)) await openSession(savedSession);
        else await createSession(savedCwd ?? undefined);
      } catch {
        setMessages([{ role: "error", text: "Could not reach the termcoder server." }]);
      }
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

  async function refreshStatus() {
    try {
      setServerStatus((await (await fetch(`${httpBase}/status`)).json()) as ServerStatus);
    } catch {
      /* ignore */
    }
  }

  function pushNav(id: string) {
    if (navigating.current) {
      navigating.current = false;
      return;
    }
    navStack.current = navStack.current.slice(0, navPos.current + 1);
    navStack.current.push(id);
    navPos.current = navStack.current.length - 1;
  }
  function navBack() {
    if (navPos.current > 0) {
      navPos.current -= 1;
      navigating.current = true;
      void openSession(navStack.current[navPos.current]!);
    }
  }
  function navForward() {
    if (navPos.current < navStack.current.length - 1) {
      navPos.current += 1;
      navigating.current = true;
      void openSession(navStack.current[navPos.current]!);
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
    localStorage.setItem("tc-cwd", dir);
    void refreshGit();
    void window.api?.allFiles(dir).then(setFileList);
  }

  async function createSession(folder?: string) {
    const body = JSON.stringify(folder ? { cwd: folder } : {});
    const record = (await (
      await fetch(`${httpBase}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body })
    ).json()) as { id: string; cwd: string; model: string };
    setCurrentId(record.id);
    localStorage.setItem("tc-session", record.id);
    const dm = localStorage.getItem("tc-model");
    if (dm && dm !== record.model) {
      setModel(dm);
      void fetch(`${httpBase}/sessions/${record.id}/model`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: dm }),
      });
    } else {
      setModel(record.model);
    }
    setMessages([]);
    setWorkingDir(record.cwd);
    connect(record.id);
    pushNav(record.id);
    void refreshSessions();
    void refreshStatus();
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
      localStorage.setItem("tc-session", id);
      setModel(record.model);
      setMessages(segments.map(segToMessage));
      setWorkingDir(record.cwd);
      connect(id);
      pushNav(id);
    } catch {
      /* ignore */
    }
  }

  async function chooseFolder() {
    const folder = await window.api?.pickFolder();
    if (folder) await createSession(folder);
  }

  function addTab(tab: Tab) {
    setTabs((prev) =>
      prev.some((t) => t.id === tab.id) ? prev.map((t) => (t.id === tab.id ? tab : t)) : [...prev, tab],
    );
    setActiveTab(tab.id);
    setViewerOpen(true);
  }

  function closeTab(id: string) {
    const rest = tabs.filter((t) => t.id !== id);
    setTabs(rest);
    if (rest.length === 0) setViewerOpen(false);
    else if (activeTab === id) setActiveTab(rest[rest.length - 1]!.id);
  }

  async function openFile(path: string) {
    const res = await window.api?.readFile(path);
    if (res) addTab({ id: `file:${path}`, name: baseName(path), kind: "file", content: res.content });
  }

  async function openDiff(relPath: string) {
    const dir = cwdRef.current;
    if (!dir) return;
    const res = await window.api?.gitDiff(dir, relPath);
    if (res && res.diff.trim()) {
      addTab({ id: `diff:${relPath}`, name: baseName(relPath), kind: "diff", content: res.diff });
    } else {
      await openFile(`${dir}/${relPath}`);
    }
  }

  async function openAllDiffs() {
    const dir = cwdRef.current;
    if (!dir) return;
    const res = await window.api?.gitDiff(dir, "");
    if (res && res.diff.trim()) {
      addTab({ id: "diff:__all__", name: "All changes", kind: "diff", content: res.diff });
    }
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
      if (autoApproveRef.current) {
        wsRef.current?.send(JSON.stringify({ type: "permission-decision", id: e.id, decision: "allow" }));
        return;
      }
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
    { id: "folder", label: "Choose folderâ€¦", hint: "command", run: () => void chooseFolder() },
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
          <div className="menu-wrap">
            <button className="icon" title="Menu" onClick={() => setMenuOpen((v) => !v)}><IconMenu /></button>
            {menuOpen ? (
              <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
                <button onClick={() => { setMenuOpen(false); void newSession(); }}>New session<span className="mk">Ctrl N</span></button>
                <button onClick={() => { setMenuOpen(false); void chooseFolder(); }}>Open folderâ€¦<span className="mk">Ctrl O</span></button>
                <div className="menu-sep" />
                <button onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}>Settings</button>
                <button onClick={() => { setMenuOpen(false); setPaletteOpen(true); }}>Command palette<span className="mk">Ctrl K</span></button>
                <button onClick={() => { setMenuOpen(false); setTheme((t) => (t === "dark" ? "light" : "dark")); }}>Toggle theme</button>
                <div className="menu-sep" />
                <button onClick={() => location.reload()}>Reload</button>
                <button onClick={() => window.api?.closeWindow()}>Quit</button>
              </div>
            ) : null}
          </div>
          <button className="icon" title="Toggle sidebar (Ctrl B)" onClick={() => setLeftOpen((v) => !v)}><IconSidebar /></button>
          <button className="icon dim" title="Back" onClick={navBack}><IconBack /></button>
          <button className="icon dim" title="Forward" onClick={navForward}><IconForward /></button>
        </div>
        <div className="tb-center">
          <button className="search" onClick={() => setPaletteOpen(true)}>
            <IconSearch />
            <span className="search-label">Search {project}</span>
            <span className="kbd">Ctrl K</span>
          </button>
        </div>
        <div className="tb-right">
          <div className="menu-wrap">
            <button className="icon srv" title="Servers" onClick={() => { setServersOpen((v) => !v); void refreshStatus(); }}>
              <IconServer />
              <span className="srv-dot" />
            </button>
            {serversOpen ? (
              <div className="menu servers-pop" onMouseLeave={() => setServersOpen(false)}>
                <div className="sp-row"><span className="dot on" /> Local server <span className="muted">running</span></div>
                <div className="sp-line"><span>MCP</span><span className="muted">{serverStatus?.mcp.length ?? 0}</span></div>
                <div className="sp-line"><span>LSP</span><span className="muted">{serverStatus?.lsp.length ?? 0}</span></div>
                <div className="sp-line"><span>Plugins</span><span className="muted">{serverStatus?.plugins.length ?? 0}</span></div>
                <button className="sp-manage" onClick={() => { setServersOpen(false); setSettingsTab("servers"); setSettingsOpen(true); }}>Manage servers</button>
              </div>
            ) : null}
          </div>
          <button className="icon" title="New session (Ctrl N)" onClick={() => void newSession()}><IconNewChat /></button>
          <button className="icon" title="Toggle files (Ctrl J)" onClick={() => setRightOpen((v) => !v)}><IconPanelRight /></button>
          <button className="icon" title="Toggle theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
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
              <button className="icon" title="Choose folder" onClick={() => void chooseFolder()}>â€¦</button>
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
            <div className="left-footer">
              <button className="icon" title="Settings" onClick={() => setSettingsOpen(true)}><IconGear /></button>
              <button className="icon" title="Command palette (Ctrl K)" onClick={() => setPaletteOpen(true)}><IconHelp /></button>
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
          {busy && progressBar ? <div className="progress" /> : null}

          <div className="transcript" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="empty">Ask termcoder to write code, run commands, or search the web.</div>
            ) : null}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === "user" ? <div className="bubble user">{m.text}</div> : null}
                {m.role === "assistant" ? (
                  busy && i === messages.length - 1 ? (
                    <div className="bubble assistant streaming">{m.text}</div>
                  ) : (
                    <div className="bubble assistant markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  )
                ) : null}
                {m.role === "tool" ? (
                  <div className="tool-wrap">
                    <div className="tool">
                      <span className={`status ${m.status}`}>
                        {m.status === "error" ? "âœ—" : m.status === "done" ? "âœ“" : "â€¢"}
                      </span>
                      <span className="toolname">{m.name}</span>
                      {m.text ? <span className="muted"> {m.text}</span> : null}
                    </div>
                    {m.detail && expandTools ? (isDiff(m.detail) ? <DiffBlock text={m.detail} /> : <pre className="detail">{m.detail}</pre>) : null}
                  </div>
                ) : null}
                {m.role === "error" ? <div className="bubble error">âœ— {m.text}</div> : null}
              </div>
            ))}
            {busy ? <div className="bubble muted">â– thinkingâ€¦</div> : null}
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
                placeholder="Ask anythingâ€¦  (@ to add a file)"
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
                  const wantSend = sendOnEnter
                    ? e.key === "Enter" && !e.shiftKey
                    : e.key === "Enter" && (e.ctrlKey || e.metaKey);
                  if (wantSend) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button className="send" onClick={send} disabled={busy || !connected}><IconSend /></button>
            </div>
            <div className="selectors">
              <button
                className={`chip ${autoApprove ? "armed" : ""}`}
                title="Toggle auto-approve"
                onClick={() => setAutoApprove((v) => !v)}
              >
                {autoApprove ? "Auto" : "Build"} â–¾
              </button>
              <span className="chip model">
                <select value={model} onChange={(e) => changeModel(e.target.value)}>
                  {MODELS.includes(model) ? null : <option value={model}>{model}</option>}
                  {MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </span>
              <button className="chip" onClick={() => { setSettingsTab("general"); setSettingsOpen(true); }}>
                Settings â–¾
              </button>
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
                <button className="view-all" onClick={() => void openAllDiffs()}>
                  View all diffs
                </button>
                {changedFiles.map(([path, letter]) => (
                  <div key={path} className="tree-row" onClick={() => void openDiff(path)}>
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

      {viewerOpen && tabs.length ? (
        <TabbedViewer
          tabs={tabs}
          activeTab={activeTab}
          onActivate={setActiveTab}
          onClose={() => setViewerOpen(false)}
          onCloseTab={closeTab}
        />
      ) : null}
      {paletteOpen ? <CommandPalette items={paletteItems} onClose={() => setPaletteOpen(false)} /> : null}

      {settingsOpen ? (
        <Settings
          onClose={() => setSettingsOpen(false)}
          tab={settingsTab}
          setTab={setSettingsTab}
          theme={theme}
          setTheme={setTheme}
          model={model}
          defaultModel={defaultModel}
          setDefaultModel={setDefaultModel}
          changeModel={changeModel}
          models={MODELS}
          autoApprove={autoApprove}
          setAutoApprove={setAutoApprove}
          sendOnEnter={sendOnEnter}
          setSendOnEnter={setSendOnEnter}
          expandTools={expandTools}
          setExpandTools={setExpandTools}
          progressBar={progressBar}
          setProgressBar={setProgressBar}
          fontSize={fontSize}
          setFontSize={setFontSize}
          cwd={cwd}
          chooseFolder={() => void chooseFolder()}
          serverStatus={serverStatus}
          refreshStatus={() => void refreshStatus()}
          port={port}
        />
      ) : null}
    </div>
  );
}
