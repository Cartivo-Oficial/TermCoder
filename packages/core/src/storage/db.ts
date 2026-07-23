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
