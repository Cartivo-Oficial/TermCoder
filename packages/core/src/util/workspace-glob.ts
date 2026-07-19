import { isAbsolute, relative, resolve } from "node:path";
import { globSync } from "tinyglobby";

function escapes(cwd: string, abs: string): boolean {
  const rel = relative(cwd, abs);
  return rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel);
}

export function workspaceGlob(
  pattern: string,
  cwd: string,
  opts: { ignore: string[]; dot?: boolean },
): string[] {
  if (isAbsolute(pattern) || escapes(cwd, resolve(cwd, pattern))) {
    throw new Error(`Pattern escapes workspace root: ${pattern}`);
  }
  const matches = globSync(pattern, {
    cwd,
    ignore: opts.ignore,
    dot: opts.dot ?? false,
    onlyFiles: true,
    absolute: true,
  });
  return matches.filter((file) => !escapes(cwd, resolve(file)));
}
