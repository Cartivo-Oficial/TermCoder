# Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every coding turn, automatically point the model at the files most relevant to the prompt — pointers only, gated by relevance — so even the small free model starts in the right place.

**Architecture:** A pure `knowledge/retrieval.ts` module: `tokenize` (camel/snake-aware), `buildRetrievalIndex` (bounded ignore-aware walk reusing symbols.ts's sets), `rankFiles` (BM25-lite), `retrievalContext` (file pointers + up to 4 matched symbols each, empty below a relevance floor). The session builds the index lazily once per session and injects the block next to the memory recall, coder personas only.

**Tech Stack:** TypeScript, Node built-ins only, Vitest.

## Global Constraints

- **No new runtime dependencies. No embeddings.** Lexical only.
- **Comment-free code** (user rule).
- **Pointers, not bodies** — the injected block never contains file contents.
- **Gated:** nothing is injected when no file clears the floor (score ≥ 25% of the top score, top > 0).
- Config: `context.retrievalFiles` default `8`, next to `memoryChars`.
- Study persona never gets retrieval. Index built lazily once per Session instance.
- Node ≥ 20, ESM, tests colocated, typecheck clean (`noUncheckedIndexedAccess`). Never edit via PowerShell.
- **No version bump** — the bundle ships versioned later. Suite currently 254 green; keep it green.

---

### Task 1: The retrieval module (pure)

**Files:**
- Modify: `packages/core/src/knowledge/symbols.ts` (export the two sets)
- Create: `packages/core/src/knowledge/retrieval.ts`
- Test: `packages/core/src/knowledge/retrieval.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `SymbolEntry` from `./symbols`; the `IGNORE` and `SOURCE_EXT` sets (exported by this task).
- Produces:
  - `interface RetrievalIndex { files: Array<{ file: string; terms: Map<string, number>; length: number }>; df: Map<string, number>; totalFiles: number }`
  - `tokenize(text: string): string[]`
  - `buildRetrievalIndex(cwd: string, fileCap?: number): RetrievalIndex` (default cap 2000)
  - `rankFiles(index: RetrievalIndex, query: string, limit?: number): Array<{ file: string; score: number }>` (default 8)
  - `retrievalContext(index: RetrievalIndex, symbols: SymbolEntry[], query: string, maxFiles: number): string`

- [ ] **Step 1: Export the walker sets.** In `packages/core/src/knowledge/symbols.ts`, change `const IGNORE` and `const SOURCE_EXT` to `export const IGNORE` / `export const SOURCE_EXT` (bodies unchanged).

- [ ] **Step 2: Write the failing test**

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildRetrievalIndex, rankFiles, retrievalContext, tokenize } from "./retrieval";
import type { SymbolEntry } from "./symbols";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-retr-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "src", "billing.ts"),
    "export function processInvoice(customerId: string) {\n  return chargeCustomer(customerId);\n}\nfunction chargeCustomer(id: string) {\n  return id;\n}\n",
  );
  writeFileSync(
    join(dir, "src", "greeting.ts"),
    "export function sayHello(name: string) {\n  return `hello ${name}`;\n}\n",
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("tokenize", () => {
  it("splits camelCase and snake_case and drops stopwords and short tokens", () => {
    expect(tokenize("parseFrontmatter and the snake_case_id")).toEqual([
      "parse", "frontmatter", "snake", "case",
    ]);
  });
  it("returns [] for stopword-only text", () => {
    expect(tokenize("the and for with")).toEqual([]);
  });
});

describe("buildRetrievalIndex + rankFiles", () => {
  it("ranks the file containing the query terms first", () => {
    const index = buildRetrievalIndex(dir);
    expect(index.totalFiles).toBe(2);
    const ranked = rankFiles(index, "fix the processInvoice charge logic");
    expect(ranked[0]?.file).toBe("src/billing.ts");
  });
  it("returns [] for an empty or stopword-only query", () => {
    const index = buildRetrievalIndex(dir);
    expect(rankFiles(index, "")).toEqual([]);
    expect(rankFiles(index, "the and")).toEqual([]);
  });
});

describe("retrievalContext", () => {
  const symbols: SymbolEntry[] = [
    { name: "processInvoice", kind: "function", file: "src/billing.ts", line: 1 },
    { name: "chargeCustomer", kind: "function", file: "src/billing.ts", line: 4 },
    { name: "sayHello", kind: "function", file: "src/greeting.ts", line: 1 },
  ];
  it("lists relevant files with symbol pointers, never bodies", () => {
    const index = buildRetrievalIndex(dir);
    const block = retrievalContext(index, symbols, "fix the processInvoice charge logic", 8);
    expect(block).toContain("src/billing.ts");
    expect(block).toContain("processInvoice:1");
    expect(block).not.toContain("customerId");
  });
  it("returns empty when nothing clears the floor", () => {
    const index = buildRetrievalIndex(dir);
    expect(retrievalContext(index, symbols, "unrelated zebra astronomy", 8)).toBe("");
  });
  it("respects maxFiles", () => {
    const index = buildRetrievalIndex(dir);
    const block = retrievalContext(index, symbols, "function hello invoice charge", 1);
    expect(block.split("\n").filter((l) => l.startsWith("- ")).length).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run it — FAIL (module missing)**

Run: `npx vitest run packages/core/src/knowledge/retrieval.test.ts`

- [ ] **Step 4: Implement**

```ts
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
  "case", "break", "default", "while", "continue", "throw", "try", "catch",
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
  const lines = kept.map((r) => {
    const matches = symbols
      .filter((s) => s.file === r.file && tokenize(s.name).some((t) => qTokens.has(t)))
      .slice(0, 4)
      .map((s) => `${s.name}:${s.line}`);
    return `- ${r.file}${matches.length ? ` (${matches.join(", ")})` : ""}`;
  });
  return [
    "Files likely relevant to this request (read before guessing; paths are repo-relative):",
    ...lines,
  ].join("\n");
}
```

- [ ] **Step 5: Run it — PASS.** Then export from `packages/core/src/index.ts` near the knowledge exports:

```ts
export {
  buildRetrievalIndex,
  rankFiles,
  retrievalContext,
  tokenize,
  type RetrievalIndex,
} from "./knowledge/retrieval";
```

Run the whole knowledge folder + typecheck: `npx vitest run packages/core/src/knowledge && pnpm --filter @termcoder/core typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/knowledge packages/core/src/index.ts
git commit -m "feat(core): lexical retrieval — BM25-lite file ranking with symbol pointers"
```

---

### Task 2: Session wiring + config knob

**Files:**
- Modify: `packages/core/src/config/config.ts` (add `retrievalFiles` after `memoryChars`, ~line 138)
- Modify: `packages/core/src/session/session.ts`
- Test: `packages/core/src/session/session.test.ts`

**Interfaces:**
- Consumes: `buildRetrievalIndex`, `retrievalContext`, `RetrievalIndex` (Task 1); `buildSymbolIndex`, `SymbolEntry` from `../knowledge/symbols`.
- Behaviour: coder-persona turns (i.e. `persona !== "study"`) get the retrieval block injected next to `memoryRecall`; the index is built lazily once per Session instance; nothing is injected when nothing clears the floor.

- [ ] **Step 1: Add the config knob** in `packages/core/src/config/config.ts`, inside `context` after `memoryChars`:

```ts
      retrievalFiles: z.number().int().positive().default(8),
