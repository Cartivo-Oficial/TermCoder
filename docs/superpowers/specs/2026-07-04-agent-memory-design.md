# Agent Memory — Design

**Status:** approved (brainstorming) — ready for an implementation plan.
**Date:** 2026-07-04
**Theme:** "Smarter AI" mega-update, piece 1 of 4 (memory → retrieval → Claude OAuth → git/run tools).

## Goal

Give termcoder a persistent, agent-writable **memory** it carries across sessions, so it remembers what it learns about a project and about the user, and recalls the relevant bits automatically. Because the default model is small and keyless, giving it the *right context* is the highest-leverage way to make it smarter — memory benefits the free model most.

## Decisions (locked in brainstorming)

- **Write model: hybrid.** The agent saves durable facts on its own, and the user can save/edit/delete explicitly. The user can always correct it.
- **Scope: project + user.** Project memory is about *this repo*; user memory is global preferences that apply everywhere.
- **Project memory is git-shared** (`.termcoder/memory/`, committed by default) so collaborators and classmates inherit what the agent learned. **User memory is always private** (config dir).
- **Recall v1: index always + bodies within a budget.** No embeddings in v1 (that is piece 2, "retrieval").

## Architecture

Mirrors the existing `skill/skills.ts` pattern (discover markdown files with front matter, build a compact menu, load bodies on demand) and the config-dir store pattern (`util/paths.ts`).

### 1. Storage format

Each memory is one markdown file with YAML front matter, one fact per file.

```markdown
---
name: uses-pnpm
description: This project uses pnpm workspaces, not npm.
type: project
---
Run scripts with `pnpm --filter <pkg> <script>`. The lockfile is pnpm-lock.yaml;
never generate a package-lock.json.
```

- `name` — kebab-case slug; also the filename (`<name>.md`).
- `description` — one line; this is what appears in the always-injected index and is how relevance reads at a glance.
- `type` — `project` (a fact about the repo), `preference` (a user preference), or `decision` (a choice made and why).
- Body — the fact itself.

Locations:
- **Project:** `.termcoder/memory/*.md` (committed with the repo).
- **User:** `<configDir>/memory/*.md` (private; `configDir` from `util/paths.ts`).

On a name conflict, project memory overrides user memory (same precedence as skills/agents).

### 2. Core module — `packages/core/src/memory/memory.ts` (new)

Interfaces (mirror `skills.ts`):

```ts
export type MemoryScope = "project" | "user";
export type MemoryType = "project" | "preference" | "decision";

export interface MemoryEntry {
  name: string;
  description: string;
  type: MemoryType;
  body: string;
  scope: MemoryScope;
  file: string;      // absolute path
  updatedAt: number; // file mtime, for recall recency ordering
}

export interface DiscoverMemoriesOptions { cwd: string; configDir?: string }

export function discoverMemories(opts: DiscoverMemoriesOptions): MemoryEntry[];
export function saveMemory(opts: {
  scope: MemoryScope; name: string; description: string; type: MemoryType; body: string;
  cwd: string; configDir?: string;
}): MemoryEntry;
export function deleteMemory(opts: { name: string; cwd: string; configDir?: string }): boolean;
export function memoryIndex(mems: MemoryEntry[]): string;      // one line per memory
export function recallMemories(mems: MemoryEntry[], budgetChars: number): string;
```

- `discoverMemories` — reads both dirs (reusing the existing front-matter parser in `util/frontmatter.ts`), project overriding user by `name`. Skips malformed files rather than throwing.
- `saveMemory` — writes/overwrites `<dir>/<name>.md`; creates the dir if missing; slugifies `name`; refuses to write if the body matches a secret pattern (see Security).
- `memoryIndex` — compact string, e.g. `- uses-pnpm — This project uses pnpm workspaces, not npm.` one per line, grouped nothing fancy. Empty string when there are no memories.
- `recallMemories(mems, budget)` — returns the index, then appends full bodies (newest `updatedAt` first) until the running character count would exceed `budget`; memories whose bodies didn't fit are still listed in the index and loadable via the tool.

### 3. Recall injection — `session.ts`

