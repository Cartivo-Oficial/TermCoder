import { useEffect, useState } from "react";
import { FileTree } from "./FileTree";
import { Dashboard } from "./Dashboard";
import { Study } from "./Study";
import { useI18n } from "./i18n";
import type { SessionCardData } from "./SessionsPanel";

export function SidePanel({
  kind,
  onClose,
  cwd,
  status,
  changes,
  changedFiles,
  onOpenFile,
  onOpenDiff,
  onOpenAllDiffs,
  branches,
  compareBase,
  onChangeCompareBase,
  sessions,
  port,
  agents,
  currentAgent,
  onPickAgent,
  onManageAgents,
}: {
  kind: "files" | "study" | "agents";
  onClose: () => void;
  cwd: string | null;
  status: Record<string, string>;
  changes: number;
  changedFiles: Array<[string, string]>;
  onOpenFile: (p: string) => void;
  onOpenDiff: (p: string) => void;
  onOpenAllDiffs: () => void;
  branches: string[];
  compareBase: string;
  onChangeCompareBase: (base: string) => void;
  sessions: SessionCardData[];
  port: number;
  agents: Array<{ name: string; description?: string; builtin: boolean; readOnly: boolean; mode?: string }>;
  currentAgent: string;
  onPickAgent: (name: string) => void;
  onManageAgents: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"changes" | "files" | "overview">("files");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="side-scrim" onClick={onClose} />
      <aside className="side-panel glass">
        <div className="side-head">
          <span className="eyebrow">
            {kind === "files" ? t("right.allFiles") : kind === "study" ? t("rail.study") : t("rail.agents")}
          </span>
          <button className="icon sm" onClick={onClose}>✕</button>
        </div>
        {kind === "files" ? (
          <>
            <div className="right-tabs">
              <button className={tab === "changes" ? "active" : ""} onClick={() => setTab("changes")}>
                {changes} {t("right.changes")}
              </button>
              <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
                {t("right.allFiles")}
              </button>
              <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
                {t("dash.overview")}
              </button>
            </div>
            {tab === "overview" ? (
              <Dashboard sessions={sessions} t={t} />
            ) : tab === "files" ? (
              <FileTree root={cwd} status={status} onOpen={onOpenFile} />
            ) : (
              <>
                {branches.length ? (
                  <div className="compare-base">
                    <label>{t("review.compareWith")}</label>
                    <select value={compareBase} onChange={(e) => onChangeCompareBase(e.target.value)}>
                      <option value="">{t("review.uncommitted")}</option>
                      {branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {changedFiles.length === 0 ? (
                  <div className="muted tree-empty">{t("right.noChanges")}</div>
                ) : (
                  <div className="tree">
                    <button className="view-all" onClick={onOpenAllDiffs}>
                      {t("right.viewAllDiffs")}
                    </button>
                    {changedFiles.map(([path, letter]) => (
                      <div key={path} className="tree-row" onClick={() => onOpenDiff(path)}>
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
              </>
            )}
          </>
        ) : kind === "study" ? (
          <Study port={port} onClose={onClose} inline />
        ) : (
          <div className="agents-panel">
            {agents
              .filter((a) => a.mode !== "subagent")
              .map((a) => (
                <button
                  key={a.name}
                  className={`srow agent-row ${a.name === currentAgent ? "active" : ""}`}
                  onClick={() => onPickAgent(a.name)}
                >
                  <div>
                    <div className="srow-title">{a.name}</div>
                    {a.description ? <div className="srow-desc">{a.description}</div> : null}
                  </div>
                  {a.name === currentAgent ? <span className="check">✓</span> : null}
                </button>
              ))}
            <button className="settings-btn" onClick={onManageAgents}>{t("agents.manage")}</button>
          </div>
        )}
      </aside>
    </>
  );
}
