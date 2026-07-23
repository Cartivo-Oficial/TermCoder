# SQLite Session Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JSON-file-per-session `SessionStore` with a normalized `better-sqlite3` database, keeping the public API, adding `search`, and migrating existing JSON sessions.

**Architecture:** `db.ts` (open + schema + text extraction), `migrate.ts` (one-time JSON import), `storage.ts` (`SessionStore` over SQLite, same API + `search`). The core library + tests run under Node (vitest env `node`), where `better-sqlite3`'s prebuilt loads. Desktop packaging (Task 4) needs an Electron rebuild because — confirmed during planning — the server runs IN the Electron main process (`packages/desktop/src/main/index.ts:27,71` import `createServer` from `@termcoder/server` and `server.listen(...)` inline), so `SessionStore` runs on the Electron ABI, not a Node sidecar.

**Tech Stack:** `better-sqlite3` (+ `@types/better-sqlite3`), TypeScript strict, vitest (`node` env). `@electron/rebuild` for the desktop (Task 4).

## Global Constraints

- Source files carry NO comments (repo rule). Test files: descriptive names only.
- The public `SessionStore` API stays identical: `create/exists/save/import/load/delete/deleteAll/list` — plus the new `search`. Types `SessionRecord`/`SessionSummary` unchanged. The only production caller is `packages/server/src/server.ts:150` (`new SessionStore()`) and it must not change.
- TypeScript strict.
- Run a single test file with `npx vitest run <path>` from the worktree root.
- Commit after every task.
- `messages` are `ModelMessage` from `"ai"`.

---

### Task 1: better-sqlite3 dependency + `db.ts`

**Files:**
- Modify: `packages/core/package.json` (add deps)
- Create: `packages/core/src/storage/db.ts`
- Test: `packages/core/src/storage/db.test.ts`

**Interfaces:**
- Produces: `openDb(dbPath: string): Database.Database`; `messageText(m: ModelMessage): string`; re-export `type Database = Database.Database`.

- [ ] **Step 1: Add the dependency**

In `packages/core/package.json`, add to `dependencies`: `"better-sqlite3": "^11.8.1"`, and to `devDependencies`: `"@types/better-sqlite3": "^7.6.11"`. Then from the worktree root run `pnpm install` (builds the native prebuild for Node). Expected: install succeeds, `node -e "require('better-sqlite3')"` from `packages/core` prints nothing (no throw).

- [ ] **Step 2: Write the failing test**

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, messageText } from "./db";

describe("openDb", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "tc-db-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("creates the sessions and messages tables", () => {
    const db = openDb(join(dir, "s.db"));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    expect(tables).toContain("sessions");
    expect(tables).toContain("messages");
    db.close();
  });

  it("enables foreign keys and WAL", () => {
    const db = openDb(join(dir, "s.db"));
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(String(db.pragma("journal_mode", { simple: true })).toLowerCase()).toBe("wal");
    db.close();
  });
});

describe("messageText", () => {
  it("returns a string content directly", () => {
    expect(messageText({ role: "user", content: "hello" })).toBe("hello");
  });
  it("joins text parts and ignores non-text parts", () => {
    expect(messageText({ role: "assistant", content: [{ type: "text", text: "a" }, { type: "tool-call" } as any, { type: "text", text: "b" }] })).toBe("a b");
  });
  it("returns empty string for no text", () => {
    expect(messageText({ role: "assistant", content: [{ type: "tool-call" } as any] })).toBe("");
  });
});
```

- [ ] **Step 3: Run test, verify fail** — `npx vitest run packages/core/src/storage/db.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement `db.ts`**

```ts
import Database from "better-sqlite3";
import type { ModelMessage } from "ai";

export type { Database } from "better-sqlite3";

const SCHEMA = `
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
`;

export function openDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function messageText(m: ModelMessage): string {
  const content = (m as { content: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string" ? (p as { text: string }).text : ""))
      .filter((s) => s.length > 0)
      .join(" ");
  }
  return "";
}
```

- [ ] **Step 5: Run test, verify pass.**
- [ ] **Step 6: Commit** — `git add packages/core/package.json pnpm-lock.yaml packages/core/src/storage/db.ts packages/core/src/storage/db.test.ts && git commit -m "feat(storage): better-sqlite3 db opener, schema, and message-text extraction"`

---

### Task 2: JSON migration (`migrate.ts`)

