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

  close(): void {
    this.db.close();
  }

  search(query: string): SessionSummary[] {
    const esc = query.replace(/[\\%_]/g, (c) => "\\" + c);
    const like = `%${esc}%`;
    const rows = this.db.prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM messages m2 WHERE m2.sessionId = s.id) AS messageCount
       FROM sessions s
       WHERE s.title LIKE ? ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM messages m WHERE m.sessionId = s.id AND m.text LIKE ? ESCAPE '\\')
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
