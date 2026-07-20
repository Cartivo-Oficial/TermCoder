import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { layoutGraph } from "./layout";
import type { RunGraph, RunNode } from "./runGraph";

const NODE_W = 168;
const NODE_H = 92;

export function AgentCanvas({ graph, hidden }: { graph: RunGraph; hidden: boolean }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const pos = useMemo(() => layoutGraph(graph), [graph]);

  const xs = Object.values(pos).map((p) => p.x);
  const ys = Object.values(pos).map((p) => p.y);
  const minX = Math.min(0, ...xs) - NODE_W;
  const minY = Math.min(0, ...ys) - NODE_H;
  const width = Math.max(...xs, 0) - minX + NODE_W * 2;
  const height = Math.max(...ys, 0) - minY + NODE_H * 2;
  const node = selected ? graph.nodes[selected] : null;

  return (
    <div className={`agent-canvas ${hidden ? "hidden" : ""}`}>
      <div className="agent-canvas-scroll">
        <svg className="agent-canvas-edges" width={width} height={height} style={{ minWidth: width }}>
          {graph.order.map((id) => {
            const n = graph.nodes[id]!;
            if (!n.parentId || !pos[n.parentId] || !pos[id]) return null;
            const p = pos[n.parentId]!;
            const c = pos[id]!;
            const x1 = p.x - minX + NODE_W / 2;
            const y1 = p.y - minY + NODE_H;
            const x2 = c.x - minX + NODE_W / 2;
            const y2 = c.y - minY;
            return (
              <path
                key={id}
                className={`agent-edge ${n.status === "thinking" || n.status === "tool" ? "active" : ""}`}
                d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                fill="none"
              />
            );
          })}
        </svg>
        {graph.order.map((id) => {
          const n = graph.nodes[id]!;
          const p = pos[id]!;
          return (
            <button
              key={id}
              className={`agent-node ${n.status} ${selected === id ? "selected" : ""}`}
              style={{ left: p.x - minX, top: p.y - minY, width: NODE_W, height: NODE_H }}
              onClick={() => setSelected(id)}
            >
              <span className="agent-node-name">{n.agent === "primary" ? t("canvas.primary") : n.agent}</span>
              <span className={`agent-node-status ${n.status}`}>{t(`canvas.status.${n.status}`)}</span>
              <span className="agent-node-activity">
                {n.activity.filter((a) => !a.done).map((a) => a.title || a.name).slice(-1)[0] ??
                  (n.activity.length ? `${n.activity.length} ${t("canvas.tools")}` : "")}
              </span>
            </button>
          );
        })}
      </div>
      {node ? <Inspector node={node} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function Inspector({ node, onClose }: { node: RunNode; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="agent-inspector">
      <div className="agent-inspector-head">
        <b>{node.agent === "primary" ? t("canvas.primary") : node.agent}</b>
        <button className="icon sm" onClick={onClose}>
          ×
        </button>
      </div>
      {node.prompt ? <p className="agent-inspector-prompt">{node.prompt}</p> : null}
      {node.reasoning ? (
        <div className="agent-inspector-reasoning">{node.reasoning}</div>
      ) : (
        <p className="hint">{t("canvas.noReasoning")}</p>
      )}
      <div className="agent-inspector-tools">
        {node.activity.map((a) => (
          <div key={a.id} className={`agent-tool-row ${a.isError ? "err" : ""}`}>
            <span className="agent-tool-name">{a.title || a.name}</span>
            {a.output ? <span className="agent-tool-out">{a.output.slice(0, 200)}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
