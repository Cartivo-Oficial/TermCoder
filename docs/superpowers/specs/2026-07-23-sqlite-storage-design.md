# Local SQLite session storage

Date: 2026-07-23
Status: approved design, pending implementation plan
Package: `@termcoder/core` (with a desktop-packaging note)

## Summary

Replace the JSON-file-per-session `SessionStore` with a normalized local
SQLite database (`better-sqlite3`), keeping the exact public API so no caller
changes. Add fast SQL `list`/`load`, a new `search(query)` over titles and
message text, and a one-time idempotent migration of existing JSON sessions.

## Goals

- Same public `SessionStore` API (`create/exists/save/import/load/delete/deleteAll/list`) — the only caller, `packages/server/src/server.ts:150` (`new SessionStore()`), is untouched.
- Normalized schema: `sessions` (metadata columns) + `messages` (one row per message).
- `list()` becomes a single SQL query (no reading every file); `load()` reconstructs a `SessionRecord` from rows.
- New `search(query): SessionSummary[]` — sessions whose title OR any message text matches (case-insensitive substring).
- One-time, idempotent migration importing legacy `<baseDir>/*.json` files.
- No behavior change visible to the model or the UI beyond the new search capability.

## Non-goals

- No FTS5, no `appendMessage` O(1) fast-path, no cross-device sync (all deferred — the user chose the "normalized + search" scope, not "full").
- No schema for canvas/agent graphs or anything beyond sessions+messages.
- No ORM (Drizzle) — raw `better-sqlite3` prepared statements.

## Existing context

- `packages/core/src/storage/storage.ts` — `SessionStore` (JSON file per
  session under `~/.termcoder/sessions/<id>.json`; `save` rewrites the whole
  file; `list` reads+parses every file). Types `SessionRecord`
  (`id, title, createdAt, updatedAt, cwd, model, mode?, agent?, temperature?,
  maxSteps?, messages: ModelMessage[], usage?: {tokensIn, tokensOut}`) and
  `SessionSummary` (`id, title, createdAt, updatedAt, cwd, model, messageCount,
  usage?`). `defaultSessionsDir(env)` → `~/.termcoder/sessions` (or
  `$TERMCODER_DATA_DIR/sessions`).
- `messages` are `ModelMessage` (from the `ai` SDK): `content` is a string or
  an array of parts.
- Constructed only in `server.ts:150`. Tests: `storage.test.ts` exercises the
  full API.
- Desktop native strategy: prebuilt per-platform binaries (`@lydell/node-pty*`
  staged by `scripts/stage-pty.mjs`), NOT `electron-rebuild`.

## Architecture

Three units under `packages/core/src/storage/`:

