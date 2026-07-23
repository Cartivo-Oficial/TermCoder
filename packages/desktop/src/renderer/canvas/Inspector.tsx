import { useState } from "react";
import { useI18n } from "../i18n";
import { formatTokens, formatDuration } from "./format";
import type { RunNode } from "./runGraph";

export function Inspector({ node, now, onClose }: { node: RunNode; now: number; onClose: () => void }) {
  const { t } = useI18n();
  const dur = Math.max(0, (node.endedAt ?? now) - node.startedAt);
  return (
    <div className="agent-inspector">
      <div className="agent-inspector-head">
        <b>{node.agent === "primary" ? t("canvas.primary") : node.agent}</b>
        <button className="icon sm" onClick={onClose}>×</button>
      </div>
      <div className="agent-inspector-metrics">
        <span className={`agent-node-status ${node.status}`}>{t(`canvas.status.${node.status}`)}</span>
        <span>{formatDuration(dur)}</span>
        <span>↓{formatTokens(node.tokensIn)} ↑{formatTokens(node.tokensOut)}</span>
        <span>{node.activity.length} {t("canvas.tools")}</span>
      </div>
      {node.prompt ? <p className="agent-inspector-prompt">{node.prompt}</p> : null}
      {node.reasoning ? <div className="agent-inspector-reasoning">{node.reasoning}</div> : <p className="hint">{t("canvas.noReasoning")}</p>}
      <div className="agent-inspector-tools">
        {node.activity.map((a) => <ToolRow key={a.id} name={a.title || a.name} output={a.output} isError={a.isError} />)}
      </div>
    </div>
  );
}

function ToolRow({ name, output, isError }: { name: string; output?: string; isError?: boolean }) {
  const [copied, setCopied] = useState<"" | "ok" | "err">("");
  const copy = async () => {
    try { await navigator.clipboard.writeText(output ?? ""); setCopied("ok"); }
    catch { setCopied("err"); }
    setTimeout(() => setCopied(""), 1200);
  };
  return (
    <div className={`agent-tool-row ${isError ? "err" : ""}`}>
      <div className="agent-tool-head">
        <span className="agent-tool-name">{name}</span>
        {output ? <button className="agent-tool-copy" onClick={copy}>{copied === "ok" ? "copied" : copied === "err" ? "failed" : "copy"}</button> : null}
      </div>
      {output ? <pre className="agent-tool-out">{output}</pre> : null}
    </div>
  );
}
