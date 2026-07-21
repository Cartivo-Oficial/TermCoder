import type { ReactNode } from "react";
import { useI18n } from "../i18n";

export interface HomeRecent {
  id: string;
  name: string;
  meta: string;
  when: string;
}

export interface HomeViewProps {
  composer: ReactNode;
  recent: HomeRecent[];
  onOpenSession: (id: string) => void;
  onOpenTerminal: () => void;
  onOpenCanvas: () => void;
  onOpenCommands: () => void;
  project?: ReactNode;
}

export function HomeView({
  composer,
  recent,
  onOpenSession,
  onOpenTerminal,
  onOpenCanvas,
  onOpenCommands,
  project,
}: HomeViewProps) {
  const { t } = useI18n();
  return (
    <div className="home">
      <div className="home-stage">
        <div className="home-wordmark" aria-hidden="true">
          term<b>coder</b>
        </div>
        <div className="home-center">
          <div className="home-composer">{composer}</div>
          {project ? <div className="home-project">{project}</div> : null}
          <div className="home-views">
            <button className="home-view" onClick={onOpenTerminal}>
              {t("nav.terminal")}
            </button>
            <button className="home-view" onClick={onOpenCanvas}>
              {t("canvas.tab")}
            </button>
            <button className="home-view" onClick={onOpenCommands}>
              {t("palette.title")}
              <kbd>⌘K</kbd>
            </button>
          </div>
        </div>
      </div>
      {recent.length ? (
        <div className="home-recent">
          <h3>{t("home.recent")}</h3>
          {recent.map((r) => (
            <button key={r.id} className="home-sess" onClick={() => onOpenSession(r.id)}>
              <span className="home-sess-t">
                <span className="home-sess-name">{r.name}</span>
                <span className="home-sess-meta">{r.meta}</span>
              </span>
              <span className="home-sess-when">{r.when}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
