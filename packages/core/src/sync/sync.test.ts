import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pullSessions, pullSync, pushSessions, pushSync, syncAll } from "./sync";
import { SessionStore } from "../storage/storage";
import type { Gist, GitHubClient } from "../github/github";

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

    await client.updateGist(gistId, {
      "favorites.json": { content: JSON.stringify({ updatedAt: Date.now() + 1e7, data: ["b"] }) },
    });
    expect(await pullSync("favorites", client, envA)).toBe(true);
    expect(readFav(cfgA)).toEqual(["b"]);

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

function discoverableClient() {
  const store: Record<string, { description: string; files: Record<string, string> }> = {};
  let n = 0;
  const toGist = (id: string): Gist => ({
    id,
    html_url: `https://gist.github.com/${id}`,
    description: store[id]!.description,
    public: false,
    updated_at: "",
    files: Object.fromEntries(Object.entries(store[id]!.files).map(([k, v]) => [k, { filename: k, content: v }])),
  });
  return {
    async createGist({ files, description }: { files: Record<string, { content: string }>; description?: string }) {
      const id = `g${++n}`;
      store[id] = { description: description ?? "", files: {} };
      for (const [k, v] of Object.entries(files)) store[id]!.files[k] = v.content;
      return toGist(id);
    },
    async updateGist(id: string, files: Record<string, { content: string }>) {
      for (const [k, v] of Object.entries(files)) if (v) store[id]!.files[k] = v.content;
      return toGist(id);
    },
    async getGist(id: string) {
      return toGist(id);
    },
    async gistFileContent(g: Gist, name: string) {
      return g.files[name]?.content;
    },
    async listGists() {
      return Object.keys(store).map((id) => toGist(id));
    },
  } as unknown as GitHubClient;
}

describe("session sync", () => {
  let dirA: string;
  let dirB: string;
  let envA: NodeJS.ProcessEnv;
  let envB: NodeJS.ProcessEnv;
  beforeEach(() => {
    dirA = mkdtempSync(join(tmpdir(), "tc-ssA-"));
    dirB = mkdtempSync(join(tmpdir(), "tc-ssB-"));
    envA = { XDG_CONFIG_HOME: join(dirA, "cfg") };
    envB = { XDG_CONFIG_HOME: join(dirB, "cfg") };
  });
  afterEach(() => {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it("carries sessions to a fresh device that discovers the gist by description", async () => {
    const client = discoverableClient();
    const storeA = new SessionStore(join(dirA, "sessions"));
    const s1 = storeA.create({ cwd: "/a", model: "m", title: "First" });
    s1.messages.push({ role: "user", content: "hi" } as never);
    storeA.save(s1);
    storeA.create({ cwd: "/a", model: "m", title: "Second" });
    expect(await pushSessions(storeA, client, envA)).toBe(2);

    const storeB = new SessionStore(join(dirB, "sessions"));
    expect(storeB.list()).toHaveLength(0);
    const merged = await pullSessions(storeB, client, envB);
    expect(merged).toBe(2);
    expect(storeB.list().map((s) => s.title).sort()).toEqual(["First", "Second"]);
    expect(storeB.load(s1.id).messages).toHaveLength(1);
  });

  it("does not overwrite a locally newer session on pull", async () => {
    const client = discoverableClient();
    const storeA = new SessionStore(join(dirA, "sessions"));
    const s = storeA.create({ cwd: "/a", model: "m", title: "Old" });
    await pushSessions(storeA, client, envA);

    const storeB = new SessionStore(join(dirB, "sessions"));
    await pullSessions(storeB, client, envB);
    const local = storeB.load(s.id);
    local.title = "Edited on B";
    storeB.save(local); // bumps updatedAt to now (newer than remote)

    const merged = await pullSessions(storeB, client, envB);
    expect(merged).toBe(0);
    expect(storeB.load(s.id).title).toBe("Edited on B");
  });
});
