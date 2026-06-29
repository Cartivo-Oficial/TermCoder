import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Read `<cwd>/.gitignore` and convert its entries to tinyglobby-compatible
 * ignore globs (best effort). Negations (`!`) and comments are skipped. Lets the
 * search tools (glob/grep) ignore the same files git does.
 */
export function gitignoreGlobs(cwd: string): string[] {
  const path = join(cwd, ".gitignore");
  if (!existsSync(path)) return [];

  const globs: string[] = [];
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    let line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    line = line.replace(/\/+$/, "");
    if (!line) continue;

    if (line.startsWith("/")) {
      const rest = line.slice(1);
      globs.push(rest, `${rest}/**`);
    } else {
      globs.push(`**/${line}`, `**/${line}/**`);
    }
  }
  return globs;
}
