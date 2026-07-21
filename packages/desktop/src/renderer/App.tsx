import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { Settings, type ServerStatus, type SettingsTab } from "./Settings";
import { Welcome } from "./Welcome";
import { Hero } from "./Hero";
import { HomeView, type HomeRecent } from "./home/HomeView";
import { relativeTime } from "./home/relativeTime";
import { useI18n } from "./i18n";
import { COLOR_THEMES, THEME_VARS } from "./themes";
import { KEYBIND_ACTIONS, comboFor, matchCombo } from "./keybinds";
import { IconStop, IconShare, IconCopy, IconEdit, IconMic, IconUndo, IconBolt, IconAgents } from "./Icons";
import { ErrorBoundary } from "./ErrorBoundary";
import { RoomView } from "./room/RoomView";
import { useRoom } from "./room/useRoom";
import { RecipesPanel } from "./RecipesPanel";
import { ClassroomPanel } from "./ClassroomPanel";
import { ModelBrowser } from "./ModelBrowser";
import { Rail } from "./Rail";
import { TerminalDeck } from "./TerminalDeck";
import { AgentCanvas } from "./canvas/AgentCanvas";
import { emptyGraph, reduceGraph, type SessionEventLike } from "./canvas/runGraph";
import { SidePanel } from "./SidePanel";
import { SessionsPanel } from "./SessionsPanel";
import { DiffBlock, DiffBody, ToolCard, type DiffComment } from "./ToolCard";
import { CodeEditor } from "./CodeEditor";
import { blobToWav, blobToBase64 } from "./audio";
import {
  IconBack,
  IconClose,
  IconForward,
  IconMaximize,
  IconMenu,
  IconMinimize,
  IconMoon,
  IconServer,
  IconPlus,
  IconSearch,
  IconSend,
  IconSun,
} from "./Icons";

declare global {
  interface Window {
    api?: {
      serverPort: number;
      pickFolder: () => Promise<string | null>;
      pickFile: () => Promise<string[]>;
      readImage: (path: string) => Promise<{ dataUrl: string; mediaType: string } | null>;
      listDir: (dir: string) => Promise<Array<{ name: string; dir: boolean }>>;
      allFiles: (dir: string) => Promise<string[]>;
      readFile: (path: string) => Promise<{ content: string; error?: string }>;
      writeFile: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>;
      saveFile: (defaultName: string, content: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
      notify: (title: string, body: string) => void;
      checkUpdate: () => Promise<{ current: string; latest: string; hasUpdate: boolean }>;
      gitStatus: (dir: string, base?: string) => Promise<{ map: Record<string, string>; count: number }>;
      gitDiff: (dir: string, path: string, base?: string) => Promise<{ diff: string }>;
      gitBranches: (dir: string) => Promise<{ branches: string[]; current: string }>;
      minimize: () => void;
      maximize: () => void;
      closeWindow: () => void;
      getLoginItem: () => Promise<boolean>;
      setLoginItem: (open: boolean) => void;
      gitCommit: (dir: string, message: string) => Promise<{ ok: boolean; message: string }>;
      setTray: (enabled: boolean) => void;
      setGlobalShortcut: (enabled: boolean, accelerator: string) => void;
      pty: {
        available: () => Promise<{ ok: boolean; error?: string }>;
        tools: () => Promise<Array<{ id: string; label: string; command: string }>>;
        start: (id: number, options: { cwd: string | null; cols: number; rows: number }) => Promise<
          { ok: true; pid: number } | { ok: false; error: string }
        >;
        write: (id: number, data: string) => void;
        resize: (id: number, cols: number, rows: number) => void;
        kill: (id: number) => void;
        onData: (id: number, cb: (data: string) => void) => () => void;
        onExit: (id: number, cb: (code: number) => void) => () => void;
      };
    };
  }
}

const port =
  window.api?.serverPort ||
  Number(new URLSearchParams(location.search).get("port")) ||
  Number(location.port) ||
  4096;
const host = location.hostname || "localhost";
const scheme = location.protocol === "https:" ? "https:" : "http:";
const wsScheme = location.protocol === "https:" ? "wss:" : "ws:";
const httpBase = `${scheme}//${host}:${port}`;
const wsBase = `${wsScheme}//${host}:${port}`;

const HOME_DIR = decodeURIComponent(new URLSearchParams(location.search).get("home") || "");
const DEFAULT_DIR = decodeURIComponent(new URLSearchParams(location.search).get("docs") || "") || HOME_DIR;
const JOIN_SESSION = new URLSearchParams(location.search).get("session") || "";
const JOIN_ROOM = new URLSearchParams(location.search).get("room") || "";
const isGuest = !!JOIN_ROOM;
function cleanDir(dir?: string | null): string | undefined {
  if (!dir) return undefined;
  return HOME_DIR && dir === HOME_DIR ? DEFAULT_DIR || undefined : dir;
}

const MODELS = [
  "termcoder/auto",
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash",
  "google/gemini-2.5-pro",
  "anthropic/claude-opus-4-8",
  "anthropic/claude-sonnet-5",
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
  images?: string[];
}
interface PendingImage {
  dataUrl: string;
  mediaType: string;
  name: string;
}
interface AgentInfo {
  name: string;
  description?: string;
  mode: "primary" | "subagent" | "all";
  builtin: boolean;
  readOnly: boolean;
  color?: string;
}
interface CommandInfo {
  name: string;
  description?: string;
  agent?: string;
  model?: string;
}
interface SessionSummary {
  id: string;
  title: string;
  messageCount: number;
  cwd: string;
  model: string;
  usage?: { tokensIn: number; tokensOut: number };
}

const sessionLabel = (s: { title: string; cwd: string }): string =>
  !s.title || s.title === "Untitled session" ? baseName(s.cwd) : s.title;
interface Segment {
  role: "user" | "assistant" | "tool";
  label?: string;
  code?: boolean;
  text: string;
}
// deno-lint-ignore no-explicit-any
type StreamEvent = any;

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const isDiff = (t: string) => /^[+-] /m.test(t);
const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? "project";
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => void ctx.close();
  } catch {
  }
}

interface Tab {
  id: string;
  name: string;
  kind: "file" | "diff";
  content: string;
  path?: string;
  dirty?: boolean;
}