**Files:**
- Create: `packages/core/src/storage/migrate.ts`
- Test: `packages/core/src/storage/migrate.test.ts`

**Interfaces:**
- Produces: `migrateJsonSessions(baseDir: string, store: { exists(id: string): boolean; import(record: SessionRecord): void }): number`
- Consumes: `SessionRecord` (type) from `./storage`.

- [ ] **Step 1: Write the failing test**

```ts
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateJsonSessions } from "./migrate";
import type { SessionRecord } from "./storage";

function rec(id: string): SessionRecord {
  return { id, title: id, createdAt: 1, updatedAt: 2, cwd: "/w", model: "m", messages: [{ role: "user", content: "hi" }] };
}

describe("migrateJsonSessions", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "tc-mig-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("imports new json sessions and renames them to .bak, idempotently", () => {
    writeFileSync(join(dir, "a.json"), JSON.stringify(rec("a")), "utf8");
    writeFileSync(join(dir, "b.json"), JSON.stringify(rec("b")), "utf8");
    const imported: string[] = [];
    const store = { exists: (id: string) => imported.includes(id), import: (r: SessionRecord) => { imported.push(r.id); } };

    expect(migrateJsonSessions(dir, store)).toBe(2);
    expect(imported.sort()).toEqual(["a", "b"]);
    expect(existsSync(join(dir, "a.json"))).toBe(false);
    expect(existsSync(join(dir, "a.json.bak"))).toBe(true);

    expect(migrateJsonSessions(dir, store)).toBe(0);
  });

  it("skips sessions already in the store and malformed json", () => {
    writeFileSync(join(dir, "a.json"), JSON.stringify(rec("a")), "utf8");
    writeFileSync(join(dir, "bad.json"), "{not json", "utf8");
    const store = { exists: (id: string) => id === "a", import: () => { throw new Error("should not import"); } };
    expect(migrateJsonSessions(dir, store)).toBe(0);
    expect(existsSync(join(dir, "a.json.bak"))).toBe(true);
    expect(readdirSync(dir)).toContain("bad.json");
  });
});
```

- [ ] **Step 2: Run test, verify fail.**

- [ ] **Step 3: Implement `migrate.ts`**

```ts
import { existsSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { SessionRecord } from "./storage";

export function migrateJsonSessions(
  baseDir: string,
  store: { exists(id: string): boolean; import(record: SessionRecord): void },
): number {
  if (!existsSync(baseDir)) return 0;
  let migrated = 0;
  for (const name of readdirSync(baseDir)) {
    if (!name.endsWith(".json") || name.endsWith(".json.bak")) continue;
    const full = join(baseDir, name);
    let record: SessionRecord;
    try {
      record = JSON.parse(readFileSync(full, "utf8")) as SessionRecord;
    } catch {
      continue;
    }
    if (!store.exists(record.id)) {
      store.import(record);
      migrated += 1;
    }
    renameSync(full, full + ".bak");
  }
  return migrated;
}
```

- [ ] **Step 4: Run test, verify pass.**
- [ ] **Step 5: Commit** — `git add packages/core/src/storage/migrate.ts packages/core/src/storage/migrate.test.ts && git commit -m "feat(storage): one-time idempotent JSON session migration"`

---

### Task 3: `SessionStore` over SQLite (`storage.ts`)

**Files:**
- Modify (rewrite body, keep types): `packages/core/src/storage/storage.ts`
- Test: `packages/core/src/storage/storage.test.ts` (extend with search + migration + keep existing)

**Interfaces:**
- Public API unchanged + `search(query: string): SessionSummary[]`.
- Consumes: `openDb`, `messageText`, `Database` from `./db`; `migrateJsonSessions` from `./migrate`.

- [ ] **Step 1: Append the new tests to `storage.test.ts`**

