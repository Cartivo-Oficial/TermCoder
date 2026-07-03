import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pullSync, pushSync, syncAll } from "./sync";
import type { Gist, GitHubClient } from "../github/github";

/** A tiny in-memory gist backend implementing just what sync uses. */
function fakeClient() {
  const store: Record<string, Record<string, string>> = {};
  let n = 0;
  const toGist = (id: string): Gist => ({
    id,
    html_url: `https://gist.github.com/${id}`,
    description: "",
    public: false,
    updated_at: "",
    files: Object.fromEntries(
      Object.entries(store[id] ?? {}).map(([k, v]) => [k, { filename: k, content: v }]),
    ),
  });
  return {
    async createGist({ files }: { files: Record<string, { content: string }> }) {
      const id = `g${++n}`;
      store[id] = {};
      for (const [k, v] of Object.entries(files)) store[id]![k] = v.content;
      return toGist(id);
    },
    async updateGist(id: string, files: Record<string, { content: string }>) {
      store[id] ??= {};
      for (const [k, v] of Object.entries(files)) store[id]![k] = v.content;
      return toGist(id);
    },
    async getGist(id: string) {
      return toGist(id);
    },
    async gistFileContent(g: Gist, filename: string) {
      return g.files[filename]?.content;
    },
  } as unknown as GitHubClient;
}

describe("sync store", () => {
  let cfgA: string;
  let cfgB: string;
  let envA: NodeJS.ProcessEnv;
  let envB: NodeJS.ProcessEnv;
  // Stores live under the `termcoder` subdir of XDG_CONFIG_HOME (see configDir).
  const cdir = (cfg: string) => join(cfg, "termcoder");
  const favFile = (cfg: string) => join(cdir(cfg), "favorites.json");
  const metaFile = (cfg: string) => join(cdir(cfg), "sync.json");
  const writeFav = (cfg: string, list: string[]) => {
    mkdirSync(cdir(cfg), { recursive: true });
    writeFileSync(favFile(cfg), JSON.stringify(list), "utf8");
  };
  const readFav = (cfg: string) => JSON.parse(readFileSync(favFile(cfg), "utf8"));

  beforeEach(() => {
    cfgA = mkdtempSync(join(tmpdir(), "tc-syncA-"));
    cfgB = mkdtempSync(join(tmpdir(), "tc-syncB-"));
    envA = { XDG_CONFIG_HOME: cfgA };
    envB = { XDG_CONFIG_HOME: cfgB };
  });
  afterEach(() => {
    rmSync(cfgA, { recursive: true, force: true });
    rmSync(cfgB, { recursive: true, force: true });
  });

  it("carries a store from one machine to another via the sync gist", async () => {
    const client = fakeClient();
    writeFav(cfgA, ["ollama/llama3.1"]);
    expect(await pushSync("favorites", client, envA)).toBe(true);

    // Machine B points at the same sync gist, has no local favorites yet.
    const meta = JSON.parse(readFileSync(metaFile(cfgA), "utf8"));
    mkdirSync(cdir(cfgB), { recursive: true });
    writeFileSync(metaFile(cfgB), JSON.stringify(meta), "utf8");
    expect(await pullSync("favorites", client, envB)).toBe(true);
    expect(readFav(cfgB)).toEqual(["ollama/llama3.1"]);
  });

  it("last-write-wins: pulls a strictly newer remote, ignores an older one", async () => {
    const client = fakeClient();
    writeFav(cfgA, ["a"]);
    await pushSync("favorites", client, envA);
    const gistId = JSON.parse(readFileSync(metaFile(cfgA), "utf8")).gistId as string;

    // Remote is newer → overwrite local.
    await client.updateGist(gistId, {
      "favorites.json": { content: JSON.stringify({ updatedAt: Date.now() + 1e7, data: ["b"] }) },
    });
    expect(await pullSync("favorites", client, envA)).toBe(true);
    expect(readFav(cfgA)).toEqual(["b"]);

    // Remote is older → keep local.
    await client.updateGist(gistId, {
      "favorites.json": { content: JSON.stringify({ updatedAt: 1, data: ["c"] }) },
    });
    expect(await pullSync("favorites", client, envA)).toBe(false);
    expect(readFav(cfgA)).toEqual(["b"]);
  });

  it("syncAll reports which stores moved", async () => {
    const client = fakeClient();
    writeFav(cfgA, ["a"]);
    const res = await syncAll(client, ["favorites"], envA);
    expect(res.pushed).toContain("favorites");
  });
});
