import { useI18n } from "./i18n";

/**
 * First-run mode picker. Lets a newcomer choose the coding agent (termcoder) or
 * the study assistant (termexplorer) so students aren't dropped into a
 * code-centric UI they don't need.
 */
export function Welcome({ onChoose }: { onChoose: (mode: "code" | "study") => void }) {
  const { t } = useI18n();
  return (
    <div className="welcome-overlay">
      <div className="welcome-card">
        <div className="welcome-logo">
          <span className="wl-term">term</span>
          <span className="wl-coder">coder</span>
        </div>
        <p className="welcome-sub">{t("welcome.sub")}</p>
        <div className="welcome-choices">
          <button className="welcome-choice code" onClick={() => onChoose("code")}>
            <span className="wc-icon">💻</span>
            <span className="wc-title eyebrow">{t("welcome.code")}</span>
            <span className="wc-desc">{t("welcome.code.desc")}</span>
            <span className="wc-go">{t("welcome.start")} →</span>
          </button>
          <button className="welcome-choice study" onClick={() => onChoose("study")}>
            <span className="wc-badge">termexplorer</span>
            <span className="wc-icon">📚</span>
            <span className="wc-title eyebrow">{t("welcome.study")}</span>
            <span className="wc-desc">{t("welcome.study.desc")}</span>
            <span className="wc-go">{t("welcome.start")} →</span>
          </button>
        </div>
        <p className="welcome-foot">{t("welcome.switch")}</p>
      </div>
    </div>
  );
}