```ts
import { writeFileSync, existsSync } from "node:fs";

describe("SessionStore SQLite", () => {
  let dir: string;
  let store: import("./storage").SessionStore;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "tc-sql-")); store = new SessionStore(dir); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("round-trips messages, usage, and metadata", () => {
    const s = store.create({ cwd: "/w", model: "m", mode: "plan", agent: "build", temperature: 0.3, maxSteps: 7 });
    s.messages.push({ role: "user", content: "find the bug" });
    s.messages.push({ role: "assistant", content: "on it" });
    s.usage = { tokensIn: 12, tokensOut: 5 };
    store.save(s);
    const loaded = store.load(s.id);
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages[1]).toMatchObject({ role: "assistant", content: "on it" });
    expect(loaded.usage).toEqual({ tokensIn: 12, tokensOut: 5 });
    expect(loaded.mode).toBe("plan");
    expect(loaded.maxSteps).toBe(7);
  });

  it("lists by updatedAt desc with message counts, and deletes cascade", () => {
    const a = store.create({ cwd: "/w", model: "m" });
    a.messages.push({ role: "user", content: "one" });
    store.save(a);
    const b = store.create({ cwd: "/w", model: "m" });
    store.save(b);
    const list = store.list();
    expect(list[0]!.id).toBe(b.id);
    expect(list.find((x) => x.id === a.id)!.messageCount).toBe(1);
    expect(store.delete(a.id)).toBe(true);
    expect(store.exists(a.id)).toBe(false);
    expect(store.list()).toHaveLength(1);
  });

  it("searches by title and by message text, case-insensitively, no dupes", () => {
    const a = store.create({ cwd: "/w", model: "m", title: "Refactor the parser" });
    a.messages.push({ role: "user", content: "the PARSER keeps crashing" });
    a.messages.push({ role: "assistant", content: "let us fix the parser" });
    store.save(a);
    const b = store.create({ cwd: "/w", model: "m", title: "Unrelated" });
    store.save(b);
    expect(store.search("parser").map((s) => s.id)).toEqual([a.id]);
    expect(store.search("PARSER")).toHaveLength(1);
    expect(store.search("nothing-here")).toEqual([]);
  });

  it("migrates legacy json files on construction", () => {
    const legacy = { id: "legacy-1", title: "Old", createdAt: 1, updatedAt: 2, cwd: "/w", model: "m", messages: [{ role: "user", content: "hi" }] };
    const dir2 = mkdtempSync(join(tmpdir(), "tc-legacy-"));
    writeFileSync(join(dir2, "legacy-1.json"), JSON.stringify(legacy), "utf8");
    const s2 = new SessionStore(dir2);
    expect(s2.exists("legacy-1")).toBe(true);
    expect(s2.load("legacy-1").messages).toHaveLength(1);
    expect(existsSync(join(dir2, "legacy-1.json.bak"))).toBe(true);
    rmSync(dir2, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test, verify the NEW tests fail** (old `save`/`load` still JSON-based; `search` undefined) — `npx vitest run packages/core/src/storage/storage.test.ts`.

- [ ] **Step 3: Rewrite `storage.ts`**

```ts
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ModelMessage } from "ai";
import { openDb, messageText, type Database } from "./db";
import { migrateJsonSessions } from "./migrate";

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  cwd: string;
  model: string;
  mode?: "build" | "plan";
  agent?: string;
  temperature?: number;
  maxSteps?: number;
  messages: ModelMessage[];
  usage?: { tokensIn: number; tokensOut: number };
}

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  cwd: string;
  model: string;
  messageCount: number;
  usage?: { tokensIn: number; tokensOut: number };
}

export function defaultSessionsDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.TERMCODER_DATA_DIR) return join(env.TERMCODER_DATA_DIR, "sessions");
  return join(homedir(), ".termcoder", "sessions");
}

interface SessionRow {
  id: string; title: string; createdAt: number; updatedAt: number; cwd: string; model: string;
  mode: string | null; agent: string | null; temperature: number | null; maxSteps: number | null;
  tokensIn: number | null; tokensOut: number | null;
}

export class SessionStore {
  private readonly db: Database;

  constructor(baseDir: string = defaultSessionsDir()) {
    mkdirSync(baseDir, { recursive: true });
    this.db = openDb(join(baseDir, "sessions.db"));
    migrateJsonSessions(baseDir, this);
  }

  create(opts: {
    cwd: string; model: string; title?: string; mode?: "build" | "plan"; agent?: string; temperature?: number; maxSteps?: number;
  }): SessionRecord {
    const now = Date.now();
    const record: SessionRecord = {
      id: randomUUID(),
      title: opts.title ?? "Untitled session",
      createdAt: now, updatedAt: now,
      cwd: opts.cwd, model: opts.model,
      mode: opts.mode, agent: opts.agent, temperature: opts.temperature, maxSteps: opts.maxSteps,
      messages: [],
    };
    this.save(record);
    return record;
  }

  exists(id: string): boolean {
    return this.db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(id) !== undefined;
  }

