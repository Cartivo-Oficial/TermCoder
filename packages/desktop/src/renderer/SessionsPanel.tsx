import { IconNewChat, IconTrash } from "./Icons";
import { useI18n } from "./i18n";

export interface SessionCardData {
  id: string;
  title: string;
  cwd: string;
  model: string;
  messageCount: number;
  usage?: { tokensIn: number; tokensOut: number };
}

const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? "project";
const sessionLabel = (s: { title: string; cwd: string }): string =>
  !s.title || s.title === "Untitled session" ? baseName(s.cwd) : s.title;
const shortPath = (p: string) => {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.length > 3 ? `…\\${parts.slice(-2).join("\\")}` : p;
};
const fmtK = (n: number | undefined) =>
  n !== undefined && n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n ?? 0);
const sessionModelShort = (m: string) => m.split("/").pop() ?? m;

export function SessionsPanel({
  sessions,
  currentId,
  busy,
  project,
  cwd,
  confirmDelete,
  onOpen,
  onDelete,
  onClearAll,
  onNew,
  onChooseFolder,
}: {
  sessions: SessionCardData[];
  currentId: string | null;
  busy: boolean;
  project: string;
  cwd: string | null;
  confirmDelete: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onNew: () => void;
  onChooseFolder: () => void;
}) {
  const { t } = useI18n();
  const visible = sessions.filter((s) => s.messageCount > 0);
  return (
    <aside className="left glass">
      <div className="project">
        <div className="avatar">{project.charAt(0).toUpperCase()}</div>
        <div className="pinfo">
          <div className="pname">{project}</div>
          {cwd ? <div className="ppath">{shortPath(cwd)}</div> : null}
        </div>
        <button className="icon" title={t("nav.chooseFolder")} onClick={onChooseFolder}>…</button>
      </div>
      <button className="new-session" onClick={onNew}>
        <IconNewChat /> {t("nav.newSession")}
      </button>
      <div className="slist-head">
        <span className="eyebrow">{t("session.heading")}</span>
        {sessions.length > 1 ? (
          <button
            className="icon sm"
            title={t("session.clearAll")}
            onClick={() => {
              if (!confirmDelete || window.confirm(t("session.confirmClear", { n: sessions.length }))) {
                onClearAll();
              }
            }}
          >
            <IconTrash />
          </button>
        ) : null}
      </div>
      <div className="session-list">
        {visible.length === 0 ? <div className="slist-empty">{t("session.none")}</div> : null}
        {visible.map((s) => {
          const active = s.id === currentId;
          const dotClass = active && busy ? "gen" : "idle";
          return (
            <div key={s.id} className={`session-card ${active ? "active" : ""}`}>
              <div className="sc-top">
                <span className={`dot ${dotClass}`} />
                <button className="sc-title" onClick={() => onOpen(s.id)}>
                  {sessionLabel(s)}
                </button>
                <button
                  className="session-del"
                  title={t("session.deleteOne")}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirmDelete || window.confirm(t("session.confirmOne"))) onDelete(s.id);
                  }}
                >
                  <IconTrash />
                </button>
              </div>
              <div className="sc-meta">
                <span className="sc-model">{sessionModelShort(s.model)}</span>
                {s.usage ? (
                  <span>
                    ↓{fmtK(s.usage.tokensIn)} ↑{fmtK(s.usage.tokensOut)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
