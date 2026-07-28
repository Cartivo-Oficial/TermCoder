import type { PatchHunk } from "@termcoder/core";

export interface PendingChange {
  id: string;
  title: string;
  detail?: string;
  target?: string;
  kind: string;
  patch?: PatchHunk[];
}

export interface ReviewQueue {
  items: PendingChange[];
}

export function enqueue(q: ReviewQueue, item: PendingChange): ReviewQueue {
  if (q.items.some((i) => i.id === item.id)) return q;
  return { items: [...q.items, item] };
}

export function resolveItem(q: ReviewQueue, id: string): ReviewQueue {
  return { items: q.items.filter((i) => i.id !== id) };
}

export function resolveAll(q: ReviewQueue): { next: ReviewQueue; ids: string[] } {
  return { next: { items: [] }, ids: q.items.map((i) => i.id) };
}

export function findByTarget(q: ReviewQueue, target: string): PendingChange | undefined {
  return q.items.find((i) => i.target === target);
}
