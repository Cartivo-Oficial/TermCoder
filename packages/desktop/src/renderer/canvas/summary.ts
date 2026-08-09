import type { NodeStatus, RunGraph } from "./runGraph";

export interface RunSummary {
  running: number;
  done: number;
  failed: number;
}

const RUNNING: ReadonlySet<NodeStatus> = new Set<NodeStatus>(["idle", "thinking", "tool"]);

export function runSummary(graph: RunGraph): RunSummary {
  let running = 0;
  let done = 0;
  let failed = 0;
  for (const id of graph.order) {
    const node = graph.nodes[id];
    if (!node) continue;
    if (node.status === "done") done += 1;
    else if (node.status === "error") failed += 1;
    else if (RUNNING.has(node.status)) running += 1;
  }
  return { running, done, failed };
}
