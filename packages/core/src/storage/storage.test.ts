import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionStore } from "./storage";

describe("SessionStore", () => {
  let dir: string;
  let store: SessionStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-store-"));
    store = new SessionStore(dir);
  });

  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates, persists, and reloads a session", () => {
    const created = store.create({ cwd: "/work", model: "anthropic/x" });
    expect(created.id).toBeTruthy();
    expect(store.exists(created.id)).toBe(true);

    const loaded = store.load(created.id);
    expect(loaded.id).toBe(created.id);
    expect(loaded.cwd).toBe("/work");
    expect(loaded.messages).toEqual([]);
  });

  it("appends messages and persists them", () => {
    const session = store.create({ cwd: "/work", model: "anthropic/x" });
    session.messages.push({ role: "user", content: "hello" });
    store.save(session);

    const loaded = store.load(session.id);
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0]).toMatchObject({ role: "user", content: "hello" });
  });

  it("lists sessions newest-updated first", async () => {
    const a = store.create({ cwd: "/a", model: "m" });
    await new Promise((r) => setTimeout(r, 5));
    const b = store.create({ cwd: "/b", model: "m" });

    const list = store.list();
    expect(list.map((s) => s.id)).toEqual([b.id, a.id]);
    expect(list[0]?.messageCount).toBe(0);
  });

  it("throws when loading a missing session", () => {
    expect(() => store.load("nope")).toThrow(/not found/);
  });

  it("returns an empty list when no sessions exist", () => {
    expect(store.list()).toEqual([]);
  });

  it("deletes a single session and reports whether it existed", () => {
    const a = store.create({ cwd: "/a", model: "m" });
    const b = store.create({ cwd: "/b", model: "m" });

    expect(store.delete(a.id)).toBe(true);
    expect(store.exists(a.id)).toBe(false);
    expect(store.exists(b.id)).toBe(true);
    expect(store.delete("missing")).toBe(false);
  });

  it("deletes every session and returns the count removed", () => {
    store.create({ cwd: "/a", model: "m" });
    store.create({ cwd: "/b", model: "m" });

    expect(store.deleteAll()).toBe(2);
    expect(store.list()).toEqual([]);
    expect(store.deleteAll()).toBe(0);
  });

  it("persists and lists per-session usage; absent on a fresh record", () => {
    const rec = store.create({ cwd: dir, model: "termcoderfree/auto" });
    expect(store.list()[0]?.usage).toBeUndefined();
    rec.usage = { tokensIn: 100, tokensOut: 40 };
    store.save(rec);
    expect(store.list()[0]?.usage).toEqual({ tokensIn: 100, tokensOut: 40 });
  });
});

describe("SessionStore SQLite", () => {
  let dir: string;
  let store: import("./storage").SessionStore;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "tc-sql-")); store = new SessionStore(dir); });
  afterEach(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });

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
    s2.close();
    rmSync(dir2, { recursive: true, force: true });
  });
});
