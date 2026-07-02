import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CheckpointManager } from "./checkpoint";

describe("CheckpointManager", () => {
  let dir: string;
  let work: string;
  let cm: CheckpointManager;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-cp-"));
    work = join(dir, "work");
    mkdirSync(work);
    cm = new CheckpointManager(join(dir, "cps"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reverts edits and deletes newly-created files", () => {
    const a = join(work, "a.txt");
    writeFileSync(a, "original");
    const b = join(work, "b.txt");

    cm.begin();
    cm.capture(a);
    writeFileSync(a, "modified");
    cm.capture(b); // b doesn't exist yet
    writeFileSync(b, "brand new");
    expect(cm.commit("t1")).toBe(true);
    expect(cm.hasLatest()).toBe(true);

    const restored = cm.revertLatest();
    expect(restored.sort()).toEqual([a, b].sort());
    expect(readFileSync(a, "utf8")).toBe("original");
    expect(existsSync(b)).toBe(false); // created file removed on revert
    expect(cm.hasLatest()).toBe(false); // checkpoint consumed
  });

  it("captures a file only once per turn", () => {
    const a = join(work, "a.txt");
    writeFileSync(a, "v1");
    cm.begin();
    cm.capture(a);
    writeFileSync(a, "v2");
    cm.capture(a); // second capture must not overwrite the original snapshot
    cm.commit("t1");

    cm.revertLatest();
    expect(readFileSync(a, "utf8")).toBe("v1");
  });

  it("commit with no captures returns false", () => {
    cm.begin();
    expect(cm.commit("t1")).toBe(false);
    expect(cm.hasLatest()).toBe(false);
  });
});
