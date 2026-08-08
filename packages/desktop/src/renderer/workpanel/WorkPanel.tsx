import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import { Chip } from "../ui/Chip";
import type { WorkState, WorkTab } from "./decide";

const TABS: WorkTab[] = ["diff", "terminal", "canvas"];

export function WorkPanel({
  state,
  onPick,
  onClose,
  diff,
  terminal,
  canvas,
}: {
  state: WorkState;
  onPick: (t: WorkTab) => void;
  onClose: () => void;
  diff: ReactNode;
  terminal: ReactNode;
  canvas: ReactNode;
}) {
  const { t } = useI18n();
  if (!state.open) return null;
  return (
    <aside className="work">
      <div className="work-tabs">
        {TABS.map((tab) => (
          <Chip key={tab} interactive on={state.tab === tab} onClick={() => onPick(tab)}>
            {t(`work.${tab}`)}
          </Chip>
        ))}
        <button className="work-close" title={t("work.close")} onClick={onClose}>×</button>
      </div>
      <div className="work-body" hidden={state.tab !== "diff"}>{diff}</div>
      <div className="work-body" hidden={state.tab !== "terminal"}>{terminal}</div>
      <div className="work-body" hidden={state.tab !== "canvas"}>{canvas}</div>
    </aside>
  );
}