function TabbedViewer({
  tabs,
  activeTab,
  onActivate,
  onClose,
  onCloseTab,
  onEdit,
  onSave,
  onAskAI,
  aiSuggest,
  codeTheme,
  comments,
  onAddComment,
  onRemoveComment,
  hunkIndex,
  hunkCount,
  onHunkCount,
  onPrevHunk,
  onNextHunk,
  onSendComments,
  compareBase,
}: {
  tabs: Tab[];
  activeTab: string | null;
  onActivate: (id: string) => void;
  onClose: () => void;
  onCloseTab: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onSave: (id: string) => void;
  onAskAI: (tab: Tab) => void;
  aiSuggest: boolean;
  codeTheme: string;
  comments: DiffComment[];
  onAddComment: (key: string, text: string) => void;
  onRemoveComment: (id: string) => void;
  hunkIndex: number;
  hunkCount: number;
  onHunkCount: (n: number) => void;
  onPrevHunk: () => void;
  onNextHunk: () => void;
  onSendComments: () => void;
  compareBase: string;
}) {
  const { t } = useI18n();
  const tab = tabs.find((tt) => tt.id === activeTab) ?? tabs[0];
  if (!tab) return null;
  return (
    <div className="viewer" onClick={onClose}>
      <div className="viewer-card" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-tabs">
          {tabs.map((tt) => (
            <div
              key={tt.id}
              className={`vtab ${tt.id === tab.id ? "active" : ""}`}
              onClick={() => onActivate(tt.id)}
            >
              <span className="vtab-name">{tt.kind === "diff" ? "± " : ""}{tt.name}{tt.dirty ? " •" : ""}</span>
              <button
                className="vtab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tt.id);
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
          <div className="editor-pane">
            <div className="editor-bar">
              <span className="editor-path">{tab.name}</span>
              <div className="editor-actions">
                <button className="settings-btn" onClick={() => onAskAI(tab)}>{t("editor.ask")}</button>
                <button className="settings-btn primary" disabled={!tab.dirty} onClick={() => onSave(tab.id)}>
                  {tab.dirty ? t("editor.save") : t("editor.saved")}
                </button>
              </div>
            </div>
            <CodeEditor
              key={tab.id}
              name={tab.name}
              value={tab.content}
              onChange={(v) => onEdit(tab.id, v)}
              onSave={() => onSave(tab.id)}
              port={port}
              aiSuggest={aiSuggest}
              theme={codeTheme}
            />
          </div>
        ) : (
          <div className="editor-pane">
            <div className="editor-bar">
              <span className="editor-path">
                {tab.name}
                {compareBase ? <span className="diff-base-badge">vs {compareBase}</span> : null}
              </span>
              <div className="editor-actions">
                {hunkCount > 0 ? (
                  <span className="hunk-nav">
                    <button className="icon sm" title={t("review.prevHunk")} disabled={hunkIndex <= 0} onClick={onPrevHunk}>
                      <IconBack />
                    </button>
                    <span className="hunk-count">{t("review.hunkOf", { n: hunkIndex + 1, total: hunkCount })}</span>
                    <button
                      className="icon sm"
                      title={t("review.nextHunk")}
                      disabled={hunkIndex >= hunkCount - 1}
                      onClick={onNextHunk}
                    >
                      <IconForward />
                    </button>
                  </span>
                ) : null}
                {comments.length ? (
                  <button className="settings-btn" onClick={onSendComments}>
                    {t("review.sendComments")} ({comments.length})
                  </button>
                ) : null}
              </div>
            </div>
            <DiffBody
              content={tab.content}
              path={tab.path}
              comments={comments}
              onAddComment={onAddComment}
              onRemoveComment={onRemoveComment}
              hunkIndex={hunkIndex}
              onHunkCount={onHunkCount}
            />
          </div>
        )}
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

function accentDim(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}

export function App() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("tc-open-tabs") || "[]");
      return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const closedTabsRef = useRef<string[]>([]);
  const dragTabRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [cwd, setCwd] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<"chat" | "terminal" | "canvas">("chat");
  const [graph, setGraph] = useState(() => emptyGraph("root"));
  const [termMounted, setTermMounted] = useState(false);
  const [model, setModel] = useState<string>(MODELS[0]!);
  const [tokens, setTokens] = useState(0);
  const [tokensIn, setTokensIn] = useState(0);
  const [tokensOut, setTokensOut] = useState(0);
  const [lastCtx, setLastCtx] = useState(0);
  const [liveTokens, setLiveTokens] = useState(0);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [changes, setChanges] = useState(0);
  const [perm, setPerm] = useState<{ id: string; title: string; detail?: string } | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [compareBase, setCompareBaseState] = useState("");
  const compareBaseRef = useRef("");
  const [branches, setBranches] = useState<string[]>([]);
  const [reviewComments, setReviewComments] = useState<DiffComment[]>([]);
  const [hunkIndex, setHunkIndex] = useState(0);
  const [hunkCount, setHunkCount] = useState(0);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [classroomOpen, setClassroomOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [sidePanel, setSidePanel] = useState<null | "files" | "study" | "agents">(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [myName, setMyName] = useState<string>(() => localStorage.getItem("tc-name") || "You");
  const myNameRef = useRef(myName);
  useEffect(() => {
    myNameRef.current = myName;
    localStorage.setItem("tc-name", myName);
  }, [myName]);
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem("tc-onboarded") === "1");
  const [studentMode, setStudentMode] = useState(() => localStorage.getItem("tc-student") === "1");
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("tc-theme") as "dark" | "light") || "dark",
  );
  const [colorTheme, setColorTheme] = useState<string>(() => localStorage.getItem("tc-colortheme") || "default");
  const [keybinds, setKeybinds] = useState<Record<string, string>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [autoApprove, setAutoApprove] = useState(() => localStorage.getItem("tc-auto") === "1");
  const [autonomous, setAutonomous] = useState(false);
  const [update, setUpdate] = useState<{ latest: string } | null>(null);

  useEffect(() => {
    window.api
      ?.checkUpdate?.()
      .then((r) => {
        if (r?.hasUpdate && localStorage.getItem("tc-skip-update") !== r.latest) setUpdate({ latest: r.latest });
      })
      .catch(() => {});
  }, []);
  const [defaultModel, setDefaultModel] = useState(() => localStorage.getItem("tc-model") || "");
  const [sendOnEnter, setSendOnEnter] = useState(() => localStorage.getItem("tc-enter") !== "0");
  const [expandTools, setExpandTools] = useState(() => localStorage.getItem("tc-expand") === "1");
  const [progressBar, setProgressBar] = useState(() => localStorage.getItem("tc-progress") !== "0");
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem("tc-fs")) || 14);
  const [accent, setAccent] = useState(() => {
    const saved = localStorage.getItem("tc-accent");
    if (!saved || saved === "#ededee" || saved === "#e6e6e7") return "";
    return saved;
  });
  const [density, setDensity] = useState<"comfortable" | "compact">(
    () => (localStorage.getItem("tc-density") as "comfortable" | "compact") || "comfortable",
  );
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem("tc-motion") === "off");
  const [autoScroll, setAutoScroll] = useState(() => localStorage.getItem("tc-autoscroll") !== "0");
  const [confirmDelete, setConfirmDelete] = useState(() => localStorage.getItem("tc-confirmdel") !== "0");
  const [temperature, setTemperature] = useState(() => {
    const v = localStorage.getItem("tc-temp");
    return v === null ? 0.7 : Number(v);
  });
  const [maxSteps, setMaxSteps] = useState(() => Number(localStorage.getItem("tc-maxsteps")) || 25);
  const [soundOnFinish, setSoundOnFinish] = useState(() => localStorage.getItem("tc-sound") === "1");
  const [micDeviceId, setMicDeviceId] = useState(() => localStorage.getItem("tc-mic") || "");
  const [wordWrap, setWordWrap] = useState(() => localStorage.getItem("tc-wrap") === "1");
  const [aiSuggest, setAiSuggest] = useState(() => localStorage.getItem("tc-aisuggest") === "1");
  const [codeTheme, setCodeTheme] = useState(() => localStorage.getItem("tc-codetheme") || "one-dark");
  const [notifyOnFinish, setNotifyOnFinish] = useState(() => localStorage.getItem("tc-notify") === "1");
  const [autoCommit, setAutoCommit] = useState(() => localStorage.getItem("tc-autocommit") === "1");
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [enableTray, setEnableTray] = useState(() => localStorage.getItem("tc-tray") === "1");
  const [enableHotkey, setEnableHotkey] = useState(() => localStorage.getItem("tc-hotkey") === "1");
  const soundRef = useRef(soundOnFinish);
  const micRef = useRef(micDeviceId);
  const notifyRef = useRef(notifyOnFinish);
  const autoCommitRef = useRef(autoCommit);
  const [agent, setAgent] = useState<string>(() => localStorage.getItem("tc-agent") || "build");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [catalog, setCatalog] = useState<Array<{ id: string; contextK?: number }>>([]);
  const [agentOpen, setAgentOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [serversOpen, setServersOpen] = useState(false);
  const [fileList, setFileList] = useState<string[]>([]);
  const autoApproveRef = useRef(autoApprove);
  const navStack = useRef<string[]>([]);
  const navPos = useRef(-1);
  const navigating = useRef(false);
  const [mention, setMention] = useState<{ query: string; items: string[]; active: number } | null>(null);
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [cmdMatch, setCmdMatch] = useState<{ items: CommandInfo[]; active: number } | null>(null);
  const [cmdPreview, setCmdPreview] = useState<string>("");
  const cmdPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [canRevert, setCanRevert] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const room = useRoom({
    port,
    secure: scheme === "https:",
    active: roomOpen,
    sendSignal: (to, data) => wsRef.current?.send(JSON.stringify({ type: "signal", to, data })),
    sendChat: (text) => {
      const trimmed = text.trim();
      if (trimmed) wsRef.current?.send(JSON.stringify({ type: "chat", text: trimmed }));
    },
  });
  const stopReconnect = useRef(false);
  const appendRef = useRef(false);
  const nudgedUpgradeRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);
  const started = useRef(false);
  const cwdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    localStorage.setItem("tc-theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const ct = COLOR_THEMES.find((t) => t.id === colorTheme) ?? COLOR_THEMES[0]!;
    for (const v of THEME_VARS) root.style.removeProperty(v);
    if (ct.id === "default") {
      root.setAttribute("data-theme", theme);
    } else {
      root.setAttribute("data-theme", ct.dark ? "dark" : "light");
      for (const [k, val] of Object.entries(ct.vars)) root.style.setProperty(k, val);
    }
    root.style.setProperty("--accent", ct.accent);
    root.style.setProperty("--accent-dim", accentDim(ct.accent));
    localStorage.setItem("tc-colortheme", colorTheme);
  }, [colorTheme, theme]);

  useEffect(() => {
    autoApproveRef.current = autoApprove;
    localStorage.setItem("tc-auto", autoApprove ? "1" : "0");
  }, [autoApprove]);

  useEffect(() => {
    currentIdRef.current = currentId;
    refreshCheckpoint();
  }, [currentId]);

  useEffect(() => {
    localStorage.setItem("tc-open-tabs", JSON.stringify(openTabs));
  }, [openTabs]);

  useEffect(() => {
    setHunkIndex(0);
  }, [activeTab]);

  useEffect(() => {
    if (!serversOpen) return;
    const timer = setInterval(() => void refreshStatus(), 2500);
    return () => clearInterval(timer);
  }, [serversOpen]);

  useEffect(() => {
    if (!sessions.length) return;
    const ids = new Set(sessions.map((s) => s.id));
    setOpenTabs((prev) => prev.filter((id) => ids.has(id)));
    closedTabsRef.current = closedTabsRef.current.filter((id) => ids.has(id));
  }, [sessions]);

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
    if (accent) {
      document.documentElement.style.setProperty("--accent", accent);
      document.documentElement.style.setProperty("--accent-dim", accentDim(accent));
      localStorage.setItem("tc-accent", accent);
    } else {
      const ct = COLOR_THEMES.find((t) => t.id === colorTheme) ?? COLOR_THEMES[0]!;
      document.documentElement.style.setProperty("--accent", ct.accent);
      document.documentElement.style.setProperty("--accent-dim", accentDim(ct.accent));
      localStorage.removeItem("tc-accent");
    }
  }, [accent, colorTheme]);
  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
    localStorage.setItem("tc-density", density);
  }, [density]);
  useEffect(() => {
    document.documentElement.setAttribute("data-motion", reduceMotion ? "off" : "on");
    localStorage.setItem("tc-motion", reduceMotion ? "off" : "on");
  }, [reduceMotion]);
  useEffect(() => {
    localStorage.setItem("tc-autoscroll", autoScroll ? "1" : "0");
  }, [autoScroll]);
  useEffect(() => {
    localStorage.setItem("tc-confirmdel", confirmDelete ? "1" : "0");
  }, [confirmDelete]);
  useEffect(() => {
    soundRef.current = soundOnFinish;
    localStorage.setItem("tc-sound", soundOnFinish ? "1" : "0");
  }, [soundOnFinish]);
  useEffect(() => {
    micRef.current = micDeviceId;
    localStorage.setItem("tc-mic", micDeviceId);
  }, [micDeviceId]);
  useEffect(() => {
    document.documentElement.setAttribute("data-wrap", wordWrap ? "on" : "off");
    localStorage.setItem("tc-wrap", wordWrap ? "1" : "0");
  }, [wordWrap]);
  useEffect(() => {
    localStorage.setItem("tc-aisuggest", aiSuggest ? "1" : "0");
  }, [aiSuggest]);
  useEffect(() => {
    localStorage.setItem("tc-codetheme", codeTheme);
  }, [codeTheme]);
  useEffect(() => {
    notifyRef.current = notifyOnFinish;
    localStorage.setItem("tc-notify", notifyOnFinish ? "1" : "0");
  }, [notifyOnFinish]);
  useEffect(() => {
    autoCommitRef.current = autoCommit;
    localStorage.setItem("tc-autocommit", autoCommit ? "1" : "0");
  }, [autoCommit]);
  useEffect(() => {
    void window.api?.getLoginItem?.().then(setOpenAtLogin);
  }, []);
  useEffect(() => {
    window.api?.setLoginItem?.(openAtLogin);
  }, [openAtLogin]);
  useEffect(() => {
    window.api?.setTray?.(enableTray);
    localStorage.setItem("tc-tray", enableTray ? "1" : "0");
  }, [enableTray]);
  useEffect(() => {
    window.api?.setGlobalShortcut?.(enableHotkey, "CommandOrControl+Shift+Space");
    localStorage.setItem("tc-hotkey", enableHotkey ? "1" : "0");
  }, [enableHotkey]);
  useEffect(() => {
    localStorage.setItem("tc-temp", String(temperature));
    if (currentId) {
      void fetch(`${httpBase}/sessions/${currentId}/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ temperature }),
      });
    }
  }, [temperature]);
  useEffect(() => {
    localStorage.setItem("tc-maxsteps", String(maxSteps));
    if (currentId) {
      void fetch(`${httpBase}/sessions/${currentId}/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxSteps }),
      });
    }
  }, [maxSteps]);
  useEffect(() => {
    localStorage.setItem("tc-agent", agent);
    if (currentId) {
      void fetch(`${httpBase}/sessions/${currentId}/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent }),
      });
    }
  }, [agent]);

  useEffect(() => {
    fetch(`${httpBase}/agents`)
      .then((r) => r.json())
      .then((list: AgentInfo[]) => setAgents(Array.isArray(list) ? list : []))
      .catch(() => {});
    fetch(`${httpBase}/commands`)
      .then((r) => r.json())
      .then((list: CommandInfo[]) => setCommands(Array.isArray(list) ? list : []))
      .catch(() => {});
    fetch(`${httpBase}/models`)
      .then((r) => r.json())
      .then((list) => setCatalog(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const bind = (id: string) =>
      comboFor(keybinds, KEYBIND_ACTIONS.find((a) => a.id === id)!);
    const onKey = (e: KeyboardEvent) => {
      if (matchCombo(e, bind("commandPalette"))) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (matchCombo(e, bind("newSession"))) {
        e.preventDefault();
        void newSession();
      } else if (matchCombo(e, bind("toggleSessions"))) {
        e.preventDefault();
        setLeftOpen((v) => !v);
      } else if (matchCombo(e, bind("toggleFiles"))) {
        e.preventDefault();
        setSidePanel((p) => (p === "files" ? null : "files"));
      } else if (matchCombo(e, bind("openFolder"))) {
        e.preventDefault();
        void chooseFolder();
      } else if (matchCombo(e, bind("toggleTerminal"))) {
        e.preventDefault();
        setTermMounted(true);
        setCenterTab((tab) => (tab === "terminal" ? "chat" : "terminal"));
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        reopenClosedTab();
      } else if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        jumpToTab(Number(e.key) - 1);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setViewerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keybinds, openTabs, sessions]);

  useEffect(() => {
    fetch(`${httpBase}/config`)
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg?.keybinds && typeof cfg.keybinds === "object") setKeybinds(cfg.keybinds);
      })
      .catch(() => {});
  }, [httpBase]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        if (JOIN_ROOM) {
          setCurrentId(JOIN_ROOM);
          connect(JOIN_ROOM);
          setRoomOpen(true);
          return;
        }
        const list = (await (await fetch(`${httpBase}/sessions`)).json()) as SessionSummary[];
        setSessions(list);
        if (JOIN_SESSION && list.some((s) => s.id === JOIN_SESSION)) {
          await openSession(JOIN_SESSION);
          setRoomOpen(true);
          return;
        }
        const savedCwd = cleanDir(localStorage.getItem("tc-cwd"));
        const blank = list.find((s) => s.messageCount === 0 && !(HOME_DIR && s.cwd === HOME_DIR));
        if (blank) await openSession(blank.id);
        else await createSession(savedCwd ?? DEFAULT_DIR ?? undefined);
      } catch {
        setMessages([{ role: "error", text: t("app.serverUnreachable") }]);
      }
    })();
    return () => {
      stopReconnect.current = true;
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy, autoScroll]);

  async function refreshSessions() {
    try {
      setSessions((await (await fetch(`${httpBase}/sessions`)).json()) as SessionSummary[]);
    } catch {
    }
  }

  async function refreshGit() {
    const dir = cwdRef.current;
    if (!dir) return;
    const res = await window.api?.gitStatus(dir, compareBaseRef.current || undefined);
    if (res) {
      setStatus(res.map);
      setChanges(res.count);
    }
  }

  async function refreshStatus() {
    try {
      setServerStatus((await (await fetch(`${httpBase}/status`)).json()) as ServerStatus);
    } catch {
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
    stopReconnect.current = false;
    wsRef.current?.close();
    appendRef.current = false;
    openSocket(id);
  }

  function openSocket(id: string) {
    const ws = new WebSocket(`${wsBase}/sessions/${id}/stream?name=${encodeURIComponent(myNameRef.current)}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onmessage = (ev) => onEvent(JSON.parse(ev.data) as StreamEvent);
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
      }
    };
    ws.onclose = () => {
      setConnected(false);
      if (!stopReconnect.current && wsRef.current === ws && currentIdRef.current === id) {
        setTimeout(() => {
          if (!stopReconnect.current && wsRef.current === ws && currentIdRef.current === id) {
            openSocket(id);
          }
        }, 500);
      }
    };
  }

  function setWorkingDir(rawDir: string) {
    const dir = cleanDir(rawDir) ?? rawDir; // never root the tree in the home dir
    setCwd(dir);
    cwdRef.current = dir;
    localStorage.setItem("tc-cwd", dir);
    compareBaseRef.current = "";
    setCompareBaseState("");
    void refreshGit();
    void window.api?.allFiles(dir).then(setFileList);
    void window.api?.gitBranches(dir).then((r) => setBranches(r?.branches ?? []));
    try {
      const saved = JSON.parse(localStorage.getItem(`tc-review-comments:${dir}`) || "[]");
      setReviewComments(Array.isArray(saved) ? saved : []);
    } catch {
      setReviewComments([]);
    }
  }

  function setCompareBase(base: string) {
    compareBaseRef.current = base;
    setCompareBaseState(base);
    void refreshGit();
  }

  function persistReviewComments(list: DiffComment[]) {
    const dir = cwdRef.current;
    if (dir) localStorage.setItem(`tc-review-comments:${dir}`, JSON.stringify(list));
  }

  function addReviewComment(key: string, text: string) {
    setReviewComments((prev) => {
      const next = [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, key, text }];
      persistReviewComments(next);
      return next;
    });
  }

  function removeReviewComment(id: string) {
    setReviewComments((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persistReviewComments(next);
      return next;
    });
  }

  function sendReviewComments() {
    if (!reviewComments.length) return;
    const lines = reviewComments.map((c) => {
      const [file, linePart] = c.key.split("::");
      const label = linePart?.startsWith("old") ? `line ${linePart.slice(3)} (removed)` : `line ${linePart}`;
      return `${file} ${label}: ${c.text}`;
    });
    const text = `Please address these review comments:\n\n${lines.join("\n")}`;
    setInput((v) => (v.trim() ? `${v.trim()}\n\n${text}` : text));
    setViewerOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function resetTokenMeters() {
    setTokens(0);
    setTokensIn(0);
    setTokensOut(0);
    setLastCtx(0);
  }

  function applyStudentMode(on: boolean) {
    setStudentMode(on);
    localStorage.setItem("tc-student", on ? "1" : "0");
    if (on) {
      setLeftOpen(false);
      setSidePanel(null);
      void changeModel("termexplorer/auto");
    } else {
      setLeftOpen(true);
    }
  }

  function chooseMode(mode: "code" | "study") {
    localStorage.setItem("tc-onboarded", "1");
    setOnboarded(true);
    applyStudentMode(mode === "study");
  }

  async function createSession(folder?: string) {
    const settings = { agent, temperature, maxSteps };
    const body = JSON.stringify(folder ? { cwd: folder, ...settings } : settings);
    const record = (await (
      await fetch(`${httpBase}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body })
    ).json()) as { id: string; cwd: string; model: string };
    setCurrentId(record.id);
    setCenterTab("chat");
    addOpenTab(record.id);
    resetTokenMeters();
    localStorage.setItem("tc-session", record.id);
    const dm = localStorage.getItem("tc-model") || "termcoder/auto";
    if (dm !== record.model) {
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
    setGraph(emptyGraph("root"));
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
      setMessages([{ role: "error", text: t("app.serverUnreachable") }]);
    }
  }

  async function openSession(id: string) {
    addOpenTab(id);
    if (id === currentIdRef.current) return;
    try {
      const [record, segments] = await Promise.all([
        fetch(`${httpBase}/sessions/${id}`).then((r) => r.json()) as Promise<{ cwd: string; model: string }>,
        fetch(`${httpBase}/sessions/${id}/transcript`).then((r) => r.json()) as Promise<Segment[]>,
      ]);
      setCurrentId(id);
      resetTokenMeters();
      localStorage.setItem("tc-session", id);
      setModel(record.model);
      setMessages(segments.map(segToMessage));
      setGraph(emptyGraph("root"));
      setWorkingDir(record.cwd);
      connect(id);
      pushNav(id);
    } catch {
    }
  }

  function addOpenTab(id: string) {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function closeSessionTab(id: string) {
    const idx = openTabs.indexOf(id);
    if (idx === -1) return;
    const next = openTabs.filter((x) => x !== id);
    setOpenTabs(next);
    closedTabsRef.current = [id, ...closedTabsRef.current].slice(0, 10);
    if (id !== currentId) return;
    const neighbor = next[idx] ?? next[idx - 1];
    if (neighbor) void openSession(neighbor);
    else {
      const other = sessions.find((s) => s.id !== id);
      if (other) void openSession(other.id);
      else void createSession(cwdRef.current ?? undefined);
    }
  }

  function reopenClosedTab() {
    while (closedTabsRef.current.length) {
      const id = closedTabsRef.current.shift()!;
      if (sessions.some((s) => s.id === id)) {
        void openSession(id);
        return;
      }
    }
  }

  function jumpToTab(index: number) {
    if (!openTabs.length) return;
    const id = index >= openTabs.length ? openTabs[openTabs.length - 1] : openTabs[index];
    if (id) void openSession(id);
  }

  function reorderTabs(targetId: string) {
    const draggedId = dragTabRef.current;
    dragTabRef.current = null;
    if (!draggedId || draggedId === targetId) return;
    setOpenTabs((prev) => {
      const from = prev.indexOf(draggedId);
      const to = prev.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
  }

  async function chooseFolder() {
    const folder = await window.api?.pickFolder();
    if (folder) await createSession(folder);
  }

  async function deleteSession(id: string) {
    try {
      await fetch(`${httpBase}/sessions/${id}`, { method: "DELETE" });
    } catch {
    }
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    setOpenTabs((prev) => prev.filter((x) => x !== id));
    closedTabsRef.current = closedTabsRef.current.filter((x) => x !== id);
    if (id === currentId) {
      wsRef.current?.close();
      const next = remaining[0];
      if (next) await openSession(next.id);
      else await createSession(cwdRef.current ?? undefined);
    }
    void refreshSessions();
  }

  async function clearAllSessions() {
    try {
      await fetch(`${httpBase}/sessions`, { method: "DELETE" });
    } catch {
    }
    wsRef.current?.close();
    setSessions([]);
    setCurrentId(null);
    setOpenTabs([]);
    closedTabsRef.current = [];
    localStorage.removeItem("tc-session");
    navStack.current = [];
    navPos.current = -1;
    await createSession(cwdRef.current ?? undefined);
  }

  function stop() {
    if (isGuest) return;
    wsRef.current?.send(JSON.stringify({ type: "stop" }));
    setBusy(false);
    setPerm(null);
    appendRef.current = false;
    setMessages((prev) => [...prev, { role: "notice", text: t("chat.stopped") }]);
  }

  function refreshCheckpoint() {
    const id = currentIdRef.current;
    if (!id) {
      setCanRevert(false);
      return;
    }
    fetch(`${httpBase}/sessions/${id}/checkpoint`)
      .then((r) => r.json())
      .then((d) => setCanRevert(Boolean(d.hasCheckpoint)))
      .catch(() => {});
  }

  async function revertTurn() {
    const id = currentIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`${httpBase}/sessions/${id}/revert`, { method: "POST" });
      const data = (await res.json()) as { restored?: string[] };
      const n = data.restored?.length ?? 0;
      notice(n ? t("revert.done", { n }) : t("revert.none"));
    } catch {
    }
    setCanRevert(false);
    void refreshGit();
  }

  async function renameSession(id: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)));
    try {
      await fetch(`${httpBase}/sessions/${id}/title`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {
    }
    void refreshSessions();
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
    }
  }

  function shareSession(format: "html" | "md") {
    if (!currentId) return;
    const url = `${httpBase}/sessions/${currentId}/share${format === "md" ? "?format=md" : ""}`;
    if (format === "md") void copyText(url);
    window.open(url, "_blank");
  }

  async function exportHtml() {
    if (!currentId) return;
    try {
      const html = await (await fetch(`${httpBase}/sessions/${currentId}/share`)).text();
      const res = await window.api?.saveFile?.(`${currentTitle || "termcoder-session"}.html`, html);
      if (res?.ok) notice(t("share.exported", { path: res.path ?? "" }));
    } catch {
    }
  }

  async function publishGist() {
    if (!currentId) return;
    notice(t("share.publishing"));
    try {
      const res = await fetch(`${httpBase}/sessions/${currentId}/gist`, { method: "POST" });
      const data = (await res.json()) as { url?: string; viewer?: string; error?: string };
      const link = data.viewer ?? data.url;
      if (link) {
        void copyText(link); // a clean, in-browser viewer link (falls back to the gist)
        notice(t("share.gistDone"));
        window.open(link, "_blank");
      } else {
        notice(data.error?.includes("token") ? t("share.needToken") : t("share.gistError", { e: data.error ?? "" }));
      }
    } catch {
      notice(t("share.gistError", { e: "network" }));
    }
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
    if (res) addTab({ id: `file:${path}`, name: baseName(path), kind: "file", content: res.content, path });
  }

  function editTab(id: string, content: string) {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, content, dirty: true } : t)));
  }

  async function saveTab(id: string) {
    const tab = tabs.find((t) => t.id === id);
    if (!tab?.path) return;
    const res = await window.api?.writeFile(tab.path, tab.content);
    if (res?.ok) {
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, dirty: false } : t)));
      void refreshGit();
    }
  }

  function askAboutFile(tab: Tab) {
    const dir = cwdRef.current;
    const rel =
      tab.path && dir && tab.path.startsWith(dir) ? tab.path.slice(dir.length).replace(/^[\\/]+/, "") : tab.name;
    setInput((v) => (v.trim() ? `${v.trim()} @${rel} ` : `@${rel} `));
    setViewerOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function openDiff(relPath: string) {
    const dir = cwdRef.current;
    if (!dir) return;
    const base = compareBaseRef.current || undefined;
    const res = await window.api?.gitDiff(dir, relPath, base);
    if (res && res.diff.trim()) {
      addTab({ id: `diff:${relPath}`, name: baseName(relPath), kind: "diff", content: res.diff, path: relPath });
    } else if (!base) {
      await openFile(`${dir}/${relPath}`);
    }
  }

  async function openAllDiffs() {
    const dir = cwdRef.current;
    if (!dir) return;
    const res = await window.api?.gitDiff(dir, "", compareBaseRef.current || undefined);
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
    setGraph((g) => reduceGraph(g, e as unknown as SessionEventLike));
    if ((e as { sourceId?: string }).sourceId || e.type === "subagent-start" || e.type === "subagent-end") return;
    if (e.type === "room-locked") {
      setMessages((prev) => [...prev, { role: "notice", text: t("pro.roomLocked") }]);
      return;
    }
    if (room.handleEvent(e)) return;
    if (e.type === "permission-request") {
      if (autoApproveRef.current && e.request.kind !== "network") {
        wsRef.current?.send(JSON.stringify({ type: "permission-decision", id: e.id, decision: "allow" }));
        return;
      }
      setPerm({ id: e.id, title: e.request.title, detail: e.request.detail });
      return;
    }
    if (e.type === "usage") {
      setTokens((tok) => tok + e.inputTokens + e.outputTokens);
      setTokensIn((v) => v + e.inputTokens);
      setTokensOut((v) => v + e.outputTokens);
      setLastCtx(e.inputTokens); // the context actually sent this turn
      return;
    }
    if (e.type === "stopped") {
      setBusy(false);
      appendRef.current = false;
      return;
    }
    if (e.type === "done") {
      setBusy(false);
      appendRef.current = false;
      if (soundRef.current) playChime();
      if (notifyRef.current && !document.hasFocus()) {
        if (window.api?.notify) {
          window.api.notify("termcoder", t("notify.done"));
        } else {
          try {
            new Notification("termcoder", { body: t("notify.done") });
          } catch {
          }
        }
      }
      if (autoCommitRef.current && cwdRef.current) {
        void window.api?.gitCommit?.(cwdRef.current, "termcoder: automated update");
      }
      void refreshSessions();
      void refreshGit();
      refreshCheckpoint();
      return;
    }

    if (e.type === "background-start") {
      appendRef.current = false;
      const v = e.verify ? `, verifying with \`${e.verify}\`` : " (no check found — single pass)";
      setMessages((prev) => [...prev, { role: "assistant", text: `🤖 Autonomous mode — auto-approving changes${v}.` }]);
      return;
    }
    if (e.type === "background-round") {
      appendRef.current = false;
      setMessages((prev) => [...prev, { role: "assistant", text: `▶ Round ${e.round}` }]);
      return;
    }
    if (e.type === "background-verify") {
      appendRef.current = false;
      setMessages((prev) => [...prev, { role: "assistant", text: e.ok ? "✓ Check passed." : "✗ Check failed — fixing…" }]);
      return;
    }
    if (e.type === "background-done") {
      appendRef.current = false;
      const msg =
        e.status === "verified"
          ? "✓ Done — the check passes."
          : e.status === "done"
            ? "✓ Done."
            : e.status === "maxed"
              ? `✗ Still failing after ${e.rounds} rounds — stopping so you can take a look.`
              : e.status === "error"
                ? "⛔ Stopped on an error."
                : "⛔ Stopped.";
      setMessages((prev) => [...prev, { role: "assistant", text: msg }]);
      setBusy(false);
      void refreshSessions();
      void refreshGit();
      refreshCheckpoint();
      return;
    }

    if (e.type === "text-delta") {
      setLiveTokens((v) => v + Math.max(1, Math.round((e.text?.length ?? 0) / 4)));
      const shouldAppend = appendRef.current;
      appendRef.current = true;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (shouldAppend && last && last.role === "assistant") {
          next[next.length - 1] = { ...last, text: last.text + e.text };
        } else {
          next.push({ role: "assistant", text: e.text });
        }
        return next;
      });
      return;
    }

    if (e.type === "tool-call") {
      appendRef.current = false;
      setMessages((prev) => [
        ...prev,
        { role: "tool", name: e.name, text: e.title ?? "", status: "running", detail: e.detail },
      ]);
      return;
    }

    if (e.type === "tool-result") {
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i]!.role === "tool" && next[i]!.status === "running") {
            next[i] = { ...next[i]!, status: e.isError ? "error" : "done" };
            break;
          }
        }
        return next;
      });
      return;
    }

    if (e.type === "error") {
      appendRef.current = false;
      const onFree = /^(termcoderfree|pollinations)\//.test(model);
      const busy = /quota|rate.?limit|too many|429|busy|overload/i.test(e.error);
      const nudge =
        onFree && busy && !nudgedUpgradeRef.current
          ? ((nudgedUpgradeRef.current = true),
            [{ role: "notice" as const, text: t("upgrade.busy") }])
          : [];
      setMessages((prev) => [...prev, { role: "error", text: e.error }, ...nudge]);
    }
  }

  function decide(decision: "allow" | "deny" | "allow-always") {
    if (isGuest) return;
    if (perm) wsRef.current?.send(JSON.stringify({ type: "permission-decision", id: perm.id, decision }));
    setPerm(null);
  }

  function send() {
    if (isGuest) return;
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || busy || !connected) return;
    const cmd = parseCommand(text);
    if (cmd && pendingImages.length === 0) {
      void sendCommand(cmd.name, cmd.args, text);
      return;
    }
    const images = pendingImages;
    setInput("");
    setMention(null);
    appendRef.current = false;
    setLiveTokens(0);
    setMessages((prev) => [...prev, { role: "user", text, images: images.map((i) => i.dataUrl) }]);
    setBusy(true);
    if (autonomous && images.length === 0) {
      wsRef.current?.send(JSON.stringify({ type: "background", goal: text }));
      setPendingImages([]);
      return;
    }
    wsRef.current?.send(
      JSON.stringify({
        type: "prompt",
        text,
        images: images.map((i) => ({ dataUrl: i.dataUrl, mediaType: i.mediaType })),
      }),
    );
    setPendingImages([]);
  }

  function runRecipe(prompt: string) {
    if (isGuest) return;
    if (busy || !connected) {
      setInput((v) => (v.trim() ? `${v.trim()}\n\n${prompt}` : prompt));
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    appendRef.current = false;
    setLiveTokens(0);
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setBusy(true);
    wsRef.current?.send(JSON.stringify({ type: "prompt", text: prompt }));
  }

  async function attachFiles() {
    const paths = (await window.api?.pickFile?.()) ?? [];
    if (!paths.length) return;
    const dir = cwdRef.current;
    const fileMentions: string[] = [];
    for (const p of paths) {
      if (IMG_EXT.test(p)) {
        const img = await window.api?.readImage?.(p);
        if (img) setPendingImages((prev) => [...prev, { ...img, name: baseName(p) }]);
      } else {
        const rel = dir && p.startsWith(dir) ? p.slice(dir.length).replace(/^[\\/]+/, "") : p;
        fileMentions.push(`@${rel}`);
      }
    }
    if (fileMentions.length) {
      const m = fileMentions.join(" ");
      setInput((v) => (v.trim() ? `${v.trim()} ${m} ` : `${m} `));
    }
    inputRef.current?.focus();
  }

  function addImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () =>
      setPendingImages((prev) => [
        ...prev,
        { dataUrl: String(reader.result), mediaType: file.type, name: file.name || "image" },
      ]);
    reader.readAsDataURL(file);
  }

  function removeImage(i: number) {
    setPendingImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  function notice(text: string) {
    setMessages((p) => [...p, { role: "notice", text }]);
  }

  async function transcribeRecording() {
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];
    if (!blob.size) return;
    setTranscribing(true);
    try {
      const wav = await blobToWav(blob);
      const audio = await blobToBase64(wav);
      const res = await fetch(`${httpBase}/transcribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio, mediaType: "audio/wav" }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.text && data.text.trim()) {
        const add = data.text.trim();
        setInput((v) => (v.trim() ? `${v.trim()} ${add}` : add));
        inputRef.current?.focus();
      } else if (data.error) {
        notice(t("voice.error", { e: data.error }));
      }
    } catch (err) {
      notice(t("voice.error", { e: String(err) }));
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleMic() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (transcribing) return;
    let stream: MediaStream;
    try {
      const audio = micRef.current ? { deviceId: { exact: micRef.current } } : true;
      stream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch {
      notice(t("voice.micDenied"));
      return;
    }
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) audioChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      setRecording(false);
      void transcribeRecording();
    };
    mediaRecorderRef.current = recorder;
    setRecording(true);
    recorder.start();
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

  function parseCommand(text: string): { name: string; args: string } | null {
    if (!text.startsWith("/")) return null;
    const after = text.slice(1);
    const sp = after.indexOf(" ");
    const name = sp === -1 ? after : after.slice(0, sp);
    const args = sp === -1 ? "" : after.slice(sp + 1);
    return commands.some((c) => c.name === name) ? { name, args } : null;
  }

  function updateCommand(value: string) {
    if (!value.startsWith("/")) {
      setCmdMatch(null);
      setCmdPreview("");
      return;
    }
    const after = value.slice(1);
    const sp = after.indexOf(" ");
    if (sp === -1) {
      const q = after.toLowerCase();
      const items = commands.filter((c) => c.name.toLowerCase().startsWith(q));
      setCmdMatch(items.length ? { items, active: 0 } : null);
      setCmdPreview("");
    } else {
      setCmdMatch(null);
      const name = after.slice(0, sp);
      const args = after.slice(sp + 1);
      if (!commands.some((c) => c.name === name)) {
        setCmdPreview("");
        return;
      }
      if (cmdPreviewTimer.current) clearTimeout(cmdPreviewTimer.current);
      cmdPreviewTimer.current = setTimeout(() => {
        fetch(`${httpBase}/commands/expand`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, args }),
        })
          .then((r) => r.json())
          .then((d) => setCmdPreview(typeof d.prompt === "string" ? d.prompt : ""))
          .catch(() => {});
      }, 350);
    }
  }

  function pickCommand(name: string) {
    setInput(`/${name} `);
    setCmdMatch(null);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const pos = name.length + 2;
        el.setSelectionRange(pos, pos);
      }
    });
  }

  async function sendCommand(name: string, args: string, raw: string) {
    if (busy || !connected) return;
    setInput("");
    setMention(null);
    setCmdMatch(null);
    setCmdPreview("");
    appendRef.current = false;
    setLiveTokens(0);
    let prompt = raw;
    try {
      const res = await fetch(`${httpBase}/commands/expand`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, args }),
      });
      const data = (await res.json()) as { prompt?: string; agent?: string };
      if (typeof data.prompt === "string" && data.prompt.trim()) prompt = data.prompt;
      if (typeof data.agent === "string") setAgent(data.agent);
    } catch {
    }
    setMessages((prev) => [...prev, { role: "user", text: raw }]);
    setBusy(true);
    wsRef.current?.send(JSON.stringify({ type: "prompt", text: prompt }));
  }

  const project = cwd ? baseName(cwd) : "termcoder";
  const currentSession = sessions.find((s) => s.id === currentId);
  const currentTitle = currentSession ? sessionLabel(currentSession) : t("chat.newSession");
  const changedFiles = Object.entries(status);

  const runningTool = busy
    ? [...messages].reverse().find((m) => m.role === "tool" && m.status === "running")
    : undefined;
  const workingLabel = runningTool?.name ?? t("chat.thinking");
  const workingDetail = runningTool?.text ?? "";
  const workingTokens = liveTokens || tokens;

  const paletteItems: PaletteItem[] = [
    { id: "new", label: t("nav.newSession"), hint: t("palette.hint.command"), run: () => void newSession() },
    { id: "folder", label: t("nav.chooseFolder"), hint: t("palette.hint.command"), run: () => void chooseFolder() },
    { id: "recipes", label: t("recipes.title"), hint: t("palette.hint.command"), run: () => setRecipesOpen(true) },
    { id: "left", label: t("palette.toggleSessions"), hint: t("palette.hint.command"), run: () => setLeftOpen((v) => !v) },
    { id: "right", label: t("palette.toggleFiles"), hint: t("palette.hint.command"), run: () => setSidePanel((p) => (p === "files" ? null : "files")) },
    {
      id: "terminal",
      label: t("tab.terminal"),
      hint: t("palette.hint.command"),
      run: () => {
        setTermMounted(true);
        setCenterTab("terminal");
      },
    },
    {
      id: "theme",
      label: t("palette.switchTheme", { theme: t(theme === "dark" ? "theme.light" : "theme.dark") }),
      hint: t("palette.hint.command"),
      run: () => setTheme((th) => (th === "dark" ? "light" : "dark")),
    },
    ...MODELS.map((m) => ({ id: `model:${m}`, label: m, hint: t("palette.hint.model"), run: () => changeModel(m) })),
    ...sessions.map((s) => ({ id: `sess:${s.id}`, label: sessionLabel(s), hint: t("palette.hint.session"), run: () => void openSession(s.id) })),
    ...fileList.slice(0, 600).map((f) => ({
      id: `file:${f}`,
      label: f,
      hint: t("palette.hint.file"),
      run: () => cwd && void openFile(`${cwd}/${f}`),
    })),
  ];

  const sessionTime = (_s: SessionSummary) => Date.now();
  const recent: HomeRecent[] = sessions
    .filter((s) => s.messageCount > 0)
    .slice(0, 6)
    .map((s) => ({
      id: s.id,
      name: sessionLabel(s),
      meta: `${s.messageCount} ${t("home.turns")}`,
      when: relativeTime(sessionTime(s), Date.now()),
    }));
  const isHome = centerTab === "chat" && messages.length === 0;

  const composerEl = (
    <div
      className={`composer ${busy ? "busy" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        for (const f of Array.from(e.dataTransfer.files)) addImageFile(f);
      }}
      onPaste={(e) => {
        const imgs = Array.from(e.clipboardData.items).filter((it) => it.type.startsWith("image/"));
        if (imgs.length) {
          e.preventDefault();
          for (const it of imgs) {
            const f = it.getAsFile();
            if (f) addImageFile(f);
          }
        }
      }}
    >
      <div className="composer-status">
        <span className={`dot ${busy ? "gen" : connected ? "on" : "off"}`} />
        {busy ? (
          <span className="cs-working">
            {workingLabel}
            {workingDetail ? <span className="muted"> · {workingDetail}</span> : null}
            {workingTokens > 0 ? <span className="cs-tok">{fmtTokens(workingTokens)} {t("chat.tok")}</span> : null}
          </span>
        ) : (
          <>
            {(() => {
              const ctxPct = lastCtx > 0 ? Math.round((lastCtx / ((catalog.find((c) => c.id === model)?.contextK ?? 128) * 1000)) * 100) : 0;
              return lastCtx > 0 ? (
                <span className={`cs-item ${ctxPct > 70 ? "hot" : ctxPct > 40 ? "warm" : ""}`}>ctx {fmtTokens(lastCtx)} ({ctxPct}%)</span>
              ) : null;
            })()}
            {tokensIn || tokensOut ? <span className="cs-item">↓{fmtTokens(tokensIn)} ↑{fmtTokens(tokensOut)}</span> : null}
          </>
        )}
      </div>
      <textarea
        ref={inputRef}
        value={input}
        placeholder={t("composer.placeholder")}
        onChange={(e) => {
          setInput(e.target.value);
          updateMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
          updateCommand(e.target.value);
        }}
        onKeyDown={(e) => {
          if (cmdMatch) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCmdMatch((m) => (m ? { ...m, active: Math.min(m.active + 1, m.items.length - 1) } : m));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCmdMatch((m) => (m ? { ...m, active: Math.max(m.active - 1, 0) } : m));
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pickCommand(cmdMatch.items[cmdMatch.active]!.name);
              return;
            }
            if (e.key === "Escape") {
              setCmdMatch(null);
              return;
            }
          }
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
          if (e.key === "Escape" && busy) {
            e.preventDefault();
            stop();
            return;
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
      <div className="composer-actions">
        {!studentMode ? (
        <div className="menu-wrap">
          <button
            className={`chip ${agents.find((a) => a.name === agent)?.readOnly ? "armed" : ""}`}
            title={t("mode.title")}
            onClick={() => setAgentOpen((v) => !v)}
          >
            {agent} ▾
          </button>
          {agentOpen ? (
            <div className="menu mode-pop" onMouseLeave={() => setAgentOpen(false)}>
              {(agents.length ? agents : [{ name: "build", description: "", mode: "primary", builtin: true, readOnly: false } as AgentInfo])
                .filter((a) => a.mode !== "subagent")
                .map((a) => (
                  <button
                    key={a.name}
                    className={agent === a.name ? "active" : ""}
                    onClick={() => { setAgent(a.name); setAgentOpen(false); }}
                  >
                    <div className="mode-opt">
                      <div className="mode-name">
                        {a.name}
                        {a.readOnly ? <span className="agent-ro">read-only</span> : null}
                        {!a.builtin ? <span className="agent-custom">custom</span> : null}
                      </div>
                      {a.description ? <div className="mode-desc">{a.description}</div> : null}
                    </div>
                    {agent === a.name ? <span className="check">✓</span> : null}
                  </button>
                ))}
              <div className="menu-sep" />
              <button onClick={() => setAutoApprove((v) => !v)}>
                {t("settings.autoApprove")}<span className="mk">{autoApprove ? "On" : "Off"}</span>
              </button>
              <button onClick={() => { setAgentOpen(false); setSettingsTab("agents"); setSettingsOpen(true); }}>
                {t("agents.manage")}
              </button>
            </div>
          ) : null}
        </div>
        ) : null}
        <button className="chip model" title={t("models.browse")} onClick={() => setBrowserOpen(true)}>
          {model} ▾
        </button>
        <span className="ca-spacer" />
        <button className="attach" title={t("composer.attach")} onClick={() => void attachFiles()}><IconPlus /></button>
        <button
          className="attach"
          title={autonomous ? "Autonomous mode: ON — runs to the goal, verifies, and keeps fixing" : "Autonomous mode: OFF"}
          onClick={() => setAutonomous((v) => !v)}
          style={autonomous ? { color: "var(--accent)" } : undefined}
        >
          <IconBolt />
        </button>
        <button
          className={`attach mic ${recording ? "recording" : ""} ${transcribing ? "transcribing" : ""}`}
          title={transcribing ? t("voice.transcribing") : recording ? t("voice.stop") : t("composer.mic")}
          onClick={() => void toggleMic()}
          disabled={transcribing}
        >
          <IconMic />
        </button>
        {isGuest ? null : busy ? (
          <button className="send stop" onClick={stop} title={t("chat.stop")}><IconStop /></button>
        ) : (
          <button className="send" onClick={send} disabled={!connected}><IconSend /></button>
        )}
      </div>
    </div>
  );

  return (
    <div className={`shell${isHome ? " home" : ""}`}>
      <Rail
        active={sidePanel ?? (leftOpen ? "chat" : null)}
        busy={busy}
        connected={connected}
        onSelect={(item) => {
          if (item === "chat") setLeftOpen((v) => !v);
          else setSidePanel((p) => (p === item ? null : item));
        }}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="app-col">
      <header className="titlebar">
        <div className="tb-left">
          <div className="menu-wrap">
            <button className="icon" title={t("nav.menu")} onClick={() => setMenuOpen((v) => !v)}><IconMenu /></button>
            {menuOpen ? (
              <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
                <button onClick={() => { setMenuOpen(false); void newSession(); }}>{t("nav.newSession")}<span className="mk">Ctrl N</span></button>
                <button onClick={() => { setMenuOpen(false); void chooseFolder(); }}>{t("nav.openFolder")}<span className="mk">Ctrl O</span></button>
                <button onClick={() => { setMenuOpen(false); setRecipesOpen(true); }}>{t("recipes.title")}</button>
                <button onClick={() => { setMenuOpen(false); setClassroomOpen(true); }}>{t("class.title")}</button>
                <div className="menu-sep" />
                <button onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}>{t("nav.settings")}</button>
                <button onClick={() => { setMenuOpen(false); setPaletteOpen(true); }}>{t("nav.commandPalette")}<span className="mk">Ctrl K</span></button>
                <button onClick={() => { setMenuOpen(false); setTheme((th) => (th === "dark" ? "light" : "dark")); }}>{t("nav.toggleTheme")}</button>
                <div className="menu-sep" />
                <button onClick={() => location.reload()}>{t("nav.reload")}</button>
                <button onClick={() => window.api?.closeWindow()}>{t("nav.quit")}</button>
              </div>
            ) : null}
          </div>
          <button className="icon dim" title={t("nav.back")} onClick={navBack}><IconBack /></button>
          <button className="icon dim" title={t("nav.forward")} onClick={navForward}><IconForward /></button>
        </div>
        <div className="tb-center">
          <button className="search" onClick={() => setPaletteOpen(true)}>
            <IconSearch />
            <span className="search-label">{t("search.placeholder", { project })}</span>
            <span className="kbd">Ctrl K</span>
          </button>
        </div>
        <div className="tb-right">
          <div className="menu-wrap">
            <button className="icon srv" title={t("servers.title")} onClick={() => { setServersOpen((v) => !v); void refreshStatus(); }}>
              <IconServer />
              <span className="srv-dot" />
            </button>
            {serversOpen ? (
              <div className="menu servers-pop" onMouseLeave={() => setServersOpen(false)}>
                <div className="sp-row"><span className="dot on" /> {t("servers.local")} <span className="muted">{t("servers.running")}</span></div>
                {(serverStatus?.mcp ?? []).length ? (
                  (serverStatus?.mcp ?? []).map((s) => {
                    const live = s.ok && s.connected !== false;
                    return (
                      <div className="sp-line" key={s.name} title={s.error ?? ""}>
                        <span><span className={`dot ${live ? "on" : "off"}`} /> {s.name}</span>
                        <span className="muted">
                          {live ? `${s.toolCount}` : t("servers.down")}
                          {s.reconnects ? ` · ↻${s.reconnects}` : ""}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="sp-line"><span>MCP</span><span className="muted">{serverStatus?.mcp.length ?? 0}</span></div>
                )}
                <div className="sp-line"><span>LSP</span><span className="muted">{serverStatus?.lsp.length ?? 0}</span></div>
                <div className="sp-line"><span>Plugins</span><span className="muted">{serverStatus?.plugins.length ?? 0}</span></div>
                <button className="sp-manage" onClick={() => { setServersOpen(false); setSettingsTab("servers"); setSettingsOpen(true); }}>{t("servers.manage")}</button>
              </div>
            ) : null}
          </div>
          <button className="icon" title={t("nav.toggleTheme")} onClick={() => setTheme((th) => (th === "dark" ? "light" : "dark"))}>
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
          <SessionsPanel
            sessions={sessions}
            currentId={currentId}
            busy={busy}
            project={project}
            cwd={cwd}
            confirmDelete={confirmDelete}
            onOpen={(id) => void openSession(id)}
            onDelete={(id) => void deleteSession(id)}
            onClearAll={() => void clearAllSessions()}
            onNew={() => void newSession()}
            onChooseFolder={() => void chooseFolder()}
          />
        ) : null}

        <main className="center">
          {openTabs.length ? (
            <div className="session-tabs">
              {openTabs.map((id) => {
                const s = sessions.find((x) => x.id === id);
                if (!s) return null;
                return (
                  <div
                    key={id}
                    className={`stab ${id === currentId ? "active" : ""}`}
                    draggable
                    onDragStart={() => {
                      dragTabRef.current = id;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => reorderTabs(id)}
                    onClick={() => void openSession(id)}
                    title={sessionLabel(s)}
                  >
                    <span className="stab-name">{sessionLabel(s)}</span>
                    <button
                      className="stab-close"
                      title={t("session.closeTab")}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeSessionTab(id);
                      }}
                    >
                      <IconClose />
                    </button>
                  </div>
                );
              })}
              <button className="stab-new" title={t("nav.newSession")} onClick={() => void newSession()}>
                +
              </button>
            </div>
          ) : null}
          <div className="center-tabs">
            <button
              className={centerTab === "chat" ? "active" : ""}
              onClick={() => setCenterTab("chat")}
            >
              {t("tab.chat")}
            </button>
            <button
              className={centerTab === "terminal" ? "active" : ""}
              onClick={() => {
                setTermMounted(true);
                setCenterTab("terminal");
              }}
            >
              {t("tab.terminal")}
            </button>
            <button className={centerTab === "canvas" ? "active" : ""} onClick={() => setCenterTab("canvas")}>
              {t("canvas.tab")}
            </button>
          </div>
          {isHome ? (
            <HomeView
              composer={composerEl}
              recent={recent}
              onOpenSession={(id) => void openSession(id)}
              onOpenTerminal={() => { setTermMounted(true); setCenterTab("terminal"); }}
              onOpenCanvas={() => setCenterTab("canvas")}
              onOpenCommands={() => setPaletteOpen(true)}
              project={project}
            />
          ) : (
          <>
          <div className="chat-head">
            {editingTitle ? (
              <input
                className="ch-title-edit"
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  if (currentId) void renameSession(currentId, titleDraft);
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (currentId) void renameSession(currentId, titleDraft);
                    setEditingTitle(false);
                  } else if (e.key === "Escape") {
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <span
                className="ch-title"
                title={t("session.rename")}
                onDoubleClick={() => {
                  setTitleDraft(currentTitle);
                  setEditingTitle(true);
                }}
              >
                {currentTitle}
              </span>
            )}
            <span className={`dot ${connected ? "on" : "off"}`} title={connected ? t("chat.connected") : t("chat.connecting")} />
            <div className="ch-right">
              {tokens > 0 ? (
                <span
                  className="ctx-meter"
                  title={t("chat.ctxTip", { in: fmtTokens(tokensIn), out: fmtTokens(tokensOut) })}
                >
                  {lastCtx > 0 ? (
                    <span className={`ctx-badge${lastCtx > 24000 ? " hi" : ""}`}>
                      {t("chat.ctx")} ~{fmtTokens(lastCtx)}
                    </span>
                  ) : null}
                  <span className="muted">{fmtTokens(tokens)} {t("chat.tok")}</span>
                </span>
              ) : null}
              <button
                className={`icon sm${room.participants.length > 1 ? " live" : ""}`}
                title={t("room.title")}
                onClick={() => setRoomOpen(true)}
              >
                <IconAgents />
                {room.participants.length > 1 ? <span className="room-count">{room.participants.length}</span> : null}
              </button>
              {canRevert ? (
                <button className="icon sm" title={t("revert.title")} onClick={() => void revertTurn()}>
                  <IconUndo />
                </button>
              ) : null}
              <button
                className="icon sm"
                title={t("session.rename")}
                onClick={() => {
                  setTitleDraft(currentTitle);
                  setEditingTitle(true);
                }}
              >
                <IconEdit />
              </button>
              <div className="menu-wrap">
                <button className="icon sm" title={t("session.share")} onClick={() => setShareOpen((v) => !v)}>
                  <IconShare />
                </button>
                {shareOpen ? (
                  <div className="menu share-pop" onMouseLeave={() => setShareOpen(false)}>
                    <button onClick={() => { setShareOpen(false); shareSession("html"); }}>{t("share.openHtml")}</button>
                    <button onClick={() => { setShareOpen(false); void exportHtml(); }}>{t("share.exportHtml")}</button>
                    <button onClick={() => { setShareOpen(false); void publishGist(); }}>{t("share.gist")}</button>
                    <button onClick={() => { setShareOpen(false); shareSession("md"); }}>{t("share.copyMd")}</button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {busy && progressBar ? <div className="progress" /> : null}

          <div className="transcript" ref={scrollRef}>
            <div className="transcript-inner">
            {messages.length === 0 ? (
              <div className="empty">
                <Hero onSuggest={(text) => { setInput(text); inputRef.current?.focus(); }} />
                {!/^(termcoderfree|termcoder\/|termexplorer|ollama\/)/.test(model) ? (
                  <button className="free-hint" onClick={() => changeModel("termcoderfree/auto")}>
                    {t("chat.freeHint")}
                  </button>
                ) : null}
                {!(serverStatus?.providers ?? []).some((p) => p.configured && p.name !== "ollama") &&
                 localStorage.getItem("tc-skip-upgrade") !== "1" ? (
                  <button className="free-hint" onClick={() => { setSettingsTab("providers"); setSettingsOpen(true); }}>
                    {t("upgrade.title")} →
                  </button>
                ) : null}
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === "user" ? (
                  <div className="bubble user">
                    {m.images && m.images.length ? (
                      <div className="msg-images">
                        {m.images.map((src, k) => (
                          <img key={k} src={src} alt="attachment" />
                        ))}
                      </div>
                    ) : null}
                    {m.text}
                  </div>
                ) : null}
                {m.role === "notice" ? <div className="notice">{m.text}</div> : null}
                {m.role === "assistant" ? (
                  busy && i === messages.length - 1 ? (
                    <div className="bubble assistant streaming">{m.text}</div>
                  ) : (
                    <div className="assistant-wrap">
                      <div className="msg-meta"><span className="msg-spine" />termcoder</div>
                      <div className="bubble assistant markdown">
                        <ErrorBoundary fallback={() => <pre className="md-fallback">{m.text}</pre>}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[[rehypeHighlight, { ignoreMissing: true, detect: true }]]}
                          >
                            {m.text}
                          </ReactMarkdown>
                        </ErrorBoundary>
                      </div>
                      <button className="msg-copy" title={t("msg.copy")} onClick={() => void copyText(m.text)}>
                        <IconCopy />
                      </button>
                    </div>
                  )
                ) : null}
                {m.role === "tool" ? (
                  <ToolCard name={m.name} text={m.text} status={m.status} detail={m.detail} defaultOpen={expandTools} />
                ) : null}
                {m.role === "error" ? <div className="bubble error">✗ {m.text}</div> : null}
              </div>
            ))}
            </div>
          </div>

          {perm && !isGuest ? (
            <div className="perm">
              <div className="perm-card">
                <div className="perm-title">{t("perm.title")}</div>
                <div className="perm-detail">{perm.title}</div>
                {perm.detail ? (isDiff(perm.detail) ? <DiffBlock text={perm.detail} /> : <pre className="detail">{perm.detail}</pre>) : null}
                <div className="perm-actions">
                  <button className="allow" onClick={() => decide("allow")}>{t("perm.allow")}</button>
                  <button className="always" onClick={() => decide("allow-always")}>{t("perm.always")}</button>
                  <button className="deny" onClick={() => decide("deny")}>{t("perm.deny")}</button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="dock">
            <div className="dock-inner">
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
            {cmdMatch ? (
              <div className="mention-pop cmd-pop">
                {cmdMatch.items.map((c, i) => (
                  <div
                    key={c.name}
                    className={`mention-item cmd-item ${i === cmdMatch.active ? "active" : ""}`}
                    onMouseEnter={() => setCmdMatch((m) => (m ? { ...m, active: i } : m))}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickCommand(c.name);
                    }}
                  >
                    <span className="cmd-name">/{c.name}</span>
                    {c.description ? <span className="cmd-desc">{c.description}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {cmdPreview ? (
              <div className="cmd-preview">
                <div className="cmd-preview-head">{t("cmd.preview")}</div>
                <pre>{cmdPreview}</pre>
              </div>
            ) : null}
            {pendingImages.length ? (
              <div className="img-strip">
                {pendingImages.map((img, i) => (
                  <div className="img-thumb" key={i}>
                    <img src={img.dataUrl} alt={img.name} />
                    <button className="img-remove" title="Remove" onClick={() => removeImage(i)}>
                      <IconClose />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {composerEl}
            </div>
          </div>
          </>
          )}

          {termMounted ? (
            <TerminalDeck
              cwd={cwd}
              hidden={centerTab !== "terminal"}
              themeKey={`${theme}:${colorTheme}:${accent}`}
            />
          ) : null}

          <AgentCanvas graph={graph} hidden={centerTab !== "canvas"} />
        </main>

        {sidePanel ? (
          <SidePanel
            kind={sidePanel}
            onClose={() => setSidePanel(null)}
            cwd={cwd}
            status={status}
            changes={changes}
            changedFiles={changedFiles}
            onOpenFile={(p) => void openFile(p)}
            onOpenDiff={(p) => void openDiff(p)}
            onOpenAllDiffs={() => void openAllDiffs()}
            branches={branches}
            compareBase={compareBase}
            onChangeCompareBase={setCompareBase}
            sessions={sessions}
            port={port}
            agents={agents}
            currentAgent={agent}
            onPickAgent={(name) => setAgent(name)}
            onManageAgents={() => { setSidePanel(null); setSettingsTab("agents"); setSettingsOpen(true); }}
          />
        ) : null}
      </div>
      </div>

      {recipesOpen ? (
        <RecipesPanel port={port} cwd={cwd} onClose={() => setRecipesOpen(false)} onRun={runRecipe} />
      ) : null}

      {classroomOpen ? (
        <ClassroomPanel
          port={port}
          onClose={() => setClassroomOpen(false)}
          onUpgrade={() => { setClassroomOpen(false); setSettingsTab("pro"); setSettingsOpen(true); }}
        />
      ) : null}

      {roomOpen ? (
        <RoomView room={room} myName={myName} onChangeName={setMyName} onClose={() => setRoomOpen(false)} />
      ) : null}

      {viewerOpen && tabs.length ? (
        <TabbedViewer
          tabs={tabs}
          activeTab={activeTab}
          onActivate={setActiveTab}
          onClose={() => setViewerOpen(false)}
          onCloseTab={closeTab}
          onEdit={editTab}
          onSave={saveTab}
          onAskAI={askAboutFile}
          aiSuggest={aiSuggest}
          codeTheme={codeTheme}
          comments={reviewComments}
          onAddComment={addReviewComment}
          onRemoveComment={removeReviewComment}
          hunkIndex={hunkIndex}
          hunkCount={hunkCount}
          onHunkCount={setHunkCount}
          onPrevHunk={() => setHunkIndex((i) => Math.max(0, i - 1))}
          onNextHunk={() => setHunkIndex((i) => Math.min(hunkCount - 1, i + 1))}
          onSendComments={sendReviewComments}
          compareBase={compareBase}
        />
      ) : null}
      {paletteOpen ? <CommandPalette items={paletteItems} onClose={() => setPaletteOpen(false)} /> : null}
      {!onboarded && !JOIN_ROOM ? <Welcome onChoose={chooseMode} /> : null}

      {browserOpen ? (
        <ModelBrowser port={port} current={model} onSelect={changeModel} onClose={() => setBrowserOpen(false)} />
      ) : null}

      {update ? (
        <div className="update-toast">
          <div className="update-text">
            <b>Update available</b>
            <span>termcoder {update.latest} is out — you have an older version.</span>
          </div>
          <div className="update-actions">
            <button
              className="settings-btn"
              onClick={() =>
                window.open("https://cartivo-oficial.github.io/TermCoder/download.html", "_blank")
              }
            >
              Get it
            </button>
            <button
              className="update-later"
              onClick={() => {
                localStorage.setItem("tc-skip-update", update.latest);
                setUpdate(null);
              }}
            >
              Later
            </button>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <Settings
          onClose={() => setSettingsOpen(false)}
          tab={settingsTab}
          setTab={setSettingsTab}
          theme={theme}
          setTheme={setTheme}
          colorTheme={colorTheme}
          setColorTheme={setColorTheme}
          studentMode={studentMode}
          setStudentMode={applyStudentMode}
          keybinds={keybinds}
          setKeybinds={setKeybinds}
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
          accent={accent}
          setAccent={setAccent}
          density={density}
          setDensity={setDensity}
          reduceMotion={reduceMotion}
          setReduceMotion={setReduceMotion}
          autoScroll={autoScroll}
          setAutoScroll={setAutoScroll}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          temperature={temperature}
          setTemperature={setTemperature}
          maxSteps={maxSteps}
          setMaxSteps={setMaxSteps}
          soundOnFinish={soundOnFinish}
          setSoundOnFinish={setSoundOnFinish}
          micDeviceId={micDeviceId}
          setMicDeviceId={setMicDeviceId}
          wordWrap={wordWrap}
          setWordWrap={setWordWrap}
          aiSuggest={aiSuggest}
          setAiSuggest={setAiSuggest}
          codeTheme={codeTheme}
          setCodeTheme={setCodeTheme}
          notifyOnFinish={notifyOnFinish}
          setNotifyOnFinish={setNotifyOnFinish}
          autoCommit={autoCommit}
          setAutoCommit={setAutoCommit}
          openAtLogin={openAtLogin}
          setOpenAtLogin={setOpenAtLogin}
          enableTray={enableTray}
          setEnableTray={setEnableTray}
          enableHotkey={enableHotkey}
          setEnableHotkey={setEnableHotkey}
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
