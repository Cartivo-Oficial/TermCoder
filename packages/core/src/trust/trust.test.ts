import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isTrusted, trustFolder } from "./trust";

describe("trust store", () => {
  let cfg: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    cfg = mkdtempSync(join(tmpdir(), "tc-trust-"));
    env = { XDG_CONFIG_HOME: cfg };
  });
  afterEach(() => rmSync(cfg, { recursive: true, force: true }));

  it("is untrusted until trusted, then remembered", () => {
    const proj = mkdtempSync(join(tmpdir(), "tc-proj-"));
    expect(isTrusted(proj, env)).toBe(false);
    trustFolder(proj, env);
    expect(isTrusted(proj, env)).toBe(true);
    rmSync(proj, { recursive: true, force: true });
  });

  it("trusts subdirectories of a trusted folder", () => {
    const proj = mkdtempSync(join(tmpdir(), "tc-proj-"));
    trustFolder(proj, env);
    expect(isTrusted(join(proj, "src", "deep"), env)).toBe(true);
    rmSync(proj, { recursive: true, force: true });
  });

  it("does not trust a sibling that only shares a name prefix", () => {
    const base = mkdtempSync(join(tmpdir(), "tc-proj-"));
    trustFolder(join(base, "app"), env);
    expect(isTrusted(join(base, "app-2"), env)).toBe(false);
    rmSync(base, { recursive: true, force: true });
  });
});
