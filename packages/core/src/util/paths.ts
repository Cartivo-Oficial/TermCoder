import { homedir } from "node:os";
import { join } from "node:path";

export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME;
  return xdg ? join(xdg, "termcoder") : join(homedir(), ".config", "termcoder");
}

export function configFile(name: string, env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), name);
}
