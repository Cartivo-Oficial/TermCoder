import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadFavorites, toggleFavorite } from "./favorites";

describe("favorites store", () => {
  let cfg: string;
  let env: NodeJS.ProcessEnv;
  beforeEach(() => {
    cfg = mkdtempSync(join(tmpdir(), "tc-fav-"));
    env = { XDG_CONFIG_HOME: cfg };
  });
  afterEach(() => rmSync(cfg, { recursive: true, force: true }));

  it("toggles a favourite on and off, persisting it", () => {
    expect(loadFavorites(env)).toEqual([]);
    expect(toggleFavorite("anthropic/claude", env)).toEqual(["anthropic/claude"]);
    expect(loadFavorites(env)).toEqual(["anthropic/claude"]);
    expect(toggleFavorite("anthropic/claude", env)).toEqual([]);
    expect(loadFavorites(env)).toEqual([]);
  });
});
