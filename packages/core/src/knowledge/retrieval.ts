import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IGNORE, SOURCE_EXT, type SymbolEntry } from "./symbols";

export interface RetrievalIndex {
  files: Array<{ file: string; terms: Map<string, number>; length: number }>;
  df: Map<string, number>;
  totalFiles: number;
}

const STOPWORDS = new Set([
  "the", "and", "for", "not", "with", "from", "this", "that", "are", "was", "were",
  "have", "has", "had", "you", "your", "our", "its", "can", "will", "should", "would",
  "function", "const", "return", "import", "export", "class", "interface", "type",
  "let", "var", "new", "async", "await", "public", "private", "static", "void",
  "null", "undefined", "true", "false", "string", "number", "boolean", "else",
  "break", "default", "while", "continue", "throw", "try", "catch",
  "fix", "add", "make", "use", "get", "set", "please", "como", "para", "uma",
]);

export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function buildRetrievalIndex(cwd: string, fileCap = 2000): RetrievalIndex {
  const files: RetrievalIndex["files"] = [];
  const df = new Map<string, number>();

  const indexFile = (abs: string, rel: string) => {
    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      return;
    }
    if (text.length > 400_000) return;
    const tokens = tokenize(`${rel.replace(/[\\/]/g, " ")} ${text}`);
    if (tokens.length === 0) return;
    const terms = new Map<string, number>();
    for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1);
    for (const t of terms.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    files.push({ file: rel, terms, length: tokens.length });
  };

  const walk = (dirPath: string, rel: string, depth: number) => {
    if (files.length >= fileCap || depth > 8) return;
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (IGNORE.has(ent.name) || ent.name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walk(join(dirPath, ent.name), childRel, depth + 1);
      } else if (SOURCE_EXT.has(extensionOf(ent.name))) {
        if (files.length >= fileCap) return;
        indexFile(join(dirPath, ent.name), childRel);
      }
    }
  };
  walk(cwd, "", 0);
  return { files, df, totalFiles: files.length };
}

export function rankFiles(
  index: RetrievalIndex,
  query: string,
  limit = 8,
): Array<{ file: string; score: number }> {
  const qTokens = [...new Set(tokenize(query))];
  if (qTokens.length === 0 || index.files.length === 0) return [];
  const n = index.files.length;
  const avgLen = index.files.reduce((s, f) => s + f.length, 0) / n || 1;
  const scored: Array<{ file: string; score: number }> = [];
  for (const f of index.files) {
    let score = 0;
    for (const t of qTokens) {
      const tf = f.terms.get(t) ?? 0;
      if (!tf) continue;
      const dft = index.df.get(t) ?? 1;
      const idf = Math.log(1 + (n - dft + 0.5) / (dft + 0.5));
      score += idf * (tf / (tf + 1.2 * (f.length / avgLen)));
    }
    if (score > 0) scored.push({ file: f.file, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function retrievalContext(
  index: RetrievalIndex,
  symbols: SymbolEntry[],
  query: string,
  maxFiles: number,
): string {
  const ranked = rankFiles(index, query, maxFiles);
  const top = ranked[0]?.score ?? 0;
  if (top <= 0) return "";
  const kept = ranked.filter((r) => r.score >= top * 0.25);
  if (kept.length === 0) return "";
  const qTokens = new Set(tokenize(query));
  const symbolsByFile = new Map<string, SymbolEntry[]>();
  for (const s of symbols) {
    const bucket = symbolsByFile.get(s.file);
    if (bucket) bucket.push(s);
    else symbolsByFile.set(s.file, [s]);
  }
  const lines = kept.map((r) => {
    const matches = (symbolsByFile.get(r.file) ?? [])
      .filter((s) => tokenize(s.name).some((t) => qTokens.has(t)))
      .slice(0, 4)
      .map((s) => `${s.name}:${s.line}`);
    return `- ${r.file}${matches.length ? ` (${matches.join(", ")})` : ""}`;
  });
  return [
    "Files likely relevant to this request (read before guessing; paths are repo-relative):",
    ...lines,
  ].join("\n");
}
