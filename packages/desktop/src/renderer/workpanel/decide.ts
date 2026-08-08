import type { SessionEventLike } from "../canvas/runGraph";

export type WorkTab = "diff" | "terminal" | "canvas";

export interface WorkState {
  open: boolean;
  tab: WorkTab;
  pinned: boolean;
  dismissed: boolean;
}

export const closedWork: WorkState = { open: false, tab: "diff", pinned: false, dismissed: false };

const COMMAND_TOOLS = new Set(["bash"]);

function tabFor(e: SessionEventLike): WorkTab | null {
  if (e.type === "subagent-start") return "canvas";
  if (e.type !== "tool-call") return null;
  if (COMMAND_TOOLS.has(e.name)) return "terminal";
  const patch = (e as { patch?: unknown }).patch;
  return patch ? "diff" : null;
}

export function reduceWork(s: WorkState, e: SessionEventLike): WorkState {
  if (e.type === "done" || e.type === "error") {
    return s.pinned || s.dismissed ? { ...s, pinned: false, dismissed: false } : s;
  }
  if (s.dismissed) return s;
  const tab = tabFor(e);
  if (!tab) return s;
  if (s.pinned) return s.open ? s : { ...s, open: true };
  if (s.open && s.tab === tab) return s;
  return { ...s, open: true, tab };
}

export function pinWork(s: WorkState, tab: WorkTab): WorkState {
  return { open: true, tab, pinned: true, dismissed: false };
}

export function closeWork(s: WorkState): WorkState {
  return { ...s, open: false, pinned: false, dismissed: true };
}
