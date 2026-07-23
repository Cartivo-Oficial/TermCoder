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

  it("skips a structurally-invalid file whose import throws, without aborting the others", () => {
    writeFileSync(join(dir, "good.json"), JSON.stringify(rec("good")), "utf8");
    writeFileSync(join(dir, "invalid.json"), JSON.stringify({ title: "no id here" }), "utf8");
    const imported: string[] = [];
    const store = {
      exists: (id: string) => imported.includes(id),
      import: (r: SessionRecord) => {
        if (!r.id) throw new Error("NOT NULL constraint failed: sessions.id");
        imported.push(r.id);
      },
    };

    let result = -1;
    expect(() => {
      result = migrateJsonSessions(dir, store);
    }).not.toThrow();
    expect(result).toBe(1);
    expect(imported).toEqual(["good"]);
    expect(existsSync(join(dir, "good.json.bak"))).toBe(true);
    expect(existsSync(join(dir, "invalid.json"))).toBe(false);
    expect(existsSync(join(dir, "invalid.json.failed"))).toBe(true);
  });
});
