import { useEffect, useMemo, useRef, useState } from "react";
import { layoutGraph } from "./layout";
import { useZoomPan } from "./useZoomPan";
import { NodeCard } from "./NodeCard";
import { Inspector } from "./Inspector";
import type { RunGraph } from "./runGraph";

const NODE_W = 176;
const NODE_H = 104;

export function AgentCanvas({ graph, hidden }: { graph: RunGraph; hidden: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const viewportRef = useRef<HTMLDivElement>(null);
  const zp = useZoomPan();

  useEffect(() => {
    if (hidden) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hidden]);

  const pos = useMemo(() => layoutGraph(graph, collapsed), [graph, collapsed]);
  const visibleIds = graph.order.filter((id) => pos[id]);
  const xs = visibleIds.map((id) => pos[id]!.x);
  const ys = visibleIds.map((id) => pos[id]!.y);
  const minX = Math.min(0, ...xs) - NODE_W;
  const minY = Math.min(0, ...ys) - NODE_H;
  const width = Math.max(...xs, 0) - minX + NODE_W * 2;
  const height = Math.max(...ys, 0) - minY + NODE_H * 2;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    zp.setViewport(el.clientWidth, el.clientHeight);
    zp.setContent(width, height);
  }, [width, height, hidden, zp]);

  const childCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const id of graph.order) { const p = graph.nodes[id]?.parentId; if (p) c[p] = (c[p] ?? 0) + 1; }
    return c;
  }, [graph]);

  const node = selected ? graph.nodes[selected] : null;

  const toggle = (id: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className={`agent-canvas ${hidden ? "hidden" : ""}`}>
      <div className="agent-canvas-viewport" ref={viewportRef} onWheel={zp.onWheel} onPointerDown={zp.onPointerDown}>
        <div className="agent-canvas-layer" style={{ transform: `translate(${zp.tx}px, ${zp.ty}px) scale(${zp.scale})`, width, height }}>
          <svg className="agent-canvas-edges" width={width} height={height}>
            {visibleIds.map((id) => {
              const n = graph.nodes[id]!;
              if (!n.parentId || !pos[n.parentId] || !pos[id]) return null;
              const p = pos[n.parentId]!; const c = pos[id]!;
              const x1 = p.x - minX + NODE_W / 2; const y1 = p.y - minY + NODE_H;
              const x2 = c.x - minX + NODE_W / 2; const y2 = c.y - minY;
              return <path key={id} className={`agent-edge ${n.status === "thinking" || n.status === "tool" ? "active" : ""}`} d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`} fill="none" />;
            })}
          </svg>
          {visibleIds.map((id) => {
            const p = pos[id]!;
            return (
              <div key={id} className="agent-node-wrap" style={{ left: p.x - minX, top: p.y - minY, width: NODE_W, height: NODE_H }}>
                <NodeCard node={graph.nodes[id]!} selected={selected === id} hasChildren={(childCount[id] ?? 0) > 0} collapsed={collapsed.has(id)} now={now} onSelect={() => setSelected(id)} onToggleCollapse={() => toggle(id)} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="agent-canvas-tools">
        <button className="icon sm" title="fit" onClick={zp.fit}>⊡</button>
        <button className="icon sm" title="zoom in" onClick={zp.zoomIn}>+</button>
        <button className="icon sm" title="zoom out" onClick={zp.zoomOut}>−</button>
        <button className="icon sm" title="reset" onClick={zp.reset}>◦</button>
      </div>
      {node ? <Inspector node={node} now={now} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
