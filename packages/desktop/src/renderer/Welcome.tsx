import { useMemo } from "react";
import { useI18n } from "./i18n";

const GLYPHS = ["·", "+", "✦", "*"];

export function Welcome({ onChoose }: { onChoose: (mode: "code" | "study") => void }) {
  const { t } = useI18n();
  const stars = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        glyph: GLYPHS[i % GLYPHS.length]!,
        left: `${Math.random() * 96}%`,
        top: `${Math.random() * 92}%`,
        delay: `${Math.random() * 3.2}s`,
      })),
    [],
  );
  return (
    <div className="welcome-overlay">
      <div className="stars" aria-hidden="true">
        {stars.map((s) => (
          <b key={s.id} style={{ left: s.left, top: s.top, animationDelay: s.delay }}>{s.glyph}</b>
        ))}
      </div>
      <div className="welcome-inner">
        <div className="welcome-logo">
          <span className="wl-term">term</span>
          <span className="wl-coder">coder</span>
        </div>
        <p className="welcome-sub">{t("welcome.sub")}</p>
        <div className="welcome-choices">
          <button className="welcome-choice code glass" onClick={() => onChoose("code")}>
            <span className="wc-icon">💻</span>
            <span className="wc-title">{t("welcome.code")}</span>
            <span className="wc-desc">{t("welcome.code.desc")}</span>
            <span className="wc-go">{t("welcome.start")} →</span>
          </button>
          <button className="welcome-choice study glass" onClick={() => onChoose("study")}>
            <span className="wc-badge">termexplorer</span>
            <span className="wc-icon">📚</span>
            <span className="wc-title">{t("welcome.study")}</span>
            <span className="wc-desc">{t("welcome.study.desc")}</span>
            <span className="wc-go">{t("welcome.start")} →</span>
          </button>
        </div>
        <p className="welcome-foot">{t("welcome.switch")}</p>
      </div>
    </div>
  );
}
