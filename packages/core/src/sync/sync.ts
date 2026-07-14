import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { configFile } from "../util/paths";
import type { GitHubClient } from "../github/github";
import type { SessionRecord, SessionStore } from "../storage/storage";

const SESSIONS_FILE = "sessions.json";
const SESSION_SYNC_LIMIT = 50;


const SYNC_DESCRIPTION = "termcoder:sync — private synced settings";
const META_FILE = "sync.json";

export const DEFAULT_SYNC_STORES = ["favorites", "drafts", "decks", "progress"] as const;

interface SyncMeta {
  gistId?: string;
}

export interface SyncEnvelope {
  updatedAt: number;
  data: unknown;
}

function loadMeta(env: NodeJS.ProcessEnv): SyncMeta {
  try {
    return JSON.parse(readFileSync(configFile(META_FILE, env), "utf8")) as SyncMeta;
  } catch {
    return {};
  }
}

function saveMeta(meta: SyncMeta, env: NodeJS.ProcessEnv): void {
  const f = configFile(META_FILE, env);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(meta, null, 2), "utf8");
}

function localFile(name: string, env: NodeJS.ProcessEnv): string {
  return configFile(`${name}.json`, env);
}

function readLocal(name: string, env: NodeJS.ProcessEnv): { data: unknown; updatedAt: number } | undefined {
  const f = localFile(name, env);
  if (!existsSync(f)) return undefined;
  try {
    return { data: JSON.parse(readFileSync(f, "utf8")), updatedAt: statSync(f).mtimeMs };
  } catch {
    return undefined;
  }
}

function writeLocal(name: string, data: unknown, env: NodeJS.ProcessEnv): void {
  const f = localFile(name, env);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(data, null, 2), "utf8");
}

export function isSyncConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(loadMeta(env).gistId);
}

export async function pushSync(
  name: string,
  client: GitHubClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const local = readLocal(name, env);
  if (!local) return false;
  const envelope: SyncEnvelope = { updatedAt: local.updatedAt, data: local.data };
  const files = { [`${name}.json`]: { content: JSON.stringify(envelope, null, 2) } };
  const meta = loadMeta(env);
  if (meta.gistId) {
    await client.updateGist(meta.gistId, files);
  } else {
    const gist = await client.createGist({ description: SYNC_DESCRIPTION, public: false, files });
    saveMeta({ ...meta, gistId: gist.id }, env);
  }
  return true;
}

export async function pullSync(
  name: string,
  client: GitHubClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const meta = loadMeta(env);
  if (!meta.gistId) return false;
  const gist = await client.getGist(meta.gistId);
  const raw = await client.gistFileContent(gist, `${name}.json`);
  if (!raw) return false;
  const envelope = JSON.parse(raw) as SyncEnvelope;
  const local = readLocal(name, env);
  if (local && local.updatedAt >= envelope.updatedAt) return false; // local wins
  writeLocal(name, envelope.data, env);
  return true;
}

export async function syncAll(
  client: GitHubClient,
  names: readonly string[] = DEFAULT_SYNC_STORES,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ pulled: string[]; pushed: string[] }> {
  const pulled: string[] = [];
  const pushed: string[] = [];
  for (const name of names) {
    if (await pullSync(name, client, env)) pulled.push(name);
    if (await pushSync(name, client, env)) pushed.push(name);
  }
  return { pulled, pushed };
}

async function resolveSyncGistId(
  client: GitHubClient,
  env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  const meta = loadMeta(env);
  if (meta.gistId) return meta.gistId;
  try {
    const gists = await client.listGists();
    const found = gists.find((g) => (g.description ?? "").startsWith("termcoder:sync"));
    if (found) {
      saveMeta({ ...meta, gistId: found.id }, env);
      return found.id;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function pushSessions(
  store: SessionStore,
  client: GitHubClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const recent = store
    .list()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, SESSION_SYNC_LIMIT);
  const sessions = recent.map((s) => store.load(s.id));
  const updatedAt = sessions.reduce((max, s) => Math.max(max, s.updatedAt), 0);
  const envelope: SyncEnvelope = { updatedAt, data: { sessions } };
  const files = { [SESSIONS_FILE]: { content: JSON.stringify(envelope) } };
  const gistId = await resolveSyncGistId(client, env);
  if (gistId) {
    await client.updateGist(gistId, files);
  } else {
    const gist = await client.createGist({ description: SYNC_DESCRIPTION, public: false, files });
    saveMeta({ ...loadMeta(env), gistId: gist.id }, env);
  }
  return sessions.length;
}

export async function pullSessions(
  store: SessionStore,
  client: GitHubClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const gistId = await resolveSyncGistId(client, env);
  if (!gistId) return 0;
  const gist = await client.getGist(gistId);
  const raw = await client.gistFileContent(gist, SESSIONS_FILE);
  if (!raw) return 0;
  const envelope = JSON.parse(raw) as SyncEnvelope;
  const remote = (envelope.data as { sessions?: SessionRecord[] })?.sessions ?? [];
  let merged = 0;
  for (const record of remote) {
    if (!record?.id) continue;
    const localNewer = store.exists(record.id) && store.load(record.id).updatedAt >= record.updatedAt;
    if (localNewer) continue;
    store.import(record);
    merged += 1;
  }
  return merged;
}
