export type NodeStatus = "idle" | "thinking" | "tool" | "done" | "error";

export interface RunActivity {
  id: string;
  name: string;
  title?: string;
  detail?: string;
  output?: string;
  isError?: boolean;
  done: boolean;
}

export interface RunNode {
  id: string;
  agent: string;
  status: NodeStatus;
  reasoning: string;
  activity: RunActivity[];
  parentId?: string;
  prompt?: string;
}

export interface RunGraph {
  rootId: string;
  nodes: Record<string, RunNode>;
  order: string[];
}

export type SessionEventLike =
  | { type: "text-delta"; text: string; sourceId?: string }
  | { type: "reasoning-delta"; text: string; sourceId?: string }
  | { type: "reasoning-end"; sourceId?: string }
  | { type: "tool-call"; id: string; name: string; args?: unknown; title?: string; detail?: string; sourceId?: string }
  | { type: "tool-result"; id: string; name: string; output: string; isError: boolean; sourceId?: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; sourceId?: string }
  | { type: "subagent-start"; sessionId: string; agent: string; prompt: string; parentToolCallId?: string; sourceId?: string }
  | { type: "subagent-end"; sessionId: string; status: "done" | "error"; sourceId?: string }
  | { type: "done"; sourceId?: string }
  | { type: "error"; error: string; sourceId?: string };

export function emptyGraph(rootId: string): RunGraph {
  return {
    rootId,
    nodes: { [rootId]: { id: rootId, agent: "primary", status: "idle", reasoning: "", activity: [] } },
    order: [rootId],
  };
}

function nodeIdFor(graph: RunGraph, event: SessionEventLike): string {
  const src = event.sourceId;
  if (src && graph.nodes[src]) return src;
  return graph.rootId;
}

export function reduceGraph(graph: RunGraph, event: SessionEventLike): RunGraph {
  const nodes = { ...graph.nodes };
  let order = graph.order;

  if (event.type === "subagent-start") {
    const parentId = Object.values(nodes).find((n) =>
      n.activity.some((a) => a.id === event.parentToolCallId),
    )?.id ?? graph.rootId;
    nodes[event.sessionId] = {
      id: event.sessionId,
      agent: event.agent,
      status: "thinking",
      reasoning: "",
      activity: [],
      parentId,
      prompt: event.prompt,
    };
    order = order.includes(event.sessionId) ? order : [...order, event.sessionId];
    return { ...graph, nodes, order };
  }

  const id = nodeIdFor(graph, event);
  const existing = nodes[id];
  if (!existing) return { ...graph, nodes, order };

  const node: RunNode = { ...existing, activity: existing.activity.slice() };

  switch (event.type) {
    case "reasoning-delta":
      node.reasoning += event.text;
      if (node.status !== "tool") node.status = "thinking";
      break;
    case "tool-call":
      node.activity.push({ id: event.id, name: event.name, title: event.title, detail: event.detail, done: false });
      node.status = "tool";
      break;
    case "tool-result": {
      const index = node.activity.findIndex((x) => x.id === event.id);
      if (index !== -1) {
        node.activity[index] = { ...node.activity[index]!, output: event.output, isError: event.isError, done: true };
      }
      node.status = "thinking";
      break;
    }
    case "subagent-end":
      if (nodes[event.sessionId]) {
        nodes[event.sessionId] = { ...nodes[event.sessionId]!, status: event.status };
      }
      return { ...graph, nodes, order };
    case "done":
      node.status = "done";
      break;
    case "error":
      node.status = "error";
      break;
    default:
      break;
  }

  nodes[id] = node;
  return { ...graph, nodes, order };
}