```

- [ ] **Step 2: Write the failing test** in `packages/core/src/session/session.test.ts` (uses the file's `makeSession`/`collect`/`dir` helpers):

```ts
it("injects retrieval file pointers for a matching prompt, and nothing otherwise", async () => {
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "src", "billing.ts"),
    "export function processInvoice(customerId: string) {\n  return customerId;\n}\n",
  );
  let captured = "";
  const runner: ModelRunner = (opts) => {
    captured = opts.system;
    async function* stream() { yield { type: "text-delta", text: "ok" }; }
    return { fullStream: stream(), response: Promise.resolve({ messages: [] }), finishReason: Promise.resolve("stop"), toolCalls: Promise.resolve([]) };
  };
  await collect(makeSession(runner), "update the processInvoice billing logic");
  expect(captured).toContain("Files likely relevant");
  expect(captured).toContain("src/billing.ts");

  await collect(makeSession(runner), "qwzx vbnm asdf");
  expect(captured).not.toContain("Files likely relevant");
});
```

Also extend the existing `it("uses the termexplorer study persona …")` test with one assertion at its end (the study persona must never get retrieval):

```ts
    expect(captured).not.toContain("Files likely relevant");
```

- [ ] **Step 3: Run it — FAIL.** `npx vitest run packages/core/src/session/session.test.ts -t "retrieval file pointers"`

- [ ] **Step 4: Implement.** In `session.ts`:

Imports (extend the knowledge import at the top; `projectSummary` is already imported from `../knowledge/repomap`):

```ts
import { buildRetrievalIndex, retrievalContext, type RetrievalIndex } from "../knowledge/retrieval";
import { buildSymbolIndex, type SymbolEntry } from "../knowledge/symbols";
```

Class fields (next to `private _checkpoint?: CheckpointManager;` at ~line 249):

```ts
  private _retrievalIndex?: RetrievalIndex;
  private _symbolIndex?: SymbolEntry[];
