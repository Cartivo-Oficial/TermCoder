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
  project?: string;
}

function BlockWordmark() {
  return (
    <svg className="home-wm-svg" viewBox="0 0 794 129" fill="none" aria-hidden="true">
      <g opacity="0.6">
        <g mask="url(#home-wm-mask)">
          <g opacity="0.16">
            <g opacity="0.7" fill="currentColor">
              <path d="M442.846 36.4286H387.462V91.7143H442.846V110.143H369V18H442.846V36.4286Z" />
              <path d="M517.385 36.4286H480.462V91.7143H517.385V36.4286ZM535.846 110.143H462V18H535.846V110.143Z" />
              <path d="M609.385 36.8571H572.462V92.1429H609.385V36.8571ZM627.846 110.571H554V18.4286H609.385V0H627.846V110.571Z" />
              <path d="M664.462 36.4286V54.8571H701.385V36.4286H664.462ZM719.846 73.2857H664.462V91.7143H719.846V110.143H646V18H719.846V73.2857Z" />
              <g transform="translate(-92.6923,0)">
                <path d="M258.846 73.2857H203.462V91.7143H258.846V110.143H185V18H258.846V73.2857ZM203.462 54.8571H240.385V36.4286H203.462V54.8571Z" />
              </g>
              <rect x={17.96} y={-0.96} width={19.46} height={19.46} />
              <rect x={-0.5} y={17.5} width={19.46} height={19.46} />
              <rect x={17.96} y={17.5} width={19.46} height={19.46} />
              <rect x={36.42} y={17.5} width={19.46} height={19.46} />
              <rect x={54.88} y={17.5} width={19.46} height={19.46} />
              <rect x={17.96} y={35.96} width={19.46} height={19.46} />
              <rect x={17.96} y={54.42} width={19.46} height={19.46} />
              <rect x={17.96} y={72.88} width={19.46} height={19.46} />
              <rect x={17.96} y={91.35} width={19.46} height={19.46} />
              <rect x={36.42} y={91.35} width={19.46} height={19.46} />
              <rect x={184.12} y={17.5} width={19.46} height={19.46} />
              <rect x={202.58} y={17.5} width={19.46} height={19.46} />
              <rect x={221.04} y={17.5} width={19.46} height={19.46} />
              <rect x={184.12} y={35.96} width={19.46} height={19.46} />
              <rect x={221.04} y={35.96} width={19.46} height={19.46} />
              <rect x={184.12} y={54.42} width={19.46} height={19.46} />
              <rect x={184.12} y={72.88} width={19.46} height={19.46} />
              <rect x={184.12} y={91.35} width={19.46} height={19.46} />
              <rect x={257.96} y={17.5} width={19.46} height={19.46} />
              <rect x={276.42} y={17.5} width={19.46} height={19.46} />
              <rect x={294.88} y={17.5} width={19.46} height={19.46} />
              <rect x={313.35} y={17.5} width={19.46} height={19.46} />
              <rect x={331.81} y={17.5} width={19.46} height={19.46} />
              <rect x={257.96} y={35.96} width={19.46} height={19.46} />
              <rect x={294.88} y={35.96} width={19.46} height={19.46} />
              <rect x={331.81} y={35.96} width={19.46} height={19.46} />
              <rect x={257.96} y={54.42} width={19.46} height={19.46} />
              <rect x={294.88} y={54.42} width={19.46} height={19.46} />
              <rect x={331.81} y={54.42} width={19.46} height={19.46} />
              <rect x={257.96} y={72.88} width={19.46} height={19.46} />
              <rect x={294.88} y={72.88} width={19.46} height={19.46} />
              <rect x={331.81} y={72.88} width={19.46} height={19.46} />
              <rect x={257.96} y={91.35} width={19.46} height={19.46} />
              <rect x={294.88} y={91.35} width={19.46} height={19.46} />
              <rect x={331.81} y={91.35} width={19.46} height={19.46} />
              <rect x={737.96} y={17.5} width={19.46} height={19.46} />
              <rect x={756.42} y={17.5} width={19.46} height={19.46} />
              <rect x={774.88} y={17.5} width={19.46} height={19.46} />
              <rect x={737.96} y={35.96} width={19.46} height={19.46} />
              <rect x={774.88} y={35.96} width={19.46} height={19.46} />
              <rect x={737.96} y={54.42} width={19.46} height={19.46} />
              <rect x={737.96} y={72.88} width={19.46} height={19.46} />
              <rect x={737.96} y={91.35} width={19.46} height={19.46} />
            </g>
          </g>
        </g>
      </g>
      <defs>
        <mask id="home-wm-mask" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="794" height="129">
          <rect width="794" height="129" fill="url(#home-wm-grad)" />
        </mask>
        <linearGradient id="home-wm-grad" x1="397" y1="68" x2="397" y2="129" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.7" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function HomeView({ composer, recent, onOpenSession, project }: HomeViewProps) {
  const { t } = useI18n();
  return (
    <div className="home">
      <div className="home-stage">
        <div className="home-wordmark" aria-hidden="true">
          <BlockWordmark />
        </div>
        <div className="home-center">
          <div className="home-headline">
            {t("home.startTask")} <b>{project ?? "termcoder"}</b>
          </div>
          <div className="home-composer">{composer}</div>
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