  save(record: SessionRecord): void {
    record.updatedAt = Date.now();
    this.write(record);
  }

  import(record: SessionRecord): void {
    this.write(record);
  }

  private write(record: SessionRecord): void {
    const tx = this.db.transaction((r: SessionRecord) => {
      this.db.prepare(
        `INSERT INTO sessions (id, title, createdAt, updatedAt, cwd, model, mode, agent, temperature, maxSteps, tokensIn, tokensOut)
         VALUES (@id, @title, @createdAt, @updatedAt, @cwd, @model, @mode, @agent, @temperature, @maxSteps, @tokensIn, @tokensOut)
         ON CONFLICT(id) DO UPDATE SET title=@title, updatedAt=@updatedAt, cwd=@cwd, model=@model, mode=@mode, agent=@agent, temperature=@temperature, maxSteps=@maxSteps, tokensIn=@tokensIn, tokensOut=@tokensOut`,
      ).run({
        id: r.id, title: r.title, createdAt: r.createdAt, updatedAt: r.updatedAt, cwd: r.cwd, model: r.model,
        mode: r.mode ?? null, agent: r.agent ?? null, temperature: r.temperature ?? null, maxSteps: r.maxSteps ?? null,
        tokensIn: r.usage?.tokensIn ?? null, tokensOut: r.usage?.tokensOut ?? null,
      });
      this.db.prepare("DELETE FROM messages WHERE sessionId = ?").run(r.id);
      const ins = this.db.prepare("INSERT INTO messages (sessionId, seq, content, text) VALUES (?, ?, ?, ?)");
      r.messages.forEach((m, i) => ins.run(r.id, i, JSON.stringify(m), messageText(m)));
    });
    tx(record);
  }

  load(id: string): SessionRecord {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
    if (!row) throw new Error(`Session not found: ${id}`);
    const rows = this.db.prepare("SELECT content FROM messages WHERE sessionId = ? ORDER BY seq ASC").all(id) as { content: string }[];
    const messages: ModelMessage[] = [];
    for (const m of rows) {
      try { messages.push(JSON.parse(m.content) as ModelMessage); } catch { }
    }
    return this.recordFromRow(row, messages);
  }

