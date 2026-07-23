import { useI18n } from "../i18n";
import { formatTokens, formatDuration } from "./format";
import type { RunNode } from "./runGraph";

export function NodeCard({ node, selected, hasChildren, collapsed, now, onSelect, onToggleCollapse }: {
  node: RunNode; selected: boolean; hasChildren: boolean; collapsed: boolean; now: number;
  onSelect: () => void; onToggleCollapse: () => void;
}) {
  const { t } = useI18n();
  const dur = (node.endedAt ?? now) - node.startedAt;
  const current = node.activity.filter((a) => !a.done).map((a) => a.title || a.name).slice(-1)[0]
    ?? (node.activity.length ? `${node.activity.length} ${t("canvas.tools")}` : "");
  return (
    <div className={`agent-node ${node.status} ${selected ? "selected" : ""}`}>
      <button className="agent-node-hit" onClick={onSelect}>
        <span className="agent-node-name">{node.agent === "primary" ? t("canvas.primary") : node.agent}</span>
        <span className={`agent-node-status ${node.status}`}>{t(`canvas.status.${node.status}`)}</span>
        <span className="agent-node-activity">{current}</span>
        <span className="agent-node-metrics">
          <span>↓{formatTokens(node.tokensIn)} ↑{formatTokens(node.tokensOut)}</span>
          <span>{formatDuration(dur)}</span>
          <span>{node.activity.length} {t("canvas.tools")}</span>
        </span>
      </button>
      {hasChildren ? (
        <button className="agent-node-collapse" title={collapsed ? "expand" : "collapse"} onClick={onToggleCollapse}>
          {collapsed ? "+" : "−"}
        </button>
      ) : null}
    </div>
  );
}
