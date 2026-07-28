import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { FileTree } from "./FileTree";
import { TerminalPane } from "./TerminalPane";
import { FilePreview, FileCard } from "./FilePreview";
import { useMessageParser } from "./MessageParser";

function join(...parts: Array<string | null | undefined>): string {
  const clean: string[] = [];
  for (const p of parts) if (p != null && p !== "") clean.push(p as string);
  if (clean.length === 0) return "";
  let out = clean[0] as string;
  for (let i = 1; i < clean.length; i++) {
    const p = clean[i] as string;
    if (!out) { out = p; continue; }
    const a = out.endsWith("/") || out.endsWith("\\");
    const b = p.startsWith("/") || p.startsWith("\\");
    if (a && b) out = out.slice(0, -1) + p;
    else if (!a && !b) out = out + "/" + p;
    else out = out + p;
  }
  return out;
}
import { CodeEditor, type CodeEditorHandle } from "./CodeEditor";
import { ErrorBoundary } from "./ErrorBoundary";
import { ToolCard } from "./ToolCard";
import {
  IconBack,
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconCollapse,
  IconCopy,
  IconDesktop,
  IconEdit,
  IconFile,
  IconFolder,
  IconFolderNew,
  IconForward,
  IconIDE,
  IconMaximize,
  IconMic,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSettings,
  IconStop,
  IconTerminal,
  IconTrash,
  IconUntitled,
  IconWrap,
  IconBolt,
  IconChat,
  IconGitBranch,
  IconGitDiff,
  IconGitCommit,
  IconPlay,
  IconPanelBottom,
  IconPanelLeft,
  IconSplitH,
  IconLayers,
  IconBug,
  IconBox,
  IconAlertTriangle,
  IconAlertCircle,
  IconChevronsDown,
  IconPuzzle,
  IconEye,
  IconEyeOff,
  IconRotateCcw,
  IconPlusSquare,
  IconMinusSquare,
  IconCaseUpper,
  IconRegex,
  IconHash,
  IconChevron,
  IconFileText,
  IconComment,
  IconWand,
  IconSave,
} from "./Icons";
import { useI18n } from "./i18n";
import type { Tab } from "./App";
import type { DiffComment } from "./ToolCard";

export type { Tab };

export interface IDEMessage {
  role: "user" | "assistant" | "tool" | "notice" | "error";
  text: string;
  name?: string;
  status?: "running" | "done" | "error";
  detail?: string;
  images?: string[];
}

export interface IDEProps {
  mode: "ide" | "desktop";
  onToggleMode: () => void;
  cwd: string | null;
  status: Record<string, string>;
  changes: number;
  tabs: Tab[];
  activeTab: string | null;
  onActivateTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
  onCloseRightTabs: (id: string) => void;
  onCloseAllTabs: () => void;
  onReopenTab: () => Tab | null;
  onOpenFile: (path: string) => void;
  onEditTab: (id: string, content: string) => void;
  onSaveTab: (id: string) => void;
  onAskAIAboutTab: (tab: Tab) => void;
  codeTheme: string;
  port: number;
  wordWrap: boolean;
  messages: IDEMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  connected: boolean;
  sendOnEnter: boolean;
  mention: { query: string; items: string[]; active: number } | null;
  onInsertMention: (f: string) => void;
  mentionActiveRef: React.MutableRefObject<number>;
  pendingImages: Array<{ dataUrl: string; mediaType: string; name: string }>;
  onAddImage: (f: File) => void;
  onRemoveImage: (i: number) => void;
  onAttachFiles: () => void;
  autonomous: boolean;
  onToggleAutonomous: () => void;
  recording: boolean;
  transcribing: boolean;
  onToggleMic: () => void;
  model: string;
  agent: string;
  onChangeModel: (m: string) => void;
  onChangeAgent: (a: string) => void;
  workingLabel: string;
  workingDetail: string;
  workingTokens: number;
  tokensIn: number;
  tokensOut: number;
  lastCtx: number;
  catalog: Array<{ id: string; contextK?: number }>;
  onToggleFiles: () => void;
  onChooseFolder: () => void;
  projectName: string;
  t: (k: string, args?: Record<string, string | number>) => string;
  fmtTokens: (n: number) => string;
  onCopyText: (t: string) => void;
  refreshTree: () => void;
  onToggleSettings: () => void;
}

type SideView = "explorer" | "search" | "git" | "debug" | "extensions";
type BottomView = "terminal" | "problems" | "output" | "debug";

interface TermInstance {
  id: number;
  name: string;
  lines: string[];
  command: string;
}

// ============================================================================
// Context menu popup
// ============================================================================
function CtxMenu({
  pos,
  items,
  onClose,
}: {
  pos: { x: number; y: number };
  items: Array<
    | { label: string; icon?: React.ReactNode; shortcut?: string; onClick: () => void; danger?: boolean; disabled?: boolean }
    | { sep: true }
  >;
  onClose: () => void;
}) {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(".ctx-menu");
      if (!el) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div
      className="ctx-menu"
      style={{ left: pos.x, top: pos.y }}
      onMouseLeave={(e) => {
        const x = e.clientX,
          y = e.clientY;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        if (x < rect.left - 4 || x > rect.right + 4 || y < rect.top - 4 || y > rect.bottom + 4) onClose();
      }}
    >
      {items.map((it, i) =>
        "sep" in it ? (
          <div className="ctx-sep" key={i} />
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            className={`ctx-item ${it.danger ? "danger" : ""}`}
            onClick={() => {
              it.onClick();
              onClose();
            }}
          >
            {it.icon ? <span className="ctx-icon">{it.icon}</span> : null}
            <span className="ctx-label">{it.label}</span>
            {it.shortcut ? <span className="ctx-shortcut">{it.shortcut}</span> : null}
          </button>
        ),
      )}
    </div>
  );
}

