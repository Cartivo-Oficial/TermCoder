import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Favourite model ids, pinned to the top of the model picker. Global. */

function dir(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME;
  return xdg ? join(xdg, "termcoder") : join(homedir(), ".config", "termcoder");
}
function file(env: NodeJS.ProcessEnv = process.env): string {
  return join(dir(env), "favorites.json");
}

export function loadFavorites(env: NodeJS.ProcessEnv = process.env): string[] {
  try {
    const f = file(env);
    if (!existsSync(f)) return [];
    const data = JSON.parse(readFileSync(f, "utf8")) as unknown;
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Toggle a model id in the favourites and persist; returns the new list. */
export function toggleFavorite(id: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const list = loadFavorites(env);
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  mkdirSync(dir(env), { recursive: true });
  writeFileSync(file(env), JSON.stringify(list), "utf8");
  return list;
}
