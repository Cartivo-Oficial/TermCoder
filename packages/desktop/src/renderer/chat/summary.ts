import type { PatchHunk } from "@termcoder/core";

export interface FileChange {
  path: string;
  added: number;
  removed: number;
}

export interface CheckRun {
  command: string;
  ok: boolean;
}

export interface TurnSummary {
  files: FileChange[];
  added: number;
  removed: number;
  checks: CheckRun[];
  didWork: boolean;
}

export interface SummaryInput {
  role: string;
  name?: string;
  status?: string;
  text?: string;
  target?: string;
  patch?: PatchHunk[];
}

const PATCH_TOOLS = new Set(["write", "edit"]);
const CHECK_TOOLS = new Set(["bash"]);
const FINISHED_STATUSES = new Set(["done", "error"]);

export function countPatch(patch: PatchHunk[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const hunk of patch) {
    for (const line of hunk.lines) {
      if (line.startsWith("+")) added += 1;
      else if (line.startsWith("-")) removed += 1;
    }
  }

  return { added, removed };
}

export function turnSummary(messages: SummaryInput[]): TurnSummary {
  const fileOrder: string[] = [];
  const fileTotals = new Map<string, { added: number; removed: number }>();
  const checks: CheckRun[] = [];

  for (const message of messages) {
    if (message.role !== "tool") continue;
    if (!message.status || !FINISHED_STATUSES.has(message.status)) continue;

    if (message.name && PATCH_TOOLS.has(message.name) && message.target && message.patch) {
      const { added, removed } = countPatch(message.patch);
      const existing = fileTotals.get(message.target);

      if (existing) {
        existing.added += added;
        existing.removed += removed;
      } else {
        fileTotals.set(message.target, { added, removed });
        fileOrder.push(message.target);
      }
    } else if (message.name && CHECK_TOOLS.has(message.name) && message.text) {
      checks.push({ command: message.text, ok: message.status === "done" });
    }
  }

  const files: FileChange[] = fileOrder.map((path) => {
    const totals = fileTotals.get(path);
    const added = totals ? totals.added : 0;
    const removed = totals ? totals.removed : 0;
    return { path, added, removed };
  });

  const added = files.reduce((n, f) => n + f.added, 0);
  const removed = files.reduce((n, f) => n + f.removed, 0);

  return {
    files,
    added,
    removed,
    checks,
    didWork: files.length > 0 || checks.length > 0,
  };
}
