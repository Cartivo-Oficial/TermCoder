import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { configFile } from "../util/paths";
import type { GitHubClient } from "../github/github";

/**
 * Sync per-user JSON stores (favorites, drafts, later study decks/progress) to
 * a single private "termcoder sync" gist so they follow you across machines.
 *
 * Conflict policy is deliberately simple and honest: last-write-wins by wall
 * clock. Each store is wrapped in an envelope carrying `updatedAt`; on pull we
 * only overwrite the local file when the remote envelope is newer.
 *
 * Secrets never sync — only the named stores below, never `config.json`.
 */

const SYNC_DESCRIPTION = "termcoder:sync — private synced settings";
const META_FILE = "sync.json";

/** Stores synced by default (favorites, drafts, and study decks/progress). */
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

/** Whether a sync gist has been established for this machine yet. */
export function isSyncConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(loadMeta(env).gistId);
}

/** Upload a single local store to the sync gist (creating it on first push). */
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

/** Download a store from the sync gist, overwriting the local copy iff newer. */
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

/** Pull-then-push every store; returns which ones changed locally on pull. */
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
