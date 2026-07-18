import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pullSessions, pullSync, pushSessions, pushSync, syncAll } from "./sync";
import { SessionStore } from "../storage/storage";
import { saveConfig } from "../config/config";
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

function fakeClientWith(files: Record<string, string>) {
  const store: Record<string, Record<string, string>> = { g1: files };
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
    async createGist({ files: f }: { files: Record<string, { content: string }> }) {
      const id = `g${Object.keys(store).length + 1}`;
      store[id] = {};
      for (const [k, v] of Object.entries(f)) store[id]![k] = v.content;
      return toGist(id);
    },
    async updateGist(id: string, f: Record<string, { content: string }>) {
      store[id] ??= {};
      for (const [k, v] of Object.entries(f)) store[id]![k] = v.content;
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
  const storeFile = (cfg: string, name: string) => join(cdir(cfg), `${name}.json`);
  const writeFav = (cfg: string, list: string[]) => {
    mkdirSync(cdir(cfg), { recursive: true });
    writeFileSync(favFile(cfg), JSON.stringify(list), "utf8");
  };
  const readFav = (cfg: string) => JSON.parse(readFileSync(favFile(cfg), "utf8"));
  const writeLocalStore = (name: string, data: unknown) => {
    mkdirSync(cdir(cfgA), { recursive: true });
    writeFileSync(storeFile(cfgA, name), JSON.stringify(data), "utf8");
  };
  const readLocalStore = (name: string) => JSON.parse(readFileSync(storeFile(cfgA, name), "utf8"));
  const useGist = (id: string) => {
    mkdirSync(cdir(cfgA), { recursive: true });
    writeFileSync(metaFile(cfgA), JSON.stringify({ gistId: id }), "utf8");
  };

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

  it("merges the settings store key by key instead of replacing it", async () => {
    useGist("g1");
    writeLocalStore("settings", {
      theme: { value: "ember", updatedAt: 200 },
      model: { value: "local/model", updatedAt: 50 },
    });
    const client = fakeClientWith({
      "settings.json": JSON.stringify({
        updatedAt: 999,
        data: {
          theme: { value: "paper", updatedAt: 100 },
          model: { value: "remote/model", updatedAt: 300 },
        },
      }),
    });

    await pullSync("settings", client, envA);

    expect(readLocalStore("settings")).toEqual({
      theme: { value: "ember", updatedAt: 200 },
      model: { value: "remote/model", updatedAt: 300 },
    });
  });

  it("proves the transport: the merged theme+model land in settings.json, and travel to a second machine's config.json via the same gist", async () => {
    useGist("g1");
    saveConfig({ theme: "ember" }, { configDir: cdir(cfgA) });
    const client = fakeClientWith({
      "settings.json": JSON.stringify({
        updatedAt: 999,
        data: {
          model: { value: "remote/model", updatedAt: Date.now() - 10_000 },
        },
      }),
    });

    expect(await pullSync("settings", client, envA)).toBe(true);

    const transportA = readLocalStore("settings");
    expect(transportA.theme).toEqual({ value: "ember", updatedAt: expect.any(Number) });
    expect(transportA.model).toEqual({ value: "remote/model", updatedAt: expect.any(Number) });

    expect(await pushSync("settings", client, envA)).toBe(true);

    mkdirSync(cdir(cfgB), { recursive: true });
    writeFileSync(metaFile(cfgB), JSON.stringify({ gistId: "g1" }), "utf8");
    writeFileSync(join(cdir(cfgB), "config.json"), "{}", "utf8");

    expect(await pullSync("settings", client, envB)).toBe(true);

    const configB = JSON.parse(readFileSync(join(cdir(cfgB), "config.json"), "utf8"));
    expect(configB.theme).toBe("ember");
    expect(configB.model).toBe("remote/model");
  });

  it("preserves a non-whitelisted key like connectors across a settings reconcile", async () => {
    useGist("g1");
    writeLocalStore("settings", {
      theme: { value: "ember", updatedAt: 200 },
      connectors: { value: [{ id: "linear", inputs: {} }], updatedAt: 150 },
    });
    const client = fakeClientWith({
      "settings.json": JSON.stringify({ updatedAt: 999, data: {} }),
    });

    expect(await pullSync("settings", client, envA)).toBe(true);

    expect(readLocalStore("settings").connectors).toEqual({
      value: [{ id: "linear", inputs: {} }],
      updatedAt: 150,
    });
  });

  it("mtime staleness: an untouched local theme with an old config loses to a newer remote edit", async () => {
    useGist("g1");
    saveConfig({ theme: "ember" }, { configDir: cdir(cfgA) });
    const configPath = join(cdir(cfgA), "config.json");
    const oldTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    utimesSync(configPath, oldTime, oldTime);
    const remoteStamp = Date.now() - 1000;
    const client = fakeClientWith({
      "settings.json": JSON.stringify({
        updatedAt: 999,
        data: {
          theme: { value: "paper", updatedAt: remoteStamp },
        },
      }),
    });

    expect(await pullSync("settings", client, envA)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf8"));
    expect(config.theme).toBe("paper");
  });

  it("drops an unknown settings key arriving from the gist", async () => {
    useGist("g1");
    writeLocalStore("settings", {});
    const client = fakeClientWith({
      "settings.json": JSON.stringify({
        updatedAt: 999,
        data: { evil: { value: "rm -rf /", updatedAt: 999 } },
      }),
    });

    await pullSync("settings", client, envA);

    expect(readLocalStore("settings")).toEqual({});
  });

  it("resolves a synced connector id into a disabled local mcp entry on pull", async () => {
    useGist("g1");
    writeLocalStore("settings", {});
    const client = fakeClientWith({
      "settings.json": JSON.stringify({
        updatedAt: 999,
        data: {
          connectors: {
            value: [{ id: "filesystem", inputs: { root: "/home/me/proj" } }],
            updatedAt: 999,
          },
        },
      }),
    });

    expect(await pullSync("settings", client, envA)).toBe(true);

    const config = JSON.parse(readFileSync(join(cdir(cfgA), "config.json"), "utf8"));
    expect(config.mcp.filesystem.enabled).toBe(false);
    expect(config.mcp.filesystem.command).toBe("npx");
  });

  it("ignores an unknown connector id from the gist without throwing", async () => {
    useGist("g1");
    writeLocalStore("settings", {});
    const client = fakeClientWith({
      "settings.json": JSON.stringify({
        updatedAt: 999,
        data: {
          connectors: {
            value: [{ id: "does-not-exist", inputs: {} }],
            updatedAt: 999,
          },
        },
      }),
    });

    await expect(pullSync("settings", client, envA)).resolves.toBe(true);

    const config = JSON.parse(readFileSync(join(cdir(cfgA), "config.json"), "utf8"));
    expect(config.mcp ?? {}).toEqual({});
  });

  it("never downgrades an already-enabled connector on a later pull", async () => {
    useGist("g1");
    writeLocalStore("settings", {});
    saveConfig(
      { mcp: { filesystem: { type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/me/proj"], enabled: true } } },
      { configDir: cdir(cfgA) },
    );
    const client = fakeClientWith({
      "settings.json": JSON.stringify({
        updatedAt: 999,
        data: {
          connectors: {
            value: [{ id: "filesystem", inputs: { root: "/home/me/proj" } }],
            updatedAt: 999,
          },
        },
      }),
    });

    await pullSync("settings", client, envA);

    const config = JSON.parse(readFileSync(join(cdir(cfgA), "config.json"), "utf8"));
    expect(config.mcp.filesystem.enabled).toBe(true);
  });

  it("still replaces a non-settings store wholesale", async () => {
    useGist("g1");
    writeLocalStore("favorites", ["a"]);
    const client = fakeClientWith({
      "favorites.json": JSON.stringify({ updatedAt: Date.now() + 10_000, data: ["b"] }),
    });

    await pullSync("favorites", client, envA);

    expect(readLocalStore("favorites")).toEqual(["b"]);
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
