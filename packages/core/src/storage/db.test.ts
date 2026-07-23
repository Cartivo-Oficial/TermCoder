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
