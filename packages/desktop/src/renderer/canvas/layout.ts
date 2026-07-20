import type { RunGraph } from "./runGraph";

const COL = 220;
const ROW = 140;

export function layoutGraph(graph: RunGraph): Record<string, { x: number; y: number }> {
  const depth: Record<string, number> = {};
  const compute = (id: string): number => {
    if (depth[id] !== undefined) return depth[id]!;
    const parent = graph.nodes[id]?.parentId;
    depth[id] = parent && graph.nodes[parent] ? compute(parent) + 1 : 0;
    return depth[id]!;
  };
  for (const id of graph.order) compute(id);

  const byDepth: Record<number, string[]> = {};
  for (const id of graph.order) {
    const d = depth[id]!;
    (byDepth[d] ||= []).push(id);
  }

  const pos: Record<string, { x: number; y: number }> = {};
  for (const d of Object.keys(byDepth)) {
    const level = byDepth[Number(d)]!;
    level.forEach((id, i) => {
      pos[id] = { x: (i - (level.length - 1) / 2) * COL, y: Number(d) * ROW };
    });
  }
  return pos;
}
