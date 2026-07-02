import { readdirSync } from "node:fs";
import { join } from "node:path";

const IGNORE = new Set([
  "node_modules", ".git", "dist", "out", "release", ".next", ".turbo", ".cache", "coverage",
]);

/**
 * A capped, ignore-aware list of workspace files (forward-slash relative paths),
 * for `@file` mention completion. Walks breadth-limited so a huge repo doesn't
 * stall the UI.
 */
export function listProjectFiles(cwd: string, cap = 4000): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string, depth: number) => {
    if (out.length >= cap || depth > 8) return;
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (IGNORE.has(ent.name) || ent.name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(join(dir, ent.name), childRel, depth + 1);
      else {
        out.push(childRel);
        if (out.length >= cap) return;
      }
    }
  };
  walk(cwd, "", 0);
  return out;
}

/** Rank files for a mention query: basename prefix > path substring > subsequence. */
export function matchFiles(files: string[], query: string, limit = 8): string[] {
  const q = query.toLowerCase();
  if (!q) return files.slice(0, limit);
  const scored: Array<{ f: string; score: number }> = [];
  for (const f of files) {
    const lower = f.toLowerCase();
    const base = lower.slice(lower.lastIndexOf("/") + 1);
    let score = -1;
    if (base.startsWith(q)) score = 4;
    else if (base.includes(q)) score = 3;
    else if (lower.includes(q)) score = 2;
    else if (isSubsequence(q, lower)) score = 1;
    if (score >= 0) scored.push({ f, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.f.length - b.f.length)
    .slice(0, limit)
    .map((s) => s.f);
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}
