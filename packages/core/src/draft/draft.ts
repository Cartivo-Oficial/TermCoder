import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Per-folder composer drafts: remember an unsent message so it survives a
 * restart. Keyed by absolute cwd, stored in the global config dir.
 */

function dir(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME;
  return xdg ? join(xdg, "termcoder") : join(homedir(), ".config", "termcoder");
}
function file(env: NodeJS.ProcessEnv = process.env): string {
  return join(dir(env), "drafts.json");
}
function readAll(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  try {
    const f = file(env);
    if (!existsSync(f)) return {};
    const data = JSON.parse(readFileSync(f, "utf8")) as unknown;
    return data && typeof data === "object" ? (data as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function writeAll(map: Record<string, string>, env: NodeJS.ProcessEnv = process.env): void {
  mkdirSync(dir(env), { recursive: true });
  writeFileSync(file(env), JSON.stringify(map), "utf8");
}

export function loadDraft(cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  return readAll(env)[resolve(cwd)] ?? "";
}

export function saveDraft(cwd: string, text: string, env: NodeJS.ProcessEnv = process.env): void {
  const map = readAll(env);
  if (text) map[resolve(cwd)] = text;
  else delete map[resolve(cwd)];
  writeAll(map, env);
}

export function clearDraft(cwd: string, env: NodeJS.ProcessEnv = process.env): void {
  const map = readAll(env);
  if (resolve(cwd) in map) {
    delete map[resolve(cwd)];
    writeAll(map, env);
  }
}