```

In `prompt`, right after the `memoryRecall` computation (~line 402), add:

```ts
    let retrievalHints = "";
    if (persona !== "study") {
      this._retrievalIndex ??= buildRetrievalIndex(ctx.cwd);
      this._symbolIndex ??= buildSymbolIndex(ctx.cwd);
      retrievalHints = retrievalContext(
        this._retrievalIndex,
        this._symbolIndex,
        text,
        this.deps.config.context?.retrievalFiles ?? 8,
      );
    }
```

In the system string (~line 451), add after the memoryRecall segment:

```ts
              (retrievalHints ? `\n\n${retrievalHints}` : "") +
```

- [ ] **Step 5: Run the whole session file + typecheck + build — PASS.**

Run: `npx vitest run packages/core/src/session/session.test.ts && pnpm --filter @termcoder/core typecheck && pnpm --filter @termcoder/core build`

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/config/config.ts packages/core/src/session/session.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): auto-inject retrieval pointers into coding turns"
```

---

### Task 3: Docs + full verification (no version bump, no push)

**Files:**
- Modify: `docs/configuration.md`

- [ ] **Step 1: Docs.** In `docs/configuration.md`, add to the "Token economy" area (or right after the Memory section if no better anchor) a short block:

```markdown
## Retrieval

On every coding turn termcoder ranks your repo's files against your request (lexically —
nothing leaves your machine) and hands the model a short list of likely-relevant files and
symbols. Pointers only, never file bodies, and only when the match is confident — so the
model reads the right code instead of guessing, without bloating your context. Tune the
list length with `context.retrievalFiles` (default 8).
```

- [ ] **Step 2: Full verification**

```bash
pnpm -r build && pnpm -r typecheck && npx vitest run
```
Expected: all green (254 + the new retrieval/session tests).

- [ ] **Step 3: Live smoke** (this repo is large enough to be meaningful):

```bash
node -e "const m=require('./packages/core/dist/index.js');const i=m.buildRetrievalIndex(process.cwd());const s=m.buildSymbolIndex(process.cwd());console.log('files indexed:',i.totalFiles);console.log(m.retrievalContext(i,s,'fix the provider probe health routing',8));"
```
Expected: prints a block listing `packages/core/src/provider/provider.ts` (or health/registry) with symbol pointers.

- [ ] **Step 4: Commit (do NOT push — final review first)**

```bash
git add -A
git commit -m "feat: retrieval — the right files in context automatically"
```
