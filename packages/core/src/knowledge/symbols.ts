import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SymbolEntry {
  name: string;
  kind: string;
  file: string;
  line: number;
}

export const IGNORE = new Set([
  "node_modules", ".git", "dist", "out", "release", ".next", ".turbo", ".cache",
  "coverage", "vendor", "target", "__pycache__", ".idea", ".vscode",
]);

export const SOURCE_EXT = new Set([
  "ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "java",
  "rb", "php", "c", "h", "cpp", "cc", "hpp", "cs", "kt", "swift",
]);

interface Pattern {
  re: RegExp;
  kind: string;
}

const PATTERNS: Pattern[] = [
  { re: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/, kind: "function" },
  { re: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/, kind: "class" },
  { re: /^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z0-9_]+)/, kind: "type" },
  { re: /^\s*export\s+(?:const|let)\s+([A-Za-z0-9_]+)/, kind: "const" },
  { re: /^\s*def\s+([A-Za-z0-9_]+)/, kind: "def" }, // Python
  { re: /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z0-9_]+)/, kind: "func" }, // Go
  { re: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/, kind: "fn" }, // Rust
  { re: /^\s*(?:pub\s+)?(?:struct|trait)\s+([A-Za-z0-9_]+)/, kind: "type" }, // Rust
];

function extentionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function buildSymbolIndex(cwd: string, fileCap = 2500): SymbolEntry[] {
  const symbols: SymbolEntry[] = [];
  let files = 0;

  const walk = (dir: string, rel: string, depth: number) => {
    if (files >= fileCap || depth > 8 || symbols.length > 20000) return;
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (IGNORE.has(ent.name) || ent.name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walk(join(dir, ent.name), childRel, depth + 1);
      } else if (SOURCE_EXT.has(extentionOf(ent.name))) {
        if (files >= fileCap) return;
        files++;
        indexFile(join(dir, ent.name), childRel, symbols);
      }
    }
  };
  walk(cwd, "", 0);
  return symbols;
}

function indexFile(abs: string, rel: string, out: SymbolEntry[]): void {
  let text: string;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    return;
  }
  if (text.length > 400_000) return; // skip huge/generated files
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const { re, kind } of PATTERNS) {
      const m = re.exec(line);
      if (m?.[1]) {
        out.push({ name: m[1], kind, file: rel, line: i + 1 });
        break; // one definition per line
      }
    }
  }
}

export function findSymbols(index: SymbolEntry[], query: string, limit = 25): SymbolEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<{ s: SymbolEntry; score: number }> = [];
  for (const s of index) {
    const name = s.name.toLowerCase();
    let score = -1;
    if (name === q) score = 4;
    else if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2;
    else if (isSubsequence(q, name)) score = 1;
    if (score >= 0) scored.push({ s, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.s.name.length - b.s.name.length)
    .slice(0, limit)
    .map((x) => x.s);
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}
