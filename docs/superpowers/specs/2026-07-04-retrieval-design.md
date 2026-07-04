# Retrieval — the right code in context, automatically — Design

**Status:** approved (brainstorming) — ready for an implementation plan.
**Date:** 2026-07-04
**Bundle:** "O Motor" mega update, piece 2. Pairs with memory (shipped v0.7.0): memory recalls what the agent learned; retrieval finds the right code for THIS prompt.

## Goal

On every user turn, automatically point the model at the files most relevant to the prompt — so even the small free model (and any model in a large repo) starts in the right place instead of guessing. Lexical ranking only: **no embeddings, no new dependencies** (keyless/local-first constraint).

## Decisions

- **Pointers, not bodies.** The injected block lists files + matched symbols (`path (symbols: a, b)`) — never file contents. The agent reads what it decides to read; the small model's context stays protected.
- **Auto-injected like memory recall**, gated by relevance: nothing is injected when the prompt doesn't produce a confident match (no noise).
- **BM25-lite lexical ranking** over a bounded, ignore-aware scan (same limits philosophy as `knowledge/symbols.ts`), plus the existing symbol index for symbol-level pointers.
- **Index built lazily once per session** (first prompt), cached on the Session instance; a new session rebuilds.
- **Comment-free code** (user rule).

## Architecture

### `packages/core/src/knowledge/retrieval.ts` (new)

```ts
export interface RetrievalIndex {
  files: Array<{ file: string; terms: Map<string, number>; length: number }>;
  df: Map<string, number>;
  totalFiles: number;
}
export function tokenize(text: string): string[];
export function buildRetrievalIndex(cwd: string, fileCap?: number): RetrievalIndex;
export function rankFiles(index: RetrievalIndex, query: string, limit?: number): Array<{ file: string; score: number }>;
export function retrievalContext(
  index: RetrievalIndex,
  symbols: SymbolEntry[],
  query: string,
  maxFiles: number,
): string;
```

- `tokenize`: lowercase; split on non-alphanumerics **and** camelCase/snake_case boundaries (`parseFrontmatter` → `parse`, `frontmatter`); drop stopwords (a small English+code set: `the, and, for, this, that, with, from, function, const, return, import, export…`) and tokens shorter than 3 chars.
- `buildRetrievalIndex`: walk with the same IGNORE set / depth / fileCap discipline as `buildSymbolIndex` (reuse or mirror its walker); per source file, term frequencies from the file's text + its path segments; track document frequency. Skip files > 400KB.
- `rankFiles`: BM25-lite — `score(file) = Σ_t idf(t) · tf / (tf + k·(len/avgLen))` with `k=1.2`; `idf = ln(1 + (N - df + 0.5)/(df + 0.5))`. Empty/stopword-only queries → `[]`.
- `retrievalContext`: top `maxFiles` ranked files **whose score clears a floor relative to the best score** (e.g. ≥ 25% of top score, and top score > 0); for each, up to 4 matching symbols from the symbol index (`name:line`); returns a compact block or `""`:

```
Files likely relevant to this request (read before guessing; paths are repo-relative):
- src/provider/provider.ts (resolveModel:117, pickAutoModel:64)
- src/provider/registry.ts (PROVIDERS:12)
```

### Session integration (`session.ts`)

- Lazy per-session cache: `this._retrieval ??= buildRetrievalIndex(cwd)` and `this._symbols ??= buildSymbolIndex(cwd)` computed on first prompt (coder personas only; skipped for the study persona — schoolwork isn't a repo).
- Each user turn: `retrievalContext(index, symbols, userText, config.context.retrievalFiles ?? 8)` injected next to the memory recall block. Empty string → nothing injected.
- Config: `context.retrievalFiles` (int, default 8) beside `memoryChars`.

## Out of scope

Embeddings/semantic rerank (later, if ever); an on-demand `search` tool (auto-inject + existing `grep`/`symbols`/`read` cover it); watching the filesystem to update the index mid-session.

## Testing

- `tokenize`: camel/snake splitting, stopword and short-token removal.
- `buildRetrievalIndex` + `rankFiles` (temp dir fixtures): file containing the query terms outranks one that doesn't; longer files don't win on raw repetition (length normalization); empty query → [].
- `retrievalContext`: includes matched files + symbol pointers; returns "" when nothing clears the floor; respects `maxFiles`.
- Session test (capturing runner): a prompt naming things from a fixture file gets that file into `opts.system`; an unrelated prompt injects nothing; study persona never injects.
