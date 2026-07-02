import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "./draft";

describe("draft store", () => {
  let cfg: string;
  let env: NodeJS.ProcessEnv;
  beforeEach(() => {
    cfg = mkdtempSync(join(tmpdir(), "tc-draft-"));
    env = { XDG_CONFIG_HOME: cfg };
  });
  afterEach(() => rmSync(cfg, { recursive: true, force: true }));

  it("saves and restores a draft per folder", () => {
    expect(loadDraft("/proj/a", env)).toBe("");
    saveDraft("/proj/a", "half-written message", env);
    expect(loadDraft("/proj/a", env)).toBe("half-written message");
    expect(loadDraft("/proj/b", env)).toBe(""); // isolated per folder
  });

  it("clears a draft", () => {
    saveDraft("/proj/a", "x", env);
    clearDraft("/proj/a", env);
    expect(loadDraft("/proj/a", env)).toBe("");
  });

  it("saving an empty string removes the draft", () => {
    saveDraft("/proj/a", "x", env);
    saveDraft("/proj/a", "", env);
    expect(loadDraft("/proj/a", env)).toBe("");
  });
});
