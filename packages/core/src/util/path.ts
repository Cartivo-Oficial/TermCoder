import { isAbsolute, relative, resolve } from "node:path";

export function resolveInside(cwd: string, p: string): string {
  const abs = isAbsolute(p) ? resolve(p) : resolve(cwd, p);
  const rel = relative(cwd, abs);
  if (rel === ".." || rel.startsWith(`..${"/"}`) || rel.startsWith(`..\\`) || isAbsolute(rel)) {
    throw new Error(`Path escapes workspace root: ${p}`);
  }
  return abs;
}
