import type { ReactElement } from "react";
import { useI18n } from "../i18n";
import { formatTokens, formatDuration } from "./format";
import type { RunNode } from "./runGraph";

const GLYPHS: Record<string, ReactElement> = {
  primary: <path d="M8 2v12M2.8 5 13.2 11M13.2 5 2.8 11" />,
  general: <path d="M4 4h.01M8 4h.01M12 4h.01M4 8h.01M8 8h.01M12 8h.01M4 12h.01M8 12h.01M12 12h.01" strokeWidth={2} />,
  explore: <><circle cx="7" cy="7" r="4" /><path d="M10 10.2 13.6 13.8" /></>,
  scout: <><path d="M1.8 8S4.2 4.2 8 4.2 14.2 8 14.2 8 11.8 11.8 8 11.8 1.8 8 1.8 8Z" /><circle cx="8" cy="8" r="1.5" /></>,
  reviewer: <path d="M3 8.4 6.4 11.8 13 4.4" />,
  architect: <><path d="M8 2.2 14 13.4H2Z" /><path d="M5.2 9.2h5.6" /></>,
  tester: <><path d="M6.4 2.4v3.8L3 13.2h10L9.6 6.2V2.4Z" /><path d="M5.4 2.4h5.2M5 9.6h6" /></>,
  debugger: <><rect x="5.2" y="5" width="5.6" height="8" rx="2.8" /><path d="M2.2 7.2h3M10.8 7.2h3M2.2 12h3M10.8 12h3M6.4 3.2 7.4 5M9.6 3.2 8.6 5" /></>,
  claude: <path d="M8 2.4v3.2M8 10.4v3.2M2.4 8h3.2M10.4 8h3.2M4.1 4.1 6.4 6.4M9.6 9.6l2.3 2.3M11.9 4.1 9.6 6.4M6.4 9.6l-2.3 2.3" />,
  codex: <path d="M5.6 4.4 2.2 8l3.4 3.6M10.4 4.4 13.8 8l-3.4 3.6M9.2 3.4 6.8 12.6" />,
  opencode: <><path d="M6 3.2H3.2v9.6H6M10 3.2h2.8v9.6H10" /><circle cx="8" cy="8" r="1.3" /></>,
  gemini: <path d="M8 2c0 3.3 2.7 6 6 6-3.3 0-6 2.7-6 6 0-3.3-2.7-6-6-6 3.3 0 6-2.7 6-6Z" />,
  goose: <><path d="M2.2 12.4c4.6 0 8-3 8-6.2" /><path d="M10.2 6.2c0-1.5 1.2-2.6 2.6-2.6" /><circle cx="12.8" cy="3.6" r="0.9" /></>,
};

const FALLBACK = <><circle cx="8" cy="8" r="5" /><path d="M8 8h.01" strokeWidth={2} /></>;

function AgentGlyph({ agent }: { agent: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[agent] ?? FALLBACK}
    </svg>
  );
}

function firstLine(text: string): string {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function NodeCard({ node, selected, hasChildren, collapsed, now, onSelect, onToggleCollapse }: {
  node: RunNode; selected: boolean; hasChildren: boolean; collapsed: boolean; now: number;
  onSelect: () => void; onToggleCollapse: () => void;
}) {
  const { t } = useI18n();
  const dur = Math.max(0, (node.endedAt ?? now) - node.startedAt);
  const name = node.agent === "primary" ? t("canvas.primary") : node.agent;
  const status = t(`canvas.status.${node.status}`);
  const role = (node.prompt ? firstLine(node.prompt) : "") || firstLine(node.reasoning) || status;
  const acts = node.activity.slice(-2).map((a) => a.title || a.name);
  const label = `${name} — ${status}${role === status ? "" : ` — ${role}`}`;

  return (
    <div className={`agent-node ${node.status} ${selected ? "selected" : ""}`}>
      <button className="agent-node-hit" onClick={onSelect} aria-pressed={selected} aria-label={label} title={label}>
        <span className="agent-node-head">
          <span className="agent-node-icon"><AgentGlyph agent={node.agent} /></span>
          <span className="agent-node-name">{name}</span>
          <span className={`agent-node-dot ${node.status}`} />
          <span className="agent-node-time">{formatDuration(dur)}</span>
        </span>
        <span className="agent-node-role">{role}</span>
        <span className="agent-node-acts">
          {acts.map((a, i) => <span className="agent-node-act" key={`${a}-${i}`}>{a}</span>)}
        </span>
        <span className="agent-node-metrics">
          <span className={`agent-node-status ${node.status}`}>{status}</span>
          <span>↓{formatTokens(node.tokensIn)} ↑{formatTokens(node.tokensOut)}</span>
          <span>{node.activity.length} {t("canvas.tools")}</span>
        </span>
      </button>
      {hasChildren ? (
        <button className="agent-node-collapse" title={collapsed ? "expand" : "collapse"} aria-expanded={!collapsed} onClick={onToggleCollapse}>
          {collapsed ? "+" : "−"}
        </button>
      ) : null}
    </div>
  );
}