In `Session.prompt`, alongside `loadProjectContext`, discover memories once per turn and inject `recallMemories(mems, budget)` into the system prompt under a clear header, e.g.:

```
What you remember about this project and user (keep it in mind; load more with the memory tool):
<memory-index-and-budgeted-bodies>
```

- Budget default: `config.context?.memoryChars ?? 4000`. Added to the existing `context` config block next to `maxToolOutputChars` / `keepRecentToolResults`.
- Skipped when there are no memories (no empty header).
- Applies to every persona (coder and study) — a student's preferences and a course's facts are memory too.

### 4. Tool — `packages/core/src/tools/memory.ts` (new builtin, read/write, like `skill`)

A single `memory` tool with a `command` field:
- `save` — `{ scope, name, description, type, body }` → `saveMemory`. This is how the agent stores a durable fact on its own.
- `read` — `{ name }` → the full body (on-demand load for a memory that didn't fit the budget).
- `list` — returns the index (rarely needed since it is already injected, but lets the agent enumerate).
- `delete` — `{ name }` → `deleteMemory`.

Registered in `builtinTools`. The coder/study system prompt gains a short instruction block: save **few, high-value, durable** facts (a project convention, an architectural truth, a stated user preference, a decision and its reason); do **not** store secrets, transient task state, or anything you can re-read from the code; prefer updating an existing memory over adding a near-duplicate.

### 5. User-facing controls

- **TUI** (`commands.ts` + `app.tsx`):
  - `/remember <text>` — saves a memory. Defaults to `user` scope + `preference` type for a bare note; `/remember project <text>` targets project scope. (The agent may also derive a better `name`/`description`; the command path stores a simple one immediately.)
  - `/memories` — prints the index with scope tags.
  - `/forget <name>` — deletes a memory.
- **Desktop** — a **Memory** settings tab: list (with scope + type badges), inline edit, delete, add, and a project/user scope toggle. Talks to new server routes.
- **Server** — `GET /memory` (list), `POST /memory` (save), `DELETE /memory/:name`, guarded like the other config-dir routes. Project scope writes into the served project's `.termcoder/memory/`.

### 6. Security & limits

- **Secrets never stored.** `saveMemory` rejects bodies that match common secret shapes (API-key prefixes `sk-`, `AIza`, `ghp_`, long high-entropy tokens, `PRIVATE KEY`), and the tool prompt forbids it. Mirrors the sync/secrets rule.
- **User memory stays private** (config dir, never synced in v1, never committed).
- **Project memory is reviewable** — it is plain markdown in the repo, so it shows up in `git diff` before the user commits it.

### 7. Out of scope (later pieces / follow-ups)

- **Embedding/relevance retrieval** — piece 2 of the theme; v1 recall is index + budgeted bodies only.
- **Syncing user memory across machines** — the current sync layer mirrors single JSON files, not a directory of markdown; deferred. Project memory already travels via git.
- **Automatic memory compaction/summarization** — not needed at v1 memory counts.

### 8. Testing

- `memory/memory.test.ts` — save→discover round-trip (both scopes, project overrides user), front-matter parse, `deleteMemory`, `memoryIndex` formatting, `recallMemories` budget behavior (bodies included newest-first until the budget, rest index-only), and `saveMemory` rejecting a secret-shaped body.
- `tools/memory.test.ts` — the tool's save/read/list/delete commands.
- A session test (capturing runner) asserting the memory index reaches `opts.system` when memories exist, and that the header is absent when none do.
- Server route tests for `GET/POST/DELETE /memory` (shape + guards), matching the existing server test style.

## File summary

- New: `packages/core/src/memory/memory.ts` (+ test), `packages/core/src/tools/memory.ts` (+ test).
- Modify: `packages/core/src/session/session.ts` (inject recall + prompt instruction), `packages/core/src/tools/index.ts` (register), `packages/core/src/config/config.ts` (`context.memoryChars`), `packages/core/src/index.ts` (exports), `packages/server/src/server.ts` (`/memory` routes), `packages/tui/src/commands.ts` + `app.tsx` (`/remember`, `/memories`, `/forget`), `packages/desktop/src/renderer/Settings.tsx` (+ i18n) for the Memory tab, `docs/configuration.md` (a Memory section).