  delete(id: string): boolean {
    return this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id).changes > 0;
  }

  deleteAll(): number {
    const n = (this.db.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c;
    this.db.prepare("DELETE FROM sessions").run();
    return n;
  }

  list(): SessionSummary[] {
    const rows = this.db.prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.sessionId = s.id) AS messageCount
       FROM sessions s ORDER BY s.updatedAt DESC`,
    ).all() as (SessionRow & { messageCount: number })[];
    return rows.map((r) => this.summaryFromRow(r, r.messageCount));
  }

  search(query: string): SessionSummary[] {
    const like = `%${query}%`;
    const rows = this.db.prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM messages m2 WHERE m2.sessionId = s.id) AS messageCount
       FROM sessions s
       WHERE s.title LIKE ? COLLATE NOCASE
          OR EXISTS (SELECT 1 FROM messages m WHERE m.sessionId = s.id AND m.text LIKE ? COLLATE NOCASE)
       ORDER BY s.updatedAt DESC`,
    ).all(like, like) as (SessionRow & { messageCount: number })[];
    return rows.map((r) => this.summaryFromRow(r, r.messageCount));
  }

  private usageFromRow(row: SessionRow): { tokensIn: number; tokensOut: number } | undefined {
    if (row.tokensIn === null && row.tokensOut === null) return undefined;
    return { tokensIn: row.tokensIn ?? 0, tokensOut: row.tokensOut ?? 0 };
  }

  private recordFromRow(row: SessionRow, messages: ModelMessage[]): SessionRecord {
    return {
      id: row.id, title: row.title, createdAt: row.createdAt, updatedAt: row.updatedAt,
      cwd: row.cwd, model: row.model,
      mode: (row.mode as "build" | "plan" | null) ?? undefined,
      agent: row.agent ?? undefined,
      temperature: row.temperature ?? undefined,
      maxSteps: row.maxSteps ?? undefined,
      messages,
      usage: this.usageFromRow(row),
    };
  }

  private summaryFromRow(row: SessionRow, messageCount: number): SessionSummary {
    return {
      id: row.id, title: row.title, createdAt: row.createdAt, updatedAt: row.updatedAt,
      cwd: row.cwd, model: row.model, messageCount, usage: this.usageFromRow(row),
    };
  }
}
```

- [ ] **Step 4: Run the full storage suite, verify pass** — `npx vitest run packages/core/src/storage/storage.test.ts` → all green (existing + new).
- [ ] **Step 5: Typecheck core** — `cd packages/core && npx tsc --noEmit 2>&1 | grep -E 'storage/' || echo CLEAN` → `CLEAN`.
- [ ] **Step 6: Run the whole storage folder + confirm server still builds** — `npx vitest run packages/core/src/storage` (green); `pnpm --filter @termcoder/server build` (OK — the server imports `SessionStore` unchanged).
- [ ] **Step 7: Commit** — `git add packages/core/src/storage/storage.ts packages/core/src/storage/storage.test.ts && git commit -m "feat(storage): SessionStore backed by SQLite, with search"`

---

### Task 4: Desktop packaging — Electron ABI for better-sqlite3

The server (hence `SessionStore`) runs in the Electron main process, so `better-sqlite3` must be built for Electron's ABI (its Node prebuild won't load in Electron). Wire an Electron rebuild + unpack. Verification here is build-time; final runtime confirmation is the user launching the app.

**Files:**
- Modify: `packages/desktop/package.json` (devDep + scripts + electron-builder `asarUnpack`)

- [ ] **Step 1: Add `@electron/rebuild` and a rebuild script**

In `packages/desktop/package.json`: add devDependency `"@electron/rebuild": "^3.6.0"`. Add a script `"rebuild:native": "electron-rebuild -f -w better-sqlite3"`. Wire it into the dev/build flow by prepending it to `predev`/`package` (mirror the existing `stage:pty` pattern): change `"package"` to `"pnpm stage:pty && pnpm rebuild:native && electron-vite build && electron-builder"` (and the `:ci`/`:dir` variants), and add a `"predev": "pnpm rebuild:native"` if none exists (so `dev` gets the Electron-ABI build).

- [ ] **Step 2: Ensure the native binary is unpacked from asar**

In the electron-builder config block of `packages/desktop/package.json`, add `better-sqlite3` to `asarUnpack` (create the array if absent): `"asarUnpack": ["**/node_modules/better-sqlite3/**"]`. If a `node-pty`/`@lydell` unpack entry already exists, add alongside it.

- [ ] **Step 3: Verify the rebuild runs**

Run from the worktree root: `pnpm --filter @termcoder/desktop rebuild:native`. Expected: `electron-rebuild` completes and reports `better-sqlite3` rebuilt for the desktop's Electron version (no error). If `@electron/rebuild` cannot resolve the Electron version, report the exact error (it may need `--version <electronVersion>` from the desktop's `electron` devDependency) rather than guessing.

- [ ] **Step 4: Build the renderer/main to confirm no packaging regression**

Run from `packages/desktop`: `pnpm build` is heavy (electron-builder); instead run `pnpm exec electron-vite build` to confirm main+preload+renderer bundle with the new dependency graph. Expected: BUILD OK.

- [ ] **Step 5: Commit** — `git add packages/desktop/package.json pnpm-lock.yaml && git commit -m "build(desktop): rebuild and unpack better-sqlite3 for the Electron runtime"`

- [ ] **Step 6: Note for the user** — final runtime verification is `pnpm --filter @termcoder/desktop dev`: the app should start and sessions should list/persist. If `better-sqlite3` fails to load in Electron despite the rebuild, that is the known packaging risk from the spec and becomes a focused follow-up (options: pin `@electron/rebuild` to the Electron version, or move the server to a Node sidecar) — it does not affect the already-verified core storage library.

---

## Self-review notes

- Spec coverage: schema + open (T1/db.ts), text extraction for search (T1/messageText), migration idempotent + `.bak` (T2), SessionStore full API + transactional save + SQL list/load + search + construction-time migration (T3), desktop Electron-ABI packaging (T4). Existing `storage.test.ts` cases keep running against the new backend (same API).
- No placeholders; every code step is complete.
- Types consistent: `openDb`/`messageText`/`Database`, `migrateJsonSessions(baseDir, store)`, `SessionRecord`/`SessionSummary`, `search`.
- Backward compat: only caller `server.ts:150` (`new SessionStore()`) is unchanged; API identical plus additive `search`.
- Risk called out: Electron ABI for the native module (T4), with a follow-up path if the rebuild is not enough.
