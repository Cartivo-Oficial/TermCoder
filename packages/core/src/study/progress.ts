import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { configFile } from "../util/paths";

export interface Progress {
  streak: number;
  lastReviewDate: string; // YYYY-MM-DD
  reviewsByDate: Record<string, number>;
  totalReviews: number;
}

function blank(): Progress {
  return { streak: 0, lastReviewDate: "", reviewsByDate: {}, totalReviews: 0 };
}

function file(env: NodeJS.ProcessEnv): string {
  return configFile("progress.json", env);
}

function dayOf(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function loadProgress(env: NodeJS.ProcessEnv = process.env): Progress {
  try {
    const f = file(env);
    if (!existsSync(f)) return blank();
    return { ...blank(), ...(JSON.parse(readFileSync(f, "utf8")) as Partial<Progress>) };
  } catch {
    return blank();
  }
}

function save(p: Progress, env: NodeJS.ProcessEnv): void {
  const f = file(env);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(p, null, 2), "utf8");
}

export function recordReview(env: NodeJS.ProcessEnv = process.env, now = Date.now()): Progress {
  const p = loadProgress(env);
  const day = dayOf(now);
  if (p.lastReviewDate !== day) {
    p.streak = p.lastReviewDate === previousDay(day) ? p.streak + 1 : 1;
    p.lastReviewDate = day;
  } else if (p.streak === 0) {
    p.streak = 1;
  }
  p.reviewsByDate[day] = (p.reviewsByDate[day] ?? 0) + 1;
  p.totalReviews += 1;
  save(p, env);
  return p;
}

export function reviewsToday(env: NodeJS.ProcessEnv = process.env, now = Date.now()): number {
  return loadProgress(env).reviewsByDate[dayOf(now)] ?? 0;
}
