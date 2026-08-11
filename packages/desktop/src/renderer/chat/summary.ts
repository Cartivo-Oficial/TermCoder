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

export interface TurnClock {
  start: number;
  end?: number;
}

export interface TurnCard {
  start: number;
  anchor: number;
  summary: TurnSummary;
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

export function splitPath(path: string): { dir: string; base: string } {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (cut < 0) return { dir: "", base: path };
  return { dir: path.slice(0, cut + 1), base: path.slice(cut + 1) };
}

export function turnTitle(text: string, limit = 72): string {
  const first = text.split("\n").find((line) => line.trim().length > 0);
  if (!first) return "";

  const flat = first.trim().replace(/\s+/g, " ");
  if (flat.length <= limit) return flat;

  return `${flat.slice(0, limit - 1).trimEnd()}…`;
}

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  return `${minutes}m ${String(whole % 60).padStart(2, "0")}s`;
}

export function formatStamp(clock: TurnClock | undefined): string | undefined {
  if (!clock?.end) return undefined;
  const at = new Date(clock.end);
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  const took = Math.max(0, Math.round((clock.end - clock.start) / 1000));
  return `${hh}:${mm} · ${formatDuration(took)}`;
}

export function elapsedSeconds(clock: TurnClock | undefined, now: number): number | undefined {
  if (!clock) return undefined;
  return Math.max(0, ((clock.end ?? now) - clock.start) / 1000);
}

export function lastUserIndex(messages: SummaryInput[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return i;
  }
  return -1;
}

export function turnCards(messages: SummaryInput[]): Map<number, TurnCard> {
  const cards = new Map<number, TurnCard>();
  let start = -1;

  const close = (end: number) => {
    if (start < 0) return;

    let anchor = -1;
    for (let i = start; i < end; i++) {
      if (messages[i]?.role === "assistant") anchor = i;
    }
    if (anchor < 0) return;

    const summary = turnSummary(messages.slice(start, end));
    if (!summary.didWork) return;

    cards.set(anchor, { start, anchor, summary });
  };

  messages.forEach((message, i) => {
    if (message.role !== "user") return;
    close(i);
    start = i;
  });
  close(messages.length);

  return cards;
}