function Composer({
  p,
  inputRef,
}: {
  p: IDEProps;
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>;
}) {
  const { t } = useI18n();
  const ctxPct =
    p.lastCtx > 0
      ? Math.round(
          (p.lastCtx / ((p.catalog.find((c) => c.id === p.model)?.contextK ?? 128) * 1000)) * 100,
        )
      : 0;
  return (
    <div
      className={`ide-composer ${p.busy ? "busy" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        for (const f of Array.from(e.dataTransfer.files)) p.onAddImage(f);
      }}
      onPaste={(e) => {
        const imgs = Array.from(e.clipboardData.items).filter((it) => it.type.startsWith("image/"));
        if (imgs.length) {
          e.preventDefault();
          for (const it of imgs) {
            const f = it.getAsFile();
            if (f) p.onAddImage(f);
          }
        }
      }}
    >
      <div className="ide-c-status">
        <span className={`dot ${p.busy ? "gen" : p.connected ? "on" : "off"}`} />
        {p.busy ? (
          <span className="cs-working">
            {p.workingLabel}
            {p.workingDetail ? <span className="muted"> · {p.workingDetail}</span> : null}
            {p.workingTokens > 0 ? (
              <span className="cs-tok">
                {p.fmtTokens(p.workingTokens)} {t("chat.tok")}
              </span>
            ) : null}
          </span>
        ) : (
          <>
            {p.lastCtx > 0 ? (
              <span className={`cs-item ${ctxPct > 70 ? "hot" : ctxPct > 40 ? "warm" : ""}`}>
                ctx {p.fmtTokens(p.lastCtx)} ({ctxPct}%)
              </span>
            ) : null}
            {p.tokensIn || p.tokensOut ? (
              <span className="cs-item">↓{p.fmtTokens(p.tokensIn)} ↑{p.fmtTokens(p.tokensOut)}</span>
            ) : null}
          </>
        )}
        <span className="ide-c-spacer" />
        <button className="chip sm" title="Agent" onClick={() => p.onChangeAgent(p.agent)}>
          {p.agent}
        </button>
        <button className="chip sm" title="Model" onClick={() => p.onChangeModel(p.model)}>
          {p.model}
        </button>
      </div>
      {p.pendingImages.length ? (
        <div className="img-strip">
          {p.pendingImages.map((i, k) => (
            <div className="img-thumb" key={k}>
              <img src={i.dataUrl} alt={i.name} />
              <button className="img-remove" onClick={() => p.onRemoveImage(k)}>
                <IconClose />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <textarea
        ref={inputRef}
        value={p.input}
        placeholder={`Ask about this project (e.g. "fix errors in the active file")`}
        onChange={(e) => {
          p.onInputChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (p.mention) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              p.mentionActiveRef.current = Math.min(p.mentionActiveRef.current + 1, p.mention.items.length - 1);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              p.mentionActiveRef.current = Math.max(p.mentionActiveRef.current - 1, 0);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              const active = p.mention.items[p.mentionActiveRef.current] ?? p.mention.items[0];
              if (active) p.onInsertMention(active);
              return;
            }
            if (e.key === "Escape") {
              p.mentionActiveRef.current = 0;
              p.onInsertMention("__clear__");
              return;
            }
          }
          if (e.key === "Escape" && p.busy) {
            e.preventDefault();
            p.onStop();
            return;
          }
          const wantSend = p.sendOnEnter
            ? e.key === "Enter" && !e.shiftKey
            : e.key === "Enter" && (e.ctrlKey || e.metaKey);
          if (wantSend) {
            e.preventDefault();
            p.onSend();
          }
        }}
      />
      <div className="ide-c-actions">
        <button className="attach" title="Attach" onClick={() => p.onAttachFiles()}>
          <IconPlus />
        </button>
        <button
          className="attach"
          title={
            p.autonomous
              ? "Autonomous mode: ON — runs to the goal, verifies, and keeps fixing"
              : "Autonomous mode: OFF"
          }
          onClick={() => p.onToggleAutonomous()}
          style={p.autonomous ? { color: "var(--accent)" } : undefined}
        >
          <IconBolt />
        </button>
        <button
          className={`attach mic ${p.recording ? "recording" : ""} ${p.transcribing ? "transcribing" : ""}`}
          title={p.transcribing ? p.t("voice.transcribing") : p.recording ? p.t("voice.stop") : p.t("composer.mic")}
          onClick={() => p.onToggleMic()}
          disabled={p.transcribing}
        >
          <IconMic />
        </button>
        <span className="ca-spacer" />
        {p.busy ? (
          <button className="send stop" onClick={() => p.onStop()} title={p.t("chat.stop")}>
            <IconStop />
          </button>
        ) : (
          <button className="send" onClick={() => p.onSend()} disabled={!p.connected}>
            <IconSend />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Source Control Panel
// ============================================================================
function SourceControlPanel({
  p,
  staged,
  unstaged,
  untracked,
  modified,
  onOpenFile,
}: {
  p: IDEProps;
  staged: Record<string, string>;
  unstaged: Record<string, string>;
  untracked: string[];
  modified: string[];
  onOpenFile: (path: string) => void;
}) {
  const [msg, setMsg] = useState("");
  const [stagedOpen, setStagedOpen] = useState(true);
  const [unstagedOpen, setUnstagedOpen] = useState(true);
  const [untrackedOpen, setUntrackedOpen] = useState(true);
  const relPath = (abs: string) => {
    if (!p.cwd) return abs;
    if (!abs.startsWith(p.cwd)) return abs;
    return abs.slice(p.cwd.length).replace(/^[\\/]+/, "");
  };
  const badgeFor = (s: string) => {
    if (s === "M") return "M";
    if (s === "A") return "A";
    if (s === "D") return "D";
    if (s === "R") return "R";
    if (s === "U") return "U";
    if (s === "??") return "U";
    return s.charAt(0).toUpperCase();
  };
  const entries = (map: Record<string, string>) =>
    Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  const commit = async () => {
    if (!p.cwd || !msg.trim()) return;
    const r = await window.api!.gitCommit(p.cwd, msg.trim());
    if (!r.ok) alert(r.message);
    else setMsg("");
    p.refreshTree();
  };
  const FileRow = ({ path, status }: { path: string; status: string }) => (
    <div className="scm-file" onClick={() => onOpenFile(path)} title={path}>
      <div className="sf-name">
        <IconFile />
        <span>{relPath(path) || path}</span>
      </div>
      <span className={`sf-badge ${badgeFor(status)}`}>{badgeFor(status)}</span>
      <div className="sf-actions" onClick={(e) => e.stopPropagation()}>
        <button title="Open file" onClick={() => onOpenFile(path)}>
          <IconEye />
        </button>
        <button title="Stage / Unstage" onClick={() => p.refreshTree()}>
          <IconPlusSquare />
        </button>
        <button title="Discard changes" onClick={() => p.refreshTree()}>
          <IconRotateCcw />
        </button>
      </div>
    </div>
  );
  return (
    <div className="scm-wrap">
      <div className="scm-input-row">
        <textarea
          className="scm-input"
          rows={2}
          placeholder="Message (Ctrl+Enter to commit)"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
          }}
        />
        <div className="scm-actions-row">
          <button className="settings-btn" title="Refresh" onClick={() => p.refreshTree()}>
            <IconRefresh />
          </button>
          <button className="settings-btn" title="Discard All">
            <IconRotateCcw />
          </button>
          <div className="spacer" />
          <button
            className="settings-btn primary"
            disabled={!msg.trim() || Object.keys(staged).length + modified.length === 0}
            onClick={() => void commit()}
          >
            <IconGitCommit /> Commit
          </button>
        </div>
      </div>
      <div className="scm-list">
        {Object.keys(staged).length > 0 && (
          <>
            <div
              className={`scm-group-head ${stagedOpen ? "" : "collapsed"}`}
              onClick={() => setStagedOpen((v) => !v)}
            >
              <IconChevronDown /> STAGED CHANGES
              <span className="count">{Object.keys(staged).length}</span>
            </div>
            {stagedOpen && entries(staged).map(([path, s]) => <FileRow key={path} path={path} status={s} />)}
          </>
        )}
        {(Object.keys(unstaged).length + modified.length) > 0 && (
          <>
            <div
              className={`scm-group-head ${unstagedOpen ? "" : "collapsed"}`}
              onClick={() => setUnstagedOpen((v) => !v)}
            >
              <IconChevronDown /> CHANGES
              <span className="count">{Object.keys(unstaged).length + modified.length}</span>
            </div>
            {unstagedOpen && (
              <>
                {entries(unstaged).map(([path, s]) => (
                  <FileRow key={`u:${path}`} path={path} status={s} />
                ))}
                {modified.map((path) =>
                  unstaged[path] ? null : <FileRow key={`m:${path}`} path={path} status="M" />,
                )}
              </>
            )}
          </>
        )}
        {untracked.length > 0 && (
          <>
            <div
              className={`scm-group-head ${untrackedOpen ? "" : "collapsed"}`}
              onClick={() => setUntrackedOpen((v) => !v)}
            >
              <IconChevronDown /> UNTRACKED
              <span className="count">{untracked.length}</span>
            </div>
            {untrackedOpen &&
              [...untracked].sort().map((path) => <FileRow key={`nt:${path}`} path={path} status="A" />)}
          </>
        )}
        {Object.keys(staged).length + Object.keys(unstaged).length + untracked.length + modified.length === 0 ? (
          <div className="search-empty">No source control changes. Make edits, then refresh.</div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// Search Panel (Find in Files)
// ============================================================================
function SearchPanel({
  p,
  onOpenFile,
}: {
  p: IDEProps;
  onOpenFile: (path: string, line?: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [filesInclude, setFilesInclude] = useState("");
  const [filesExclude, setFilesExclude] = useState("node_modules,.git");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ file: string; hits: Array<{ line: number; code: string; start: number; end: number }> }>>([]);
  const [openFiles, setOpenFiles] = useState<Record<string, boolean>>({});
  const [replaceVisible, setReplaceVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const runSearch = async (q = query) => {
    setError(null);
    if (!q.trim()) { setResults([]); return; }
    if (!p.cwd) { setError("No folder open — open a project folder first."); return; }
    setBusy(true);
    try {
      const allFiles = await window.api!.allFiles(p.cwd);
      if (!allFiles || allFiles.length === 0) {
        setResults([]);
        return;
      }
      const inc = filesInclude.split(",").map((s) => s.trim()).filter(Boolean);
      const exc = filesExclude.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      const filtered = allFiles.filter((f) => {
        const low = f.toLowerCase();
        if (exc.some((e) => e && low.includes(e))) return false;
        if (inc.length > 0 && !inc.some((i) => i && low.includes(i.toLowerCase()))) return false;
        return true;
      });
      const flags = `gm${caseSensitive ? "" : "i"}`;
      let re: RegExp;
      try {
        const pattern = useRegex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const finalPattern = wholeWord ? `\\b${pattern}\\b` : pattern;
        re = new RegExp(finalPattern, flags);
      } catch (err) {
        setError(`Invalid regex: ${err instanceof Error ? err.message : String(err)}`);
        setResults([]);
        return;
      }
      const out: typeof results = [];
      for (const f of filtered.slice(0, 500)) {
        const read = await window.api!.readFile(f);
        if (read.error) continue;
        const lines = read.content.split(/\r?\n/);
        const hits: Array<{ line: number; code: string; start: number; end: number }> = [];
        for (let i = 0; i < lines.length; i++) {
          re.lastIndex = 0;
          let m: RegExpExecArray | null;
          let guard = 0;
          const line = lines[i] ?? "";
          while ((m = re.exec(line)) !== null && guard < 20) {
            guard++;
            hits.push({ line: i + 1, code: line, start: m.index, end: m.index + m[0].length });
            if (m[0].length === 0) re.lastIndex++;
          }
          if (hits.length >= 100) break;
        }
        if (hits.length > 0) {
          out.push({ file: f, hits });
          setOpenFiles((o) => ({ ...o, [f]: true }));
        }
        if (out.length >= 200) break;
      }
      setResults(out);
    } catch (err) {
      setError(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const doReplaceAll = async () => {
    if (!replace || results.length === 0 || !p.cwd) return;
    setBusy(true);
    try {
      for (const r of results) {
        const read = await window.api!.readFile(r.file);
        if (read.error) continue;
        const flags = `gm${caseSensitive ? "" : "i"}`;
        const pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const finalPattern = wholeWord ? `\\b${pattern}\\b` : pattern;
        const re = new RegExp(finalPattern, flags);
        const newContent = read.content.replace(re, replace);
        if (newContent !== read.content) {
          await window.api!.writeFile(r.file, newContent);
        }
      }
      await runSearch();
    } finally {
      setBusy(false);
    }
  };

  const highlight = (code: string, start: number, end: number) => {
    const q = end - start;
    if (q <= 0) return code;
    const contextPad = 30;
    const s = Math.max(0, start - contextPad);
    const e = Math.min(code.length, end + contextPad);
    const prefix = s > 0 ? "…" : "";
    const suffix = e < code.length ? "…" : "";
    const sub = code.slice(s, e);
    const rs = start - s + prefix.length;
    const re2 = end - s + prefix.length;
    return (
      <>
        {prefix}
        {sub.slice(0, rs)}
        <mark>{sub.slice(rs, re2)}</mark>
        {sub.slice(re2)}
        {suffix}
      </>
    );
  };

  const relPath = (abs: string) => {
    if (!p.cwd) return abs;
    if (!abs.startsWith(p.cwd)) return abs;
    return abs.slice(p.cwd.length).replace(/^[\\/]+/, "");
  };

  const totalHits = results.reduce((n, r) => n + r.hits.length, 0);

  return (
    <div className="search-wrap">
      <div className="search-inputs">
        {/* Search row */}
        <div className="search-row">
          <button
            className="search-expand-btn"
            title="Toggle Replace"
            onClick={() => setReplaceVisible((v) => !v)}
          >
            <IconChevronDown style={{ transform: replaceVisible ? "none" : "rotate(-90deg)", width: 12, height: 12 }} />
          </button>
          <input
            ref={inputRef}
            placeholder={p.cwd ? "Search (Enter to run)" : "Open a folder to search…"}
            value={query}
            disabled={!p.cwd}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void runSearch(); }
            }}
          />
          <div className="search-toggles">
            <button className={caseSensitive ? "active" : ""} onClick={() => setCaseSensitive((v) => !v)} title="Match Case (Alt+C)">
              <IconCaseUpper />
            </button>
            <button className={wholeWord ? "active" : ""} onClick={() => setWholeWord((v) => !v)} title="Whole Word (Alt+W)">
              <IconHash />
            </button>
            <button className={useRegex ? "active" : ""} onClick={() => setUseRegex((v) => !v)} title="Use Regex (Alt+R)">
              <IconRegex />
            </button>
          </div>
        </div>

        {/* Replace row */}
        {replaceVisible && (
          <div className="search-row">
            <span style={{ width: 14, flexShrink: 0 }} />
            <input
              placeholder="Replace"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void doReplaceAll(); }}
            />
            <button
              className="search-replace-btn"
              title="Replace All"
              disabled={busy || !replace || results.length === 0}
              onClick={() => void doReplaceAll()}
            >
              All
            </button>
          </div>
        )}

        {/* Files filter rows */}
        <div className="search-row search-row-sm">
          <IconFileText style={{ width: 11, height: 11, flexShrink: 0, color: "var(--faint)" }} />
          <input
            placeholder="files to include (e.g. *.ts)"
            value={filesInclude}
            onChange={(e) => setFilesInclude(e.target.value)}
            style={{ fontSize: 10.5 }}
          />
        </div>
        <div className="search-row search-row-sm">
          <IconEyeOff style={{ width: 11, height: 11, flexShrink: 0, color: "var(--faint)" }} />
          <input
            placeholder="files to exclude"
            value={filesExclude}
            onChange={(e) => setFilesExclude(e.target.value)}
            style={{ fontSize: 10.5 }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="search-status">
        {busy ? (
          <span className="search-status-text"><IconRefresh style={{ width: 11, height: 11 }} /> Searching…</span>
        ) : error ? (
          <span className="search-status-text err">{error}</span>
        ) : !p.cwd ? (
          <span className="search-status-text muted">No folder open</span>
        ) : totalHits > 0 ? (
          <>
            <span className="search-status-text">{totalHits} result{totalHits !== 1 ? "s" : ""} in {results.length} file{results.length !== 1 ? "s" : ""}</span>
            <button className="search-act-btn" title="Collapse All" onClick={() => {
              const n: Record<string, boolean> = {};
              for (const r of results) n[r.file] = false;
              setOpenFiles(n);
            }}>
              <IconCollapse />
            </button>
            <button className="search-act-btn" title="Clear results" onClick={() => { setResults([]); setQuery(""); }}>
              <IconClose />
            </button>
          </>
        ) : query.trim() ? (
          <span className="search-status-text muted">No results for "{query}"</span>
        ) : (
          <span className="search-status-text muted">Type to search across files</span>
        )}
      </div>

      <div className="search-results">
        {results.map((r) => {
          const open = openFiles[r.file] ?? true;
          return (
            <div key={r.file} className="sr-file">
              <div
                className="sr-file-head"
                onClick={() => setOpenFiles((o) => ({ ...o, [r.file]: !(o[r.file] ?? true) }))}
              >
                {open ? <IconChevronDown style={{ width: 10, height: 10 }} /> : <IconChevron style={{ width: 10, height: 10 }} />}
                <IconFile style={{ width: 12, height: 12 }} />
                <span className="fname">{relPath(r.file)}</span>
                <span className="count">{r.hits.length}</span>
              </div>
              {open &&
                r.hits.map((h, i) => (
                  <div
                    key={`${r.file}:${h.line}:${i}`}
                    className="sr-hit"
                    onClick={() => onOpenFile(r.file, h.line)}
                  >
                    <span className="ln">{h.line}</span>
                    <span className="code">{highlight(h.code, h.start, h.end)}</span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ============================================================================
// Terminal / Bottom Panels
// ============================================================================
function TerminalPanel({
  p,
  terms,
  setTerms,
  activeTerm,
  setActiveTerm,
  termH,
  setTermH,
}: {
  p: IDEProps;
  terms: TermInstance[];
  setTerms: React.Dispatch<React.SetStateAction<TermInstance[]>>;
  activeTerm: number;
  setActiveTerm: (id: number) => void;
  termH: number;
  setTermH: (n: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(2);
  const [cmd, setCmd] = useState("");
  const [ptyRunning, setPtyRunning] = useState<Record<number, boolean>>({});
  const active = terms.find((t) => t.id === activeTerm) ?? terms[0];

  const newTerm = () => {
    const id = nextId.current++;
    const name = p.cwd ? (process.platform === "win32" ? "PowerShell" : "bash") : "Terminal";
    const t: TermInstance = { id, name, lines: [`TermCoder Terminal (id: ${id}) — ${p.cwd ?? "(no folder)"}`, `Tip: most commands run via the AI assistant will appear here.`], command: "" };
    setTerms((old) => [...old, t]);
    setActiveTerm(id);
  };

  const closeTerm = (id: number) => {
    setTerms((old) => {
      const remaining = old.filter((x) => x.id !== id);
      if (id === activeTerm && remaining.length > 0) setActiveTerm(remaining[remaining.length - 1]!.id);
      return remaining;
    });
  };

  const startPty = async (tid: number, text: string) => {
    if (!p.cwd) {
      setTerms((old) => old.map((x) => x.id === tid ? { ...x, lines: [...x.lines, "No folder open."] } : x));
      return;
    }
    const cols = 120;
    const rows = Math.max(8, Math.floor(termH / 20));
    const r = await window.api!.pty.start(tid, { cwd: p.cwd, cols, rows });
    if (!r.ok) {
      setTerms((old) => old.map((x) => x.id === tid ? { ...x, lines: [...x.lines, `PTY error: ${r.error}`] } : x));
      return;
    }
    setPtyRunning((m) => ({ ...m, [tid]: true }));
    window.api!.pty.onData(tid, (data) => {
      setTerms((old) => old.map((x) => x.id === tid ? { ...x, lines: [...x.lines, ...data.split(/\r?\n/g).slice(0, 500)] } : x));
    });
    window.api!.pty.onExit(tid, () => {
      setPtyRunning((m) => ({ ...m, [tid]: false }));
    });
    setTimeout(() => window.api!.pty.write(tid, text + "\r\n"), 20);
  };

  const runCmd = async () => {
    if (!cmd.trim()) return;
    const text = cmd;
    setCmd("");
    setTerms((old) => {
      const target = old.find((x) => x.id === activeTerm);
      if (!target) return old;
      const promptLine = `$ ${text}`;
      return old.map((x) => x.id === activeTerm ? { ...x, lines: [...x.lines, promptLine], command: text } : x);
    });
    if (!ptyRunning[activeTerm]) {
      await startPty(activeTerm, text);
    } else {
      window.api!.pty.write(activeTerm, text + "\r\n");
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [active?.lines.length, activeTerm]);

  useEffect(() => {
    if (terms.length === 0) {
      void (async () => {
        const id = 1;
        const name = p.cwd ? (process.platform === "win32" ? "PowerShell" : "bash") : "Terminal";
        const lines = [
          `TermCoder Integrated Terminal — ${p.cwd ?? "(no folder open)"}`,
          ``,
          `Shortcuts:`,
          `  • Toggle terminal panel: Ctrl+\``,
          `  • New terminal: Ctrl+Shift+\``,
          ``,
          `Ready. Type a command below and press Enter (or use the AI assistant on the right).`,
        ];
        setTerms([{ id, name, lines, command: "" }]);
        setActiveTerm(id);
        nextId.current = 2;
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.cwd]);

  return (
    <div className="terminal-wrap">
      <div className="terminal-header-tabs">
        {terms.map((t) => (
          <div
            key={t.id}
            className={`term-tab ${t.id === activeTerm ? "active" : ""}`}
            onClick={() => setActiveTerm(t.id)}
          >
            <IconTerminal style={{ width: 13, height: 13, opacity: 0.8 }} />
            <span className="term-tab-name">{t.name} #{t.id}</span>
            {ptyRunning[t.id] ? <span className={`dot on`} style={{ width: 6, height: 6 }} /> : null}
            <button
              className="term-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTerm(t.id);
              }}
              title="Kill terminal"
            >
              <IconClose />
            </button>
          </div>
        ))}
        <button className="icon sm" onClick={() => newTerm()} title="New Terminal (Ctrl+Shift+`)">
          <IconPlus />
        </button>
        <div style={{ flex: 1 }} />
        <button className="icon sm" onClick={() => setTermH(240)} title="Reset size">
          <IconMaximize />
        </button>
      </div>
      <div className="term-xterm" ref={scrollRef}>
        {active?.lines.map((ln, i) => (
          <div key={i} className="term-line">{ln.startsWith("$ ") ? <><span className="term-prompt">$</span> {ln.slice(2)}</> : ln}</div>
        ))}
      </div>
      <div className="term-input-row">
        <span className="tp">$</span>
        <input
          ref={inputRef}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void runCmd(); }
          }}
          placeholder={ptyRunning[activeTerm] ? "running… send keys via write" : `Type a command (e.g. npm install, pnpm dev, ls, git status)`}
          disabled={!!ptyRunning[activeTerm]}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function ProblemsPanel({ cwd, onOpenFile }: { cwd: string | null; onOpenFile: (path: string, line?: number) => void }) {
  type Problem = { file: string; line: number; col: number; severity: "error" | "warning"; message: string };
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);

  const scan = async () => {
    if (!cwd) return;
    setBusy(true);
    setRan(true);
    try {
      // Run tsc --noEmit if tsconfig exists, capture output, parse diagnostics
      const r = await window.api!.pty.start(-99, { cwd, cols: 200, rows: 40 });
      if (!r.ok) { setBusy(false); return; }
      const lines: string[] = [];
      const offData = window.api!.pty.onData(-99, (d) => {
        lines.push(...d.split(/\r?\n/));
      });
      window.api!.pty.write(-99, "npx tsc --noEmit 2>&1; exit 0\r");
      await new Promise<void>((res) => {
        const offExit = window.api!.pty.onExit(-99, () => {
          offData();
          offExit();
          res();
        });
        // fallback timeout 30s
        setTimeout(() => { offData(); res(); }, 30_000);
      });
      // Parse TypeScript diagnostics: "path(line,col): error TSxxxx: message"
      const parsed: Problem[] = [];
      const re = /^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)$/;
      for (const l of lines) {
        const m = re.exec(l.trim());
        if (m) {
          const [, file, ln, col, sev, msg] = m;
          parsed.push({
            file: file!.trim(),
            line: Number(ln),
            col: Number(col),
            severity: sev as "error" | "warning",
            message: msg!.trim(),
          });
        }
      }
      setProblems(parsed);
    } finally {
      setBusy(false);
    }
  };

  const relPath = (abs: string) => {
    if (!cwd || !abs.startsWith(cwd)) return abs;
    return abs.slice(cwd.length).replace(/^[\\/]+/, "");
  };

  const errors = problems.filter((p) => p.severity === "error");
  const warnings = problems.filter((p) => p.severity === "warning");

  return (
    <div className="problems-wrap">
      {!ran ? (
        <div className="prob-empty">
          <div style={{ marginBottom: 8 }}>
            <IconAlertCircle style={{ width: 28, height: 28, opacity: 0.25, margin: "0 auto 8px" }} />
          </div>
          <div style={{ fontSize: 12, marginBottom: 10, color: "var(--muted)" }}>
            {cwd ? "Scan the project for TypeScript errors and warnings." : "Open a folder to detect problems."}
          </div>
          {cwd && (
            <button className="settings-btn primary" onClick={() => void scan()} style={{ margin: "0 auto" }}>
              <IconSearch style={{ width: 12, height: 12 }} /> Run Diagnostics
            </button>
          )}
        </div>
      ) : busy ? (
        <div className="prob-empty">
          <IconRefresh style={{ width: 20, height: 20, opacity: 0.5, margin: "0 auto 8px" }} />
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Running tsc --noEmit…</div>
        </div>
      ) : problems.length === 0 ? (
        <div className="prob-empty">
          <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
          <div style={{ fontSize: 12, color: "var(--ok)" }}>No problems detected</div>
          <button className="settings-btn" style={{ marginTop: 10 }} onClick={() => void scan()}>
            <IconRefresh style={{ width: 12, height: 12 }} /> Rescan
          </button>
        </div>
      ) : (
        <>
          <div className="prob-summary">
            <span><IconAlertCircle style={{ width: 12, height: 12, color: "var(--bad)" }} /> {errors.length} error{errors.length !== 1 ? "s" : ""}</span>
            <span><IconAlertTriangle style={{ width: 12, height: 12, color: "var(--warn)" }} /> {warnings.length} warning{warnings.length !== 1 ? "s" : ""}</span>
            <span style={{ flex: 1 }} />
            <button className="search-act-btn" title="Rescan" onClick={() => void scan()}><IconRefresh /></button>
            <button className="search-act-btn" title="Clear" onClick={() => setProblems([])}><IconClose /></button>
          </div>
          <div className="prob-list">
            {problems.map((prob, i) => (
              <div
                key={i}
                className={`prob-item ${prob.severity === "error" ? "err" : "warn"}`}
                onClick={() => onOpenFile(prob.file.startsWith("/") || /^[A-Za-z]:/.test(prob.file) ? prob.file : `${cwd}/${prob.file}`, prob.line)}
              >
                {prob.severity === "error"
                  ? <IconAlertCircle style={{ width: 13, height: 13, color: "var(--bad)", flexShrink: 0 }} />
                  : <IconAlertTriangle style={{ width: 13, height: 13, color: "var(--warn)", flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="prob-msg">{prob.message}</div>
                  <div className="prob-where">{relPath(prob.file)} [{prob.line}:{prob.col}]</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OutputPanel({ lines }: { lines: string[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines.length]);
  return (
    <div className="output-wrap" ref={scrollRef}>
      {lines.length === 0 ? (
        <pre className="output-log muted">No output yet. Ask the AI to build or run the project.</pre>
      ) : (
        lines.map((l, i) => <div key={i} className="output-line">{l}</div>)
      )}
    </div>
  );
}

function DebugConsolePanel() {
  return (
    <div className="problems-wrap">
      <div className="prob-empty">
        <IconBug style={{ width: 28, height: 28, opacity: 0.25, margin: "0 auto 10px" }} />
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>No active debug session</div>
        <div style={{ fontSize: 11, color: "var(--faint)" }}>
          Ask the AI to create a <code style={{ background: "var(--elev2)", padding: "0 4px", borderRadius: 3 }}>launch.json</code> or use the Terminal to run your app.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Quick Open (Ctrl+P)
// ============================================================================
function QuickOpen({
  open,
  onClose,
  p,
  onOpenFile,
}: {
  open: boolean;
  onClose: () => void;
  p: IDEProps;
  onOpenFile: (path: string) => void;
}) {
  const [q, setQ] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    setFiles([]);
    setTimeout(() => inputRef.current?.focus(), 0);
    if (p.cwd) {
      void (async () => {
        const all = await window.api!.allFiles(p.cwd!);
        setFiles(all.slice(0, 2000));
      })();
    }
  }, [open, p.cwd]);

  const relPath = (abs: string) => {
    if (!p.cwd) return abs;
    if (!abs.startsWith(p.cwd)) return abs;
    return abs.slice(p.cwd.length).replace(/^[\\/]+/, "");
  };

  const isCommand = q.startsWith(">");

  const filtered = useMemo(() => {
    const query = isCommand ? q.slice(1).trim().toLowerCase() : q.trim().toLowerCase();
    if (!query) return files.slice(0, 50);
    return files
      .filter((f) => {
        const name = f.toLowerCase();
        const parts = query.split(/\s+/).filter(Boolean);
        return parts.every((part) => name.includes(part));
      })
      .slice(0, 200);
  }, [files, q, isCommand]);

  const commands = useMemo(() => {
    if (!isCommand) return [] as Array<{ id: string; label: string; run: () => void }>;
    const q2 = q.slice(1).trim().toLowerCase();
    const list = [
      { id: "toggleTerminal", label: "View: Toggle Terminal", run: () => {} },
      { id: "settings", label: "Preferences: Open Settings", run: () => p.onToggleSettings() },
      { id: "folder", label: "File: Open Folder", run: () => p.onChooseFolder() },
      { id: "saveAll", label: "File: Save All", run: () => {} },
      { id: "closeAll", label: "View: Close All Editors", run: () => p.onCloseAllTabs() },
      { id: "refresh", label: "Developer: Refresh Explorer", run: () => p.refreshTree() },
    ];
    return list.filter((x) => !q2 || x.label.toLowerCase().includes(q2));
  }, [isCommand, q, p]);

  const display = isCommand ? commands.map((c) => ({ id: c.id, name: c.label, path: "", raw: "cmd" as const, run: c.run })) : filtered.map((f) => {
    const rp = relPath(f);
    const name = rp.split(/[\\/]/).pop() || f;
    return { id: f, name, path: rp === name ? "" : rp.slice(0, -name.length - 1), raw: "file" as const, full: f };
  });

  const mark = (s: string) => {
    if (!q.trim() || isCommand) return s;
    const parts = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return s;
    const low = s.toLowerCase();
    const masks = new Array(s.length).fill(false);
    for (const part of parts) {
      let idx = 0;
      while ((idx = low.indexOf(part, idx)) !== -1) {
        for (let k = idx; k < idx + part.length; k++) masks[k] = true;
        idx += part.length;
      }
    }
    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < s.length) {
      let j = i;
      while (j < s.length && masks[j] === masks[i]) j++;
      const seg = s.slice(i, j);
      out.push(masks[i] ? <mark key={`${i}-${j}`}>{seg}</mark> : seg);
      i = j;
    }
    return <>{out}</>;
  };

  const activate = (i: number) => {
    const it = display[i];
    if (!it) return;
    onClose();
    if (it.raw === "file") onOpenFile((it as { full: string }).full);
    else (it as { run: () => void }).run();
  };

  if (!open) return null;
  return (
    <div className="quick-open-mask" onClick={onClose}>
      <div className="quick-open-box" onClick={(e) => e.stopPropagation()}>
        <div className="quick-open-input-row">
          <IconSearch />
          <input
            ref={inputRef}
            placeholder={isCommand ? "Type a command…" : "Search files by name. Type > for commands."}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, Math.max(0, display.length - 1))); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); activate(sel); }
            }}
          />
          <span className="quick-open-hint">{isCommand ? "CMD" : "Ctrl+P"}</span>
        </div>
        <div className="quick-open-list" ref={listRef}>
          {display.length === 0 && <div className="search-empty" style={{ padding: 20 }}>{isCommand ? "No commands" : "No matching files"}</div>}
          {display.map((it, i) => (
            <div
              key={it.id}
              className={`quick-open-item ${i === sel ? "sel" : ""}`}
              onClick={() => activate(i)}
              onMouseEnter={() => setSel(i)}
            >
              {it.raw === "file" ? <IconFile className="qi-ico" /> : <IconTerminal className="qi-ico" />}
              <span className="qi-name">{mark(it.name)}</span>
              {it.path ? <span className="qi-path">{it.path}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// IDELayout
// ============================================================================
export function IDELayout(p: IDEProps) {
  const active = p.tabs.find((t) => t.id === p.activeTab) ?? p.tabs[0];
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const mentionActiveRef = p.mentionActiveRef;
  const [cursor, setCursor] = useState({ line: 1, col: 1, totalLines: 1, selChars: 0 });
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoVal, setGotoVal] = useState("");

  const [collapseChat, setCollapseChat] = useState(false);
  const [collapseActivity, setCollapseActivity] = useState(false);
  const [collapseSide, setCollapseSide] = useState(false);
  const [explorerW, setExplorerW] = useState<number>(() => Number(localStorage.getItem("ide-exp-w")) || 280);
  const [chatW, setChatW] = useState<number>(() => Number(localStorage.getItem("ide-chat-w")) || 420);
  const [termH, setTermH] = useState<number>(() => Number(localStorage.getItem("ide-term-h")) || 240);
  const [bottomOpen, setBottomOpen] = useState<boolean>(() => localStorage.getItem("ide-bottom-open") === "1");
  const [bottomView, setBottomView] = useState<BottomView>("terminal");
  const [sideView, setSideView] = useState<SideView>("explorer");

  useEffect(() => localStorage.setItem("ide-exp-w", String(explorerW)), [explorerW]);
  useEffect(() => localStorage.setItem("ide-chat-w", String(chatW)), [chatW]);
  useEffect(() => localStorage.setItem("ide-term-h", String(termH)), [termH]);
  useEffect(() => localStorage.setItem("ide-bottom-open", bottomOpen ? "1" : "0"), [bottomOpen]);

  // Context menu states
  const [treeCtx, setTreeCtx] = useState<{ pos: { x: number; y: number }; path: string; isDir: boolean } | null>(null);
  const [tabCtx, setTabCtx] = useState<{ pos: { x: number; y: number }; id: string } | null>(null);
  const [headerCtx, setHeaderCtx] = useState<{ pos: { x: number; y: number } } | null>(null);
  // New inline inputs in explorer
  const [newInline, setNewInline] = useState<{ atDir: string; kind: "file" | "folder" } | null>(null);
  const [newInlineName, setNewInlineName] = useState("");
  // Rename inline input
  const [renameInline, setRenameInline] = useState<{ path: string; oldName: string; isDir: boolean } | null>(null);
  const [renameName, setRenameName] = useState("");

  const [recentClosed, setRecentClosed] = useState<Tab[]>([]);

  // Terminal state
  const [terms, setTerms] = useState<TermInstance[]>([]);
  const [activeTerm, setActiveTerm] = useState<number>(1);
  // xterm-based terminal instances for bottom dock (keyed by id, reuse TerminalPane)
  const [xtermIds, setXtermIds] = useState<number[]>([1]);
  const [activeXterm, setActiveXterm] = useState<number>(1);
  const xtermNextId = useRef(2);
  // Output panel lines (populated by AI tool calls / build output)
  const [outputLines, setOutputLines] = useState<string[]>([]);

  // Quick Open
  const [quickOpen, setQuickOpen] = useState(false);

  const relPath = (abs: string) => {
    if (!p.cwd) return abs;
    if (!abs.startsWith(p.cwd)) return abs;
    return abs.slice(p.cwd.length).replace(/^[\\/]+/, "");
  };
  const fileCtx = active ? relPath(active.path ?? "") : "";

  // Parse messages to extract file information
  const parsedMessages = useMessageParser(p.messages);

  // Keyboard shortcuts IDE-level
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g" && !e.shiftKey) {
        e.preventDefault();
        setGotoVal(String(cursor.line));
        setGotoOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p" && !e.shiftKey && !inField) {
        e.preventDefault();
        setQuickOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f" && !inField) {
        e.preventDefault();
        setSideView("search");
        setCollapseSide(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        p.onToggleSettings();
      }
      if (e.key === "`" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          setBottomOpen(true);
          setBottomView("terminal");
          setTerms((old) => {
            if (old.length === 0) return old;
            return old;
          });
        } else {
          setBottomOpen((v) => !v);
          setBottomView("terminal");
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !inField) {
        e.preventDefault();
        setCollapseSide((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "g" && !inField) {
        e.preventDefault();
        setSideView("git");
        setCollapseSide(false);
      }
      if (e.key === "Escape") {
        if (gotoOpen) setGotoOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.line, gotoOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [p.messages, p.busy]);

  // When active tab changes -> inject @mention in chat
  const didInjectRef = useRef<string>("");
  useEffect(() => {
    if (!active || !fileCtx) return;
    if (didInjectRef.current === active.id) return;
    didInjectRef.current = active.id;
    const placeholder = `@${fileCtx} `;
    if (!p.input) {
      p.onInputChange(placeholder);
      return;
    }
    if (!p.input.includes(`@${fileCtx}`)) {
      if (p.input.endsWith(" ")) p.onInputChange(p.input + `@${fileCtx} `);
      else p.onInputChange(p.input + ` @${fileCtx} `);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Parse SCM status map (single-letter) into sections
  const scmSections = useMemo(() => {
    const staged: Record<string, string> = {};
    const unstaged: Record<string, string> = {};
    const modified: string[] = [];
    const untracked: string[] = [];
    const fullPaths: Record<string, string> = {};
    // p.status has relative paths with single-char codes. Build absolute paths.
    for (const [rel, code] of Object.entries(p.status ?? {})) {
      const abs = p.cwd ? join(p.cwd, rel) : rel;
      fullPaths[abs] = code;
      if (code === "??") untracked.push(abs);
      else if (code === "M") modified.push(abs);
      else if (code.startsWith("M")) unstaged[abs] = code;
      else {
        // default: assume modified if unknown code (matches badge color mapping)
        modified.push(abs);
      }
    }
    return { staged, unstaged, modified, untracked };
  }, [p.status, p.cwd]);

  const sideBadges: Record<SideView, number> = {
    explorer: 0,
    search: 0,
    git: typeof p.changes === "number" ? p.changes : Object.keys(scmSections.modified).length + Object.keys(scmSections.unstaged).length + Object.keys(scmSections.staged).length,
    debug: 0,
    extensions: 0,
  };

  // Drag resize handlers
  const drag = (
    setV: (n: number) => void,
    axis: "x" | "y",
    min: number,
    max: number,
    dir: 1 | -1 = 1,
    getStartV: () => number,
  ) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const start = axis === "x" ? e.clientX : e.clientY;
      const startV = getStartV();
      const move = (ev: MouseEvent) => {
        const delta = (axis === "x" ? ev.clientX : ev.clientY) - start;
        const next = Math.max(min, Math.min(max, startV + delta * dir));
        setV(next);
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };
  };

  // Explorer actions
  const confirmDelete = async (path: string) => {
    const ok = window.confirm(`Delete ${relPath(path) || path}? This cannot be undone.`);
    if (!ok) return;
    const res = await window.api!.deletePath(path);
    if (!res.ok) alert(res.error);
    p.refreshTree();
  };

  const doCreate = async (atDir: string, kind: "file" | "folder", name: string) => {
    if (!name.trim()) return;
    const full = join(atDir, name);
    const r =
      kind === "file"
        ? await window.api!.createFile(full, "")
        : await window.api!.createDir(full);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    p.refreshTree();
    if (kind === "file") p.onOpenFile(full);
  };

  const doRename = async (oldPath: string, newName: string) => {
    if (!newName.trim()) return;
    const base = oldPath.split(/[\\/]/).slice(0, -1).join("/");
    const newPath = join(base || "/", newName);
    const r = await window.api!.renamePath(oldPath, newPath);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    p.refreshTree();
  };

  const doDuplicate = async (path: string) => {
    const r = await window.api!.duplicatePath(path);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    p.refreshTree();
    if (r.newPath && !r.newPath.match(/[\\/]$/)) p.onOpenFile(r.newPath);
  };

  const openFileGoLine = (path: string, line?: number) => {
    p.onOpenFile(path);
    if (line && line > 0) {
      setTimeout(() => editorRef.current?.gotoLine(line), 150);
    }
  };

  const rootClass = [
    "ide-root",
    collapseChat ? "collapsed-chat" : "",
    collapseActivity ? "collapsed-activity" : "",
    collapseSide ? "collapsed-side" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={rootClass}
      style={{
        ["--act-w" as string]: collapseActivity ? "0px" : "52px",
        ["--side-w" as string]: collapseSide ? "0px" : `${explorerW}px`,
        ["--chat-w" as string]: collapseChat ? "0px" : `${chatW}px`,
        ["--term-h" as string]: `${termH}px`,
      } as React.CSSProperties}
    >

      {/* ======= TITLE BAR ======= */}
      <header className="ide-titlebar">
        <div className="ide-tb-left">
          <div
            className="mode-switch-wrap"
            title={`Switch to Desktop Mode (Ctrl+Alt+])`}
            onContextMenu={(e) => {
              e.preventDefault();
              setHeaderCtx({ pos: { x: e.clientX, y: e.clientY } });
            }}
          >
            <button
              className={`mode-seg ${p.mode === "ide" ? "active" : ""}`}
              onClick={() => p.mode !== "ide" && p.onToggleMode()}
            >
              <IconIDE />
              <span>IDE</span>
            </button>
            <button
              className={`mode-seg ${p.mode === "desktop" ? "active" : ""}`}
              onClick={() => p.mode !== "desktop" && p.onToggleMode()}
            >
              <IconDesktop />
              <span>Desktop</span>
            </button>
          </div>
          <button className="icon sm" title="Toggle Activity Bar" onClick={() => setCollapseActivity((v) => !v)}>
            <IconPanelLeft />
          </button>
          <button className="icon sm" title={p.t("nav.openFolder")} onClick={() => p.onChooseFolder()}>
            <IconFolder />
          </button>
          <div className="ide-breadcrumbs">
            {p.cwd ? (
              <>
                <span className="chip sm" title={p.cwd}>
                  <IconFolder />
                  <span className="ide-proj">{p.projectName || relPath(p.cwd) || "Project"}</span>
                </span>
                {active && fileCtx
                  ? fileCtx.split(/[\\/]/).map((seg, i, arr) => (
                      <span key={i} className="bc-seg-wrap">
                        <span className="sep">›</span>
                        <span
                          className={`bc-seg ${i === arr.length - 1 ? "active" : ""}`}
                          title={seg}
                        >
                          {i === arr.length - 1 ? (
                            <>
                              <IconFile /> {seg}
                              {active.dirty ? <span className="dirty-tiny" /> : null}
                            </>
                          ) : (
                            <>{seg}</>
                          )}
                        </span>
                      </span>
                    ))
                  : null}
              </>
            ) : (
              <span className="muted">No folder open — open one to start.</span>
            )}
          </div>
        </div>
        <div className="ide-tb-right">
          {active?.dirty ? <span className="dirty-dot" title="Unsaved changes" /> : null}
          <button className="icon sm" title="Find in file (Ctrl+F)" onClick={() => editorRef.current?.find()}>
            <IconSearch />
          </button>
          <button className="icon sm" title={`Ln ${cursor.line}:${cursor.col} (Ctrl+G)`} onClick={() => { setGotoVal(String(cursor.line)); setGotoOpen(true); }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "0 2px" }}>{cursor.line}:{cursor.col}</span>
          </button>
          <button
            className={`icon sm ${bottomOpen ? "active" : ""}`}
            title="Toggle Panel (Ctrl+`)"
            onClick={() => setBottomOpen((v) => !v)}
          >
            <IconPanelBottom />
          </button>
          <button className="icon sm" title="Split Editor Right" onClick={() => {}}>
            <IconSplitH />
          </button>
          <button className="icon sm" title="Settings" onClick={() => p.onToggleSettings()}>
            <IconSettings />
          </button>
        </div>
      </header>

      {/* ======= MAIN LAYOUT GRID ======= */}
      <div className="ide-body">
        {/* 1) ACTIVITY BAR */}
        {!collapseActivity ? (
          <aside className="ide-activity" role="tablist" aria-label="Activity Bar">
            <div className="ab-top">
              <button
                role="tab"
                aria-selected={sideView === "explorer" && !collapseSide}
                className={`ab-btn ${sideView === "explorer" && !collapseSide ? "active" : ""}`}
                title="Explorer (Ctrl+Shift+E)"
                onClick={() => {
                  if (sideView === "explorer") setCollapseSide((v) => !v);
                  else { setSideView("explorer"); setCollapseSide(false); }
                }}
              >
                <IconLayers />
              </button>
              <button
                role="tab"
                aria-selected={sideView === "search" && !collapseSide}
                className={`ab-btn ${sideView === "search" && !collapseSide ? "active" : ""}`}
                title="Search (Ctrl+Shift+F)"
                onClick={() => {
                  if (sideView === "search") setCollapseSide((v) => !v);
                  else { setSideView("search"); setCollapseSide(false); }
                }}
              >
                <IconSearch />
              </button>
              <button
                role="tab"
                aria-selected={sideView === "git" && !collapseSide}
                className={`ab-btn ${sideView === "git" && !collapseSide ? "active" : ""}`}
                title="Source Control (Ctrl+Shift+G)"
                onClick={() => {
                  if (sideView === "git") setCollapseSide((v) => !v);
                  else { setSideView("git"); setCollapseSide(false); }
                }}
              >
                <IconGitBranch />
                {sideBadges.git > 0 ? <span className="ab-badge">{sideBadges.git}</span> : null}
              </button>
              <button
                role="tab"
                aria-selected={sideView === "debug" && !collapseSide}
                className={`ab-btn ${sideView === "debug" && !collapseSide ? "active" : ""}`}
                title="Run and Debug"
                onClick={() => {
                  if (sideView === "debug") setCollapseSide((v) => !v);
                  else { setSideView("debug"); setCollapseSide(false); }
                }}
              >
                <IconPlay />
              </button>
              <button
                role="tab"
                aria-selected={sideView === "extensions" && !collapseSide}
                className={`ab-btn ${sideView === "extensions" && !collapseSide ? "active" : ""}`}
                title="Extensions"
                onClick={() => {
                  if (sideView === "extensions") setCollapseSide((v) => !v);
                  else { setSideView("extensions"); setCollapseSide(false); }
                }}
              >
                <IconBox />
              </button>
            </div>
            <div className="ab-bottom">
              <button className="ab-btn" title="Toggle Panel (Ctrl+`)" onClick={() => setBottomOpen((v) => !v)}>
                <IconPanelBottom />
              </button>
              <button
                className="ab-btn"
                title="Account / Preferences"
                onClick={() => p.onToggleSettings()}
              >
                <IconSettings />
              </button>
            </div>
          </aside>
        ) : null}

        {/* Drag handle: Activity ↔ Side (not really needed) */}

        {/* 2) SIDE PANEL (Explorer / Search / SCM / Debug / Extensions) */}
        {!collapseSide ? (
          <aside className="ide-side" style={{ minWidth: explorerW, width: explorerW, maxWidth: explorerW }}>
            <div className="ide-side-head">
              <div className="side-head-row">
                <span className="eyebrow">{
                  sideView === "explorer" ? "Explorer" :
                  sideView === "search" ? "Search" :
                  sideView === "git" ? "Source Control" :
                  sideView === "debug" ? "Run & Debug" :
                  "Extensions"
                }</span>
                <div className="side-actions">
                  {sideView === "explorer" ? (
                    <>
                      <button
                        className="icon xs"
                        title="New File"
                        onClick={() => {
                          setNewInline({ atDir: p.cwd ?? "/", kind: "file" });
                          setNewInlineName("");
                        }}
                      >
                        <IconUntitled />
                      </button>
                      <button
                        className="icon xs"
                        title="New Folder"
                        onClick={() => {
                          setNewInline({ atDir: p.cwd ?? "/", kind: "folder" });
                          setNewInlineName("");
                        }}
                      >
                        <IconFolderNew />
                      </button>
                      <button
                        className="icon xs"
                        title="Refresh Explorer"
                        onClick={() => p.refreshTree()}
                      >
                        <IconRefresh />
                      </button>
                      <button
                        className="icon xs"
                        title="Collapse Folders"
                        onClick={() => {
                          document
                            .querySelectorAll<HTMLElement>(".tree-node.caret.expanded")
                            .forEach((el) => el.click());
                        }}
                      >
                        <IconCollapse />
                      </button>
                    </>
                  ) : sideView === "git" ? (
                    <>
                      <button className="icon xs" title="Refresh" onClick={() => p.refreshTree()}>
                        <IconRefresh />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="side-subhead muted">
                {sideView === "explorer"
                  ? (p.projectName || (p.cwd ? relPath(p.cwd) : "—"))
                  : sideView === "git"
                    ? `Changes: ${p.changes || 0}`
                    : sideView === "search"
                      ? "Across open project"
                      : p.projectName || "—"}
              </div>
            </div>

            {/* SIDE VIEW BODY */}
            {sideView === "explorer" ? (
              <>
                <div className="ft-scroll">
                  {newInline ? (
                    <div className="inline-editor">
                      <IconFile style={{ opacity: 0.5 }} />
                      <input
                        autoFocus
                        value={newInlineName}
                        placeholder={newInline.kind === "file" ? "new-file.ts" : "new-folder"}
                        onChange={(e) => setNewInlineName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void doCreate(newInline.atDir, newInline.kind, newInlineName);
                            setNewInline(null);
                          } else if (e.key === "Escape") {
                            setNewInline(null);
                          }
                        }}
                        onBlur={() => {
                          if (newInlineName) void doCreate(newInline.atDir, newInline.kind, newInlineName);
                          setNewInline(null);
                        }}
                      />
                    </div>
                  ) : null}
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTreeCtx({ pos: { x: e.clientX, y: e.clientY }, path: p.cwd ?? "/", isDir: true });
                    }}
                    onClick={() => {
                      setTreeCtx(null);
                    }}
                  >
                    <FileTree
                      root={p.cwd}
                      status={p.status}
                      onOpen={p.onOpenFile}
                      onContextMenu={(path, isDir, e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTreeCtx({ pos: { x: e.clientX, y: e.clientY }, path, isDir });
                      }}
                      onInlineRename={(path, isDir) => {
                        const oldName = path.split(/[\\/]/).pop() ?? "";
                        setRenameName(oldName);
                        setRenameInline({ path, oldName, isDir });
                      }}
                      inlineRename={renameInline}
                      renameName={renameName}
                      onRenameCommit={(path, newName) => {
                        void doRename(path, newName);
                        setRenameInline(null);
                      }}
                      onRenameCancel={() => setRenameInline(null)}
                    />
                  </div>
                </div>
                <div className="explorer-foot muted">{p.changes ? <>{p.changes} changes</> : null}</div>
              </>
            ) : sideView === "search" ? (
              <SearchPanel p={p} onOpenFile={openFileGoLine} />
            ) : sideView === "git" ? (
              <SourceControlPanel
                p={p}
                staged={scmSections.staged}
                unstaged={scmSections.unstaged}
                untracked={scmSections.untracked}
                modified={scmSections.modified}
                onOpenFile={p.onOpenFile}
              />
            ) : sideView === "debug" ? (
              <div className="ft-scroll">
                <div className="search-empty" style={{ padding: 40 }}>
                  <IconBug style={{ width: 42, height: 42, opacity: 0.35, marginBottom: 10 }} />
                  <div style={{ fontSize: 13, marginBottom: 4 }}>No launch configuration</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    Ask the AI to create a launch.json or run tasks via the Terminal.
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <button className="chip" onClick={() => { setBottomOpen(true); setBottomView("terminal"); }}>
                      <IconPlay /> Open Terminal
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="ft-scroll">
                <div className="search-empty" style={{ padding: 40 }}>
                  <IconPuzzle style={{ width: 42, height: 42, opacity: 0.35, marginBottom: 10 }} />
                  <div style={{ fontSize: 13, marginBottom: 4 }}>Extensions coming soon</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    TermCoder comes with AI built-in — use the Assistant panel on the right to install or manage tooling.
                  </div>
                </div>
              </div>
            )}
            {/* Drag handle: Side ↔ Center */}
            {!collapseSide ? (
              <div
                className="drag-handle left-handle"
                onMouseDown={drag(setExplorerW, "x", 180, 480, -1, () => explorerW)}
                onDoubleClick={() => setExplorerW(280)}
                title="Drag to resize. Double-click to reset."
              />
            ) : null}
          </aside>
        ) : null}

        {/* 3) CENTER (tabs + editor + [optional] bottom dock) */}
        <main className="ide-center" style={{ position: "relative", minWidth: 0 }}>
          {/* TABS */}
          <div className="ide-tabs">
            {(collapseActivity && collapseSide) ? (
              <button className="icon sm toggle-explorer" title="Toggle Side Panel" onClick={() => setCollapseSide(false)}>
                <IconPanelLeft />
              </button>
            ) : null}
            {p.tabs.length === 0 ? (
              <div className="ide-tabs-empty muted">
                No open tabs. Click files on the left, use Ctrl+P, or ask the assistant on the right.
              </div>
            ) : (
              <>
                {p.tabs.map((tt) => (
                  <div
                    key={tt.id}
                    className={`ide-tab ${tt.id === p.activeTab ? "active" : ""}`}
                    onClick={() => p.onActivateTab(tt.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setTabCtx({ pos: { x: e.clientX, y: e.clientY }, id: tt.id });
                    }}
                    title={`${tt.path ?? tt.name}${tt.dirty ? " • (unsaved)" : ""}`}
                  >
                    <span className="ide-tab-name">
                      {tt.kind === "diff" ? <IconGitDiff style={{ width: 12, height: 12, marginRight: 4, opacity: 0.7 }} /> : null}
                      {tt.name}
                      {tt.dirty ? " •" : ""}
                    </span>
                    <button
                      className="ide-tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        p.onCloseTab(tt.id);
                      }}
                    >
                      <IconClose />
                    </button>
                  </div>
                ))}
                {recentClosed.length ? (
                  <button
                    className="icon sm tab-reopen"
                    title="Reopen closed tab (Ctrl+Shift+T)"
                    onClick={() => {
                      const last = recentClosed[recentClosed.length - 1];
                      if (last) {
                        setRecentClosed((r) => r.slice(0, -1));
                        if (last.path) p.onOpenFile(last.path);
                      }
                    }}
                  >
                    <IconChevronDown style={{ transform: "rotate(180deg)" }} />
                  </button>
                ) : null}
              </>
            )}
            <div className="ide-tabs-spacer" />
            <button
              className={`icon sm ${bottomOpen ? "" : ""}`}
              title="Toggle Terminal Panel (Ctrl+`)"
              onClick={() => { setBottomOpen((v) => !v); setBottomView("terminal"); }}
            >
              <IconTerminal />
            </button>
            <button className="icon sm toggle-chat" title="Toggle Assistant Chat" onClick={() => setCollapseChat((v) => !v)}>
              {collapseChat ? <IconChat /> : <IconChevronRight />}
            </button>
          </div>

          {/* EDITOR AREA + BOTTOM DOCK */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", minWidth: 0 }}>
            {/* EDITOR WRAP (takes remaining when bottom dock collapses) */}
            <div className="ide-editor-wrap">
              {active ? (
                active.kind === "file" ? (
                  <div className="ide-editor-pane">
                    <div className="ide-editor-bar">
                      <div className="breadcrumbs-sm muted">
                        <span>{active.path ?? active.name}</span>
                      </div>
                      <div className="editor-actions">
                        <button className="settings-btn" onClick={() => editorRef.current?.find()} title="Find (Ctrl+F)">
                          <IconSearch />
                        </button>
                        <button className="settings-btn" onClick={() => editorRef.current?.replace()} title="Replace (Ctrl+H)">
                          <IconEdit />
                        </button>
                        <button className="settings-btn" onClick={() => editorRef.current?.toggleComment()} title="Toggle Comment (Ctrl+/)">
                          <IconComment />
                        </button>
                        <button className="settings-btn" onClick={() => editorRef.current?.format()} title="Format Document (Shift+Alt+F)">
                          <IconWand />
                        </button>
                        <button className="settings-btn" onClick={() => p.onAskAIAboutTab(active)} title="Ask AI about this file">
                          <IconChat />
                        </button>
                        <div className="editor-actions-sep" />
                        <button
                          className={`editor-save-pill ${active.dirty ? "" : "saved"}`}
                          disabled={!active.dirty}
                          onClick={() => p.onSaveTab(active.id)}
                          title="Save (Ctrl+S)"
                        >
                          {active.dirty ? <><IconSave />{p.t("editor.save")}</> : p.t("editor.saved")}
                        </button>
                      </div>
                    </div>
                    <CodeEditor
                      key={active.id + ":" + p.codeTheme + ":" + p.wordWrap}
                      name={active.name}
                      value={active.content}
                      onChange={(v) => p.onEditTab(active.id, v)}
                      onSave={() => p.onSaveTab(active.id)}
                      port={p.port}
                      aiSuggest={false}
                      theme={p.codeTheme}
                      wordWrap={p.wordWrap}
                      handle={editorRef}
                      onCursorChange={setCursor}
                    />
                  </div>
                ) : (
                  <div className="ide-editor-pane">
                    <div className="ide-editor-bar">
                      <span className="editor-path">{active.path ?? active.name}</span>
                    </div>
                    <pre className="viewer-body diff">{active.content}</pre>
                  </div>
                )
              ) : (
                <div className="ide-empty-state">
                  <div className="ide-empty-art">
                    <IconIDE />
                  </div>
                  <h3>Welcome to IDE Mode</h3>
                  <p className="muted" style={{ maxWidth: 620 }}>
                    Browse files on the left, edit in the center, use the right panel to chat with the agent. It
                    will see the active file and project context automatically.
                  </p>
                  <div className="ide-empty-hints">
                    <button className="chip" onClick={() => p.onChooseFolder()}>
                      <IconFolder /> Open a project folder
                    </button>
                    <button className="chip" onClick={() => setQuickOpen(true)}>
                      <IconSearch /> Quick Open (Ctrl+P)
                    </button>
                    {fileCtx ? (
                      <button
                        className="chip"
                        onClick={() => {
                          p.onInputChange(`@${fileCtx} Explain what this file does and look for bugs.`);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                      >
                        <IconChat /> Ask about {(active as unknown as Tab | null)?.name ?? ""}
                      </button>
                    ) : null}
                    <button className="chip" onClick={() => { setBottomOpen(true); setBottomView("terminal"); }}>
                      <IconTerminal /> Open Terminal
                    </button>
                  </div>
                  <div className="ide-actions-grid">
                    <div className="ide-action-card iac" onClick={() => editorRef.current?.find()}>
                      <div className="iac-ico">
                        <IconSearch />
                      </div>
                      <div className="iac-text">
                        <div className="iac-title">Find in File</div>
                        <div className="iac-short">Ctrl / ⌘ + F</div>
                      </div>
                    </div>
                    <div
                      className="ide-action-card iac"
                      onClick={() => { setGotoVal(String(cursor.line)); setGotoOpen(true); }}
                    >
                      <div className="iac-ico">
                        <IconMaximize />
                      </div>
                      <div className="iac-text">
                        <div className="iac-title">Go to Line</div>
                        <div className="iac-short">Ctrl / ⌘ + G</div>
                      </div>
                    </div>
                    <div className="ide-action-card iac">
                      <div className="iac-ico">
                        <IconCopy />
                      </div>
                      <div className="iac-text">
                        <div className="iac-title">Duplicate Line</div>
                        <div className="iac-short">Shift+Alt+↓</div>
                      </div>
                    </div>
                    <div
                      className="ide-action-card iac"
                      onClick={() => { setSideView("search"); setCollapseSide(false); }}
                    >
                      <div className="iac-ico">
                        <IconGitDiff />
                      </div>
                      <div className="iac-text">
                        <div className="iac-title">Search Project</div>
                        <div className="iac-short">Ctrl+Shift+F</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* STATUS BAR */}
            <div className="ide-statusbar">
              <div className="sb-left">
                <button
                  className="sb-item"
                  title="Source Control — click to open"
                  onClick={() => { setSideView("git"); setCollapseSide(false); }}
                >
                  <span className="sb-dot main" />
                  <IconGitBranch style={{ width: 12, height: 12 }} />
                  <span style={{ marginLeft: 4 }}>main</span>
                  {(p.changes || 0) > 0 ? <span style={{ marginLeft: 4, opacity: 0.9 }}>⇅ {p.changes}</span> : null}
                </button>
                <button className="sb-item clickable" title="Problems Panel" onClick={() => { setBottomOpen(true); setBottomView("problems"); }}>
                  <IconAlertCircle style={{ color: "var(--bad)", width: 12, height: 12 }} />
                  <span style={{ marginLeft: 2 }}>0</span>
                  <IconAlertTriangle style={{ color: "#f5a524", width: 12, height: 12, marginLeft: 8 }} />
                  <span style={{ marginLeft: 2 }}>0</span>
                </button>
                <span className="sb-sep" />
                <button
                  className="sb-item clickable"
                  title="Go to line"
                  onClick={() => {
                    setGotoVal(String(cursor.line));
                    setGotoOpen(true);
                  }}
                >
                  Ln {cursor.line}, Col {cursor.col}
                </button>
                <span className="sb-item">Sel {cursor.selChars > 0 ? cursor.selChars + " ch" : cursor.totalLines + " lines"}</span>
              </div>
              <div className="sb-right">
                <span className="sb-item" title="Indentation">Spaces: 2</span>
                <button
                  className="sb-item clickable"
                  title="Toggle Word Wrap"
                  onClick={() => p.onToggleSettings()}
                >
                  <IconWrap /> {p.wordWrap ? "Wrap" : "No wrap"}
                </button>
                <span className="sb-item" title="End of line sequence">LF</span>
                <span className="sb-item" title="Encoding">UTF-8</span>
                <span className="sb-item" title={active?.name ?? "Plain text"}>
                  {active?.name?.split(".").pop()?.toUpperCase() ?? "Plain Text"}
                </span>
                <button className="sb-item clickable" title="Toggle Terminal" onClick={() => { setBottomOpen((v) => !v); setBottomView("terminal"); }}>
                  <IconTerminal /> Terminal
                </button>
              </div>
            </div>

            {/* Bottom Dock (below status bar, within center) */}
            {bottomOpen ? (
              <div
                className="ide-bottom-dock"
                style={{
                  height: termH,
                  maxHeight: "75vh",
                  position: "relative",
                }}
              >
                <div
                  className="drag-handle bottom-handle"
                  onMouseDown={drag(
                    setTermH,
                    "y",
                    80,
                    700,
                    -1,
                    () => termH,
                  )}
                  onDoubleClick={() => setTermH(240)}
                  title="Drag to resize. Double-click to reset."
                />
                <div className="ide-bottom-head">
                  <div className="ide-bottom-tabs">
                    {([
                      { id: "problems" as BottomView, label: "Problems", Icon: IconAlertCircle, count: 0 },
                      { id: "output" as BottomView, label: "Output", Icon: IconTerminal, count: outputLines.length || null },
                      { id: "debug" as BottomView, label: "Debug Console", Icon: IconBug, count: null },
                      { id: "terminal" as BottomView, label: "Terminal", Icon: IconTerminal, count: xtermIds.length > 1 ? xtermIds.length : null },
                    ] as const).map(({ id, label, Icon, count }) => (
                      <button
                        key={id}
                        className={`ide-bottom-tab ${bottomView === id ? "active" : ""}`}
                        onClick={() => setBottomView(id)}
                      >
                        <Icon />
                        <span>{label}</span>
                        {typeof count === "number" && count > 0 ? (
                          <span className="ide-bottom-tab-count" style={{ marginLeft: 6, fontSize: 10, background: "var(--elev2)", padding: "0 6px", borderRadius: 999, color: "var(--accent)" }}>
                            {count}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <div className="ide-bottom-spacer" />
                  <div className="ide-bottom-actions">
                    {bottomView === "terminal" ? (
                      <>
                        <button className="icon" title="New Terminal (Ctrl+Shift+`)" onClick={() => {
                          const id = xtermNextId.current++;
                          setXtermIds((old) => [...old, id]);
                          setActiveXterm(id);
                        }}>
                          <IconPlus />
                        </button>
                        <button className="icon" title="Kill Terminal" onClick={() => {
                          if (xtermIds.length <= 1) return;
                          const remaining = xtermIds.filter((x) => x !== activeXterm);
                          setXtermIds(remaining);
                          setActiveXterm(remaining[remaining.length - 1] ?? 1);
                        }}>
                          <IconClose />
                        </button>
                      </>
                    ) : bottomView === "output" ? (
                      <button className="icon" title="Clear Output" onClick={() => setOutputLines([])}>
                        <IconTrash />
                      </button>
                    ) : null}
                    <button className="icon" title="Close Panel" onClick={() => setBottomOpen(false)}>
                      <IconChevronsDown />
                    </button>
                  </div>
                </div>
                <div className="ide-bottom-body">
                  {bottomView === "terminal" ? (
                    <div className="xterm-dock">
                      {/* Terminal instance tabs (when more than one) */}
                      {xtermIds.length > 1 && (
                        <div className="xterm-instance-tabs">
                          {xtermIds.map((id) => (
                            <button
                              key={id}
                              className={`xterm-inst-tab ${id === activeXterm ? "active" : ""}`}
                              onClick={() => setActiveXterm(id)}
                            >
                              <IconTerminal style={{ width: 11, height: 11 }} />
                              <span>Shell {id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {xtermIds.map((id) => (
                        <TerminalPane
                          key={id}
                          id={id}
                          cwd={p.cwd}
                          hidden={id !== activeXterm}
                          themeKey={p.codeTheme}
                        />
                      ))}
                    </div>
                  ) : bottomView === "problems" ? (
                    <ProblemsPanel cwd={p.cwd} onOpenFile={openFileGoLine} />
                  ) : bottomView === "output" ? (
                    <OutputPanel lines={outputLines} />
                  ) : (
                    <DebugConsolePanel />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </main>

        {/* 4) RIGHT COLUMN: ASSISTANT CHAT (sempre no grid; collapsed mostra rail) */}
        <aside className="ide-right glass" style={{ minWidth: collapseChat ? 0 : chatW, width: collapseChat ? 0 : chatW, maxWidth: collapseChat ? 0 : chatW, overflow: collapseChat ? "visible" : "hidden" }}>
          {!collapseChat ? (
            <>
              <div className="ide-chat-head">
                <div className="ide-chat-title-row">
                  <span className="ide-chat-mark">
                    <IconIDE />
                  </span>
                  <span className="ide-chat-name">Assistant</span>
                  <div className="ide-chat-meta">
                    <span className={`dot ${p.busy ? "gen" : p.connected ? "on" : "off"}`} />
                    <span>{p.busy ? "Working…" : p.connected ? "Online" : "Connecting…"}</span>
                    {fileCtx ? (
                      <>
                        <span className="sep">·</span>
                        <code title={active?.path}>{fileCtx}</code>
                      </>
                    ) : null}
                  </div>
                  <button className="icon xs" title="Collapse chat" onClick={() => setCollapseChat(true)}>
                    <IconChevronRight />
                  </button>
                </div>
              </div>

              <div className="ide-chat-scroll" ref={scrollRef}>
                <div className="ide-chat-inner">
                  {p.messages.length === 0 ? (
                    <div className="ide-welcome">
                      <p className="muted">
                        Ask the agent to explore, edit, explain or fix. It can read files, run commands and modify
                        the codebase. The active file is automatically added as context.
                      </p>
                      <div className="ide-suggestions">
                        <button
                          className="suggest-chip"
                          onClick={() => {
                            p.onInputChange(
                              fileCtx
                                ? `@${fileCtx} Explain the structure and list potential issues.`
                                : `Show me an overview of this project (${p.projectName}).`,
                            );
                            setTimeout(() => inputRef.current?.focus(), 0);
                          }}
                        >
                          {fileCtx ? `Analyze ${active?.name}` : `Summarize project`}
                        </button>
                        <button
                          className="suggest-chip"
                          onClick={() => {
                            p.onInputChange(
                              `Look for errors in the project, try to build/lint and fix what you find.`,
                            );
                            setTimeout(() => inputRef.current?.focus(), 0);
                          }}
                        >
                          <IconAlertCircle style={{ width: 12, height: 12, opacity: 0.9 }} /> Find & fix errors
                        </button>
                        <button
                          className="suggest-chip"
                          onClick={() => {
                            setBottomOpen(true);
                            setBottomView("terminal");
                          }}
                        >
                          <IconTerminal style={{ width: 12, height: 12 }} /> Open Terminal
                        </button>
                        <button
                          className="suggest-chip"
                          onClick={() => {
                            void (active?.path
                              ? window.api?.revealPath(active.path)
                              : p.cwd && window.api?.revealPath(p.cwd, false));
                          }}
                        >
                          📂 Reveal in folder
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {parsedMessages.map((parsed, i) => {
                    const m = parsed.original;
                    return (
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
                          p.busy && i === p.messages.length - 1 ? (
                            <div className="bubble assistant streaming">{m.text}</div>
                          ) : (
                            <div className="assistant-wrap">
                              <div className="msg-meta">
                                <span className="msg-spine" />
                                termcoder
                              </div>
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
                              {parsed.files.length > 0 && (
                                <div className="msg-files">
                                  <div className="msg-files-header">
                                    <span>📁 Files referenced</span>
                                    <span className="msg-files-count">{parsed.files.length}</span>
                                  </div>
                                  {parsed.files.map((file, fi) => (
                                    <FileCard
                                      key={fi}
                                      path={file.path}
                                      language={file.language}
                                      lineCount={file.lineCount}
                                      onOpen={p.onOpenFile}
                                      onEdit={(path, content) => {
                                        // Open file in editor for editing
                                        p.onOpenFile(path);
                                      }}
                                      cwd={p.cwd || undefined}
                                    />
                                  ))}
                                </div>
                              )}
                              <button
                                className="msg-copy"
                                title={p.t("msg.copy")}
                                onClick={() => p.onCopyText(m.text)}
                              >
                                copy
                              </button>
                            </div>
                          )
                        ) : null}
                        {m.role === "tool" ? (
                          <>
                            <ToolCard
                              name={m.name ?? "tool"}
                              text={m.text}
                              status={m.status}
                              detail={m.detail}
                              defaultOpen={true}
                            />
                            {parsed.files.length > 0 && (
                              <div className="msg-files">
                                <div className="msg-files-header">
                                  <span>📄 Files accessed</span>
                                  <span className="msg-files-count">{parsed.files.length}</span>
                                </div>
                                {parsed.files.map((file, fi) => (
                                  <FilePreview
                                    key={fi}
                                    path={file.path}
                                    content={file.content}
                                    language={file.language}
                                    onOpen={p.onOpenFile}
                                    onEdit={async (path, newContent) => {
                                      const result = await window.api?.writeFile(path, newContent);
                                      if (result?.ok) {
                                        p.refreshTree();
                                      } else {
                                        alert(result?.error || "Failed to save file");
                                      }
                                    }}
                                    cwd={p.cwd || undefined}
                                  />
                                ))}
                              </div>
                            )}
                          </>
                        ) : null}
                        {m.role === "error" ? <div className="bubble error">✗ {m.text}</div> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="ide-chat-composer">
                {p.mention ? (
                  <div className="mention-pop">
                    {p.mention.items.map((f, i) => (
                      <div
                        key={f}
                        className={`mention-item ${
                          i ===
                          (p.mentionActiveRef.current >= 0 ? p.mentionActiveRef.current : mentionActiveRef)
                            ? "active"
                            : ""
                        }`}
                        onClick={() => p.onInsertMention(f)}
                      >
                        {f}
                      </div>
                    ))}
                  </div>
                ) : null}
                <Composer p={p} inputRef={inputRef} />
                <div className="ide-chat-foot muted">
                  Tip: type <code>@</code> to mention files. Press <kbd>Ctrl+Alt+]</kbd> for Desktop.{" "}
                  <kbd>Ctrl+G</kbd> line · <kbd>Ctrl+P</kbd> open · <kbd>Ctrl+`</kbd> term
                </div>
              </div>
              {/* Drag handle: Center ↔ Chat (inside aside position: relative; left:-2px) */}
              <div
                className="drag-handle right-handle"
                onMouseDown={drag(setChatW, "x", 320, 720, 1, () => chatW)}
                onDoubleClick={() => setChatW(420)}
                title="Drag to resize. Double-click to reset."
              />
            </>
          ) : (
            <div className="ide-chat-collapsed-bar" title="Expand Assistant chat (click or Ctrl+Shift+R)" onClick={() => setCollapseChat(false)}>
              <IconChat />
              <span>Assistant</span>
            </div>
          )}
        </aside>
      </div>

      {/* ======= CONTEXT MENUS ======= */}
      {treeCtx ? (
        <CtxMenu
          pos={treeCtx.pos}
          onClose={() => setTreeCtx(null)}
          items={[
            {
              label: treeCtx.isDir ? "Open Folder" : "Open",
              icon: treeCtx.isDir ? <IconFolder /> : <IconFile />,
              onClick: () => (treeCtx.isDir ? null : p.onOpenFile(treeCtx.path)),
              disabled: treeCtx.isDir,
            },
            { sep: true },
            {
              label: "New File",
              icon: <IconUntitled />,
              onClick: () => {
                const atDir = treeCtx.isDir ? treeCtx.path : treeCtx.path.split(/[\\/]/).slice(0, -1).join("/");
                setNewInline({ atDir: atDir || "/", kind: "file" });
                setNewInlineName("");
              },
            },
            {
              label: "New Folder",
              icon: <IconFolderNew />,
              onClick: () => {
                const atDir = treeCtx.isDir ? treeCtx.path : treeCtx.path.split(/[\\/]/).slice(0, -1).join("/");
                setNewInline({ atDir: atDir || "/", kind: "folder" });
                setNewInlineName("");
              },
            },
            { sep: true },
            {
              label: "Reveal in Explorer",
              icon: <IconDesktop />,
              onClick: () => void window.api?.revealPath(treeCtx.path, true),
            },
            { sep: true },
            {
              label: "Cut",
              shortcut: "Ctrl+X",
              disabled: true,
              onClick: () => {},
              icon: <IconCopy />,
            },
            {
              label: "Copy Path",
              icon: <IconCopy />,
              shortcut: "Ctrl+Shift+C",
              onClick: () => void p.onCopyText(treeCtx.path),
            },
            {
              label: "Copy Relative Path",
              shortcut: "Ctrl+Shift+Alt+C",
              onClick: () => void p.onCopyText(relPath(treeCtx.path) || treeCtx.path),
            },
            { sep: true },
            {
              label: "Rename",
              icon: <IconEdit />,
              shortcut: "F2",
              onClick: () => {
                const oldName = treeCtx.path.split(/[\\/]/).pop() ?? "";
                setRenameName(oldName);
                setRenameInline({ path: treeCtx.path, oldName, isDir: treeCtx.isDir });
              },
            },
            {
              label: "Duplicate",
              shortcut: "Ctrl+D",
              onClick: () => void doDuplicate(treeCtx.path),
            },
            { sep: true },
            {
              label: "Delete",
              icon: <IconTrash />,
              danger: true,
              shortcut: "Del",
              onClick: () => void confirmDelete(treeCtx.path),
            },
          ]}
        />
      ) : null}

      {tabCtx ? (
        <CtxMenu
          pos={tabCtx.pos}
          onClose={() => setTabCtx(null)}
          items={[
            { label: "Close", icon: <IconClose />, shortcut: "Ctrl+W", onClick: () => p.onCloseTab(tabCtx.id) },
            {
              label: "Close Others",
              onClick: () => p.onCloseOtherTabs(tabCtx.id),
            },
            {
              label: "Close to the Right",
              onClick: () => p.onCloseRightTabs(tabCtx.id),
            },
            { label: "Close All", onClick: () => p.onCloseAllTabs() },
            { sep: true },
            {
              label: "Copy Path",
              icon: <IconCopy />,
              onClick: () => {
                const tt = p.tabs.find((t) => t.id === tabCtx.id);
                if (tt?.path) void p.onCopyText(tt.path);
              },
            },
            {
              label: "Copy Relative Path",
              onClick: () => {
                const tt = p.tabs.find((t) => t.id === tabCtx.id);
                if (tt?.path) void p.onCopyText(relPath(tt.path) || tt.path);
              },
            },
            {
              label: "Reveal in Explorer",
              icon: <IconDesktop />,
              onClick: () => {
                const tt = p.tabs.find((t) => t.id === tabCtx.id);
                if (tt?.path) void window.api?.revealPath(tt.path, true);
              },
            },
          ]}
        />
      ) : null}

      {headerCtx ? (
        <CtxMenu
          pos={headerCtx.pos}
          onClose={() => setHeaderCtx(null)}
          items={[
            {
              label: "Switch to Desktop Mode",
              shortcut: "Ctrl+Alt+]",
              icon: <IconDesktop />,
              onClick: () => p.mode === "desktop" || p.onToggleMode(),
            },
            {
              label: "Toggle Activity Bar",
              icon: <IconPanelLeft />,
              onClick: () => setCollapseActivity((v) => !v),
            },
            {
              label: "Toggle Side Panel",
              shortcut: "Ctrl+B",
              icon: <IconLayers />,
              onClick: () => setCollapseSide((v) => !v),
            },
            {
              label: "Toggle Assistant Chat",
              icon: <IconChat />,
              onClick: () => setCollapseChat((v) => !v),
            },
            {
              label: "Toggle Terminal Panel",
              icon: <IconTerminal />,
              onClick: () => setBottomOpen((v) => !v),
            },
            { sep: true },
            {
              label: "Reset Panel Sizes",
              onClick: () => {
                setExplorerW(280);
                setChatW(420);
                setTermH(240);
                setCollapseSide(false);
                setCollapseChat(false);
                setCollapseActivity(false);
                setBottomOpen(true);
              },
            },
          ]}
        />
      ) : null}

      {/* Goto Line Modal */}
      {gotoOpen ? (
        <div className="goto-mask" onClick={() => setGotoOpen(false)}>
          <div className="goto-modal" onClick={(e) => e.stopPropagation()}>
            <div className="goto-title">Go to Line / Column</div>
            <div className="goto-input-row">
              <kbd>:</kbd>
              <input
                autoFocus
                value={gotoVal}
                placeholder="line number (e.g. 42 or 42:7)"
                onChange={(e) => setGotoVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const [ln, col] = gotoVal.split(/[:,\s]/).map((n) => parseInt(n, 10) || 1);
                    editorRef.current?.gotoLine(ln || 1, col || 1);
                    setGotoOpen(false);
                  } else if (e.key === "Escape") {
                    setGotoOpen(false);
                  }
                }}
              />
            </div>
            <div className="goto-hint muted">
              Accepted formats: <code>42</code>, <code>42:7</code>, <code>1,5</code>
            </div>
            <div className="goto-actions">
              <button className="settings-btn" onClick={() => setGotoOpen(false)}>
                Cancel
              </button>
              <button
                className="settings-btn primary"
                onClick={() => {
                  const [ln, col] = gotoVal.split(/[:,\s]/).map((n) => parseInt(n, 10) || 1);
                  editorRef.current?.gotoLine(ln || 1, col || 1);
                  setGotoOpen(false);
                }}
              >
                Go
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick Open (Ctrl+P) */}
      <QuickOpen open={quickOpen} onClose={() => setQuickOpen(false)} p={p} onOpenFile={p.onOpenFile} />
    </div>
  );
}

// unused export to avoid TS unused warnings
export type _DiffComment = DiffComment;
