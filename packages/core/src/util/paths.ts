import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The termcoder global config/state directory. Honours `XDG_CONFIG_HOME`,
 * otherwise `~/.config/termcoder`. This is the single source of truth for
 * where per-user stores (favorites, drafts, sync, …) live.
 */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME;
  return xdg ? join(xdg, "termcoder") : join(homedir(), ".config", "termcoder");
}

/** Absolute path to a file inside the config dir. */
export function configFile(name: string, env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), name);
}
