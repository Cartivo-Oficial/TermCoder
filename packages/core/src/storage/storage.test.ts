import { mkdtempSync, rmSync } from "node:fs";
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
});