### `db.ts` — database open + schema
- `openDb(dbPath: string): Database` — opens `better-sqlite3`, sets
  `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, and runs
  `CREATE TABLE IF NOT EXISTS` for the schema below. Returns the handle.
- Schema:
  ```sql
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    cwd TEXT NOT NULL,
    model TEXT NOT NULL,
    mode TEXT,
    agent TEXT,
    temperature REAL,
    maxSteps INTEGER,
    tokensIn INTEGER,
    tokensOut INTEGER
  );
  CREATE TABLE IF NOT EXISTS messages (
    sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    content TEXT NOT NULL,
    text TEXT,
    PRIMARY KEY (sessionId, seq)
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_updatedAt ON sessions(updatedAt);
  ```
- `messageText(m: ModelMessage): string` helper (exported) — extract plain
  text: if `content` is a string, that; if an array, join the `text` of parts
  that have a string `text`, else "".

### `migrate.ts` — one-time JSON import
- `migrateJsonSessions(baseDir: string, store: { exists(id: string): boolean; import(record: SessionRecord): void }): number` —
  for each `<baseDir>/*.json` (skipping `*.json.bak`): parse; if
  `!store.exists(record.id)`, `store.import(record)`; then rename the file to
  `<name>.bak`. Returns the count migrated. Takes the store as a minimal
  interface (imports only the `SessionRecord` type) so there is no circular
  import; the constructor calls `migrateJsonSessions(baseDir, this)` after the
  db is ready.
  Idempotent: once renamed to `.bak`, subsequent runs find no `*.json` and do
  nothing. Malformed JSON is skipped (logged-swallow, same tolerance as today's
  `list`). The `.bak` files are left as a backup (never deleted).

### `storage.ts` — `SessionStore` (rewritten, same API)
- Types `SessionRecord`/`SessionSummary` unchanged (re-exported).
- `defaultSessionsDir` unchanged (still returns the dir; the db lives inside it).
- `constructor(baseDir = defaultSessionsDir())`: `mkdirSync(baseDir)`;
  `this.db = openDb(join(baseDir, "sessions.db"))`; then
  `migrateJsonSessions(this.db, baseDir)` once. Prepared statements cached.
- `create(opts)` → build a `SessionRecord` (new `randomUUID`, timestamps), call
  `save`, return it.
- `save(record)` → **transaction**: `updatedAt = Date.now()`; upsert the
  `sessions` row (`INSERT ... ON CONFLICT(id) DO UPDATE`); `DELETE FROM messages
  WHERE sessionId = ?`; insert each `record.messages[i]` as `(id, i,
  JSON.stringify(m), messageText(m))`. Writes `usage.tokensIn/Out` into the
  `tokensIn/tokensOut` columns.
- `import(record)` → same as `save` but preserves `record.updatedAt`.
- `load(id)` → throw if the session row is absent; select the row + messages
  (ordered by `seq`), `JSON.parse(content)` each into `ModelMessage`,
  reconstruct `SessionRecord` (rebuild `usage` from the two columns).
- `exists(id)` → `SELECT 1 FROM sessions WHERE id = ?`.
- `delete(id)` → `DELETE FROM sessions WHERE id = ?` (cascade removes messages);
  return `changes > 0`.
- `deleteAll()` → count rows, `DELETE FROM sessions`; return the count.
- `list()` → `SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.sessionId =
  s.id) AS messageCount FROM sessions s ORDER BY s.updatedAt DESC` → map to
  `SessionSummary[]` (rebuild `usage`).
- **`search(query: string): SessionSummary[]`** (NEW) → sessions where
  `title LIKE %q%` (case-insensitive via `LIKE`, SQLite default for ASCII) OR
  the session has a message whose `text LIKE %q%`; return the same
  `SessionSummary` shape, ordered by `updatedAt DESC`, deduped by session id.

## Data flow

```
server.ts: new SessionStore()  -> openDb(<baseDir>/sessions.db) + migrate JSONs once
create/save  -> transactional upsert of sessions row + replace messages rows (+ extracted text)
load         -> join sessions + ordered messages -> SessionRecord (parse content JSON)
list         -> single SQL query with message COUNT -> SessionSummary[]
search(q)    -> sessions matching title/message text -> SessionSummary[]
delete       -> cascade
```

## Error handling

- Missing session on `load` → throw `Session not found: <id>` (unchanged message).
- Malformed legacy JSON during migration → skipped, not fatal.
- `messages.content` that fails `JSON.parse` on load (shouldn't happen; we wrote
  it) → skip that message, keep the rest; never throw the whole load.
- All multi-row writes run inside a `better-sqlite3` transaction so a partial
  save can't corrupt a session.

## Desktop packaging (flagged risk, resolved in the plan)

`better-sqlite3` is a native module. The core + server library and their tests
run under Node (vitest env `node`), where `better-sqlite3`'s prebuilt binary
loads fine. Planning determined that the desktop runs the server (and thus `SessionStore`)
IN the Electron main process — `packages/desktop/src/main/index.ts` imports
`createServer` from `@termcoder/server` and calls `server.listen(...)` inline,
not via a Node sidecar. So the native module needs the ELECTRON ABI: the plan
wires `@electron/rebuild` for `better-sqlite3` plus `asarUnpack`, in both dev
and packaging (the node prebuild will not load in Electron). This is a build
concern only; it does not affect the library design or its Node/vitest tests
(which load the Node prebuild). If the rebuild proves insufficient it splits
into a focused follow-up (pin the Electron version, or move the server to a
Node sidecar) without blocking the core storage improvement.

## Testing (vitest, Node env — `better-sqlite3` loads natively)

- `storage.test.ts` (existing) must pass unchanged against the SQLite backend
  (same API), using a temp-dir `baseDir` so each test gets its own `.db`.
- New tests:
  - round-trip: `create` → `save` with messages → `load` returns identical
    `SessionRecord` (messages, usage, all fields).
  - `list` ordering by `updatedAt` and correct `messageCount`.
  - `delete` cascades (messages gone) and `deleteAll` returns the count.
  - `search`: matches by title and by message text; case-insensitive; no dupes
    when multiple messages match; empty query / no match returns [].
  - migration: seed a temp `baseDir` with legacy `<id>.json` files, construct a
    `SessionStore`, assert the sessions are in the db, the files became `.bak`,
    and a second construction is a no-op (idempotent).

Source files carry NO comments (repo rule).

## File layout

```
packages/core/src/storage/
  db.ts            (openDb + schema + messageText; +covered by tests)
  migrate.ts       (migrateJsonSessions; +tests)
  storage.ts       (SessionStore over SQLite; same API + search; +tests)
  storage.test.ts  (existing, extended)
packages/core/package.json   (add better-sqlite3 dependency)
```

## Rollout

Single implementation plan, TDD. The library + tests land first (Node-verified).
The desktop packaging wiring is the last task, gated on determining the sidecar
runtime ABI; if that proves involved, it can split into its own follow-up
without blocking the core storage improvement (the server already runs in Node
in dev).
