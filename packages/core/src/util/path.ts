import { isAbsolute, relative, resolve } from "node:path";

/**
 * Resolve `p` against `cwd` and guarantee the result stays within the workspace
 * root. Tools use this so the agent can't read or write outside the project.
 */
export function resolveInside(cwd: string, p: string): string {
  const abs = isAbsolute(p) ? resolve(p) : resolve(cwd, p);
  const rel = relative(cwd, abs);
  if (rel === ".." || rel.startsWith(`..${"/"}`) || rel.startsWith(`..\\`) || isAbsolute(rel)) {
    throw new Error(`Path escapes workspace root: ${p}`);
  }
  return abs;
}
