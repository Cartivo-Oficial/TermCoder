import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

/**
 * A tiny "trusted folders" store, like Claude Code's "do you trust the files in
 * this folder?" prompt. The agent can read files and run commands, so on first
 * use of a directory we ask; the answer is remembered globally.
 */

function trustDir(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME;
  return xdg ? join(xdg, "termcoder") : join(homedir(), ".config", "termcoder");
}

function trustFile(env: NodeJS.ProcessEnv = process.env): string {
  return join(trustDir(env), "trusted.json");
}

function readTrusted(env: NodeJS.ProcessEnv = process.env): string[] {
  try {
    const file = trustFile(env);
    if (!existsSync(file)) return [];
    const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Whether `cwd` (or an already-trusted ancestor of it) has been trusted. */
export function isTrusted(cwd: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const dir = resolve(cwd);
  return readTrusted(env).some((t) => dir === t || dir.startsWith(t.endsWith(sep) ? t : t + sep));
}

/** Remember `cwd` as trusted. Returns the path stored. */
export function trustFolder(cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const dir = resolve(cwd);
  const list = readTrusted(env);
  if (!list.includes(dir)) list.push(dir);
  mkdirSync(trustDir(env), { recursive: true });
  writeFileSync(trustFile(env), `${JSON.stringify(list, null, 2)}\n`, "utf8");
  return dir;
}
