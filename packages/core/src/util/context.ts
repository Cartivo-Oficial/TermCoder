import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CONTEXT_FILES = ["AGENTS.md", ".termcoder/AGENTS.md", "CLAUDE.md"];
const MAX_CHARS = 12_000;

export function loadProjectContext(cwd: string): string | undefined {
  for (const file of CONTEXT_FILES) {
    const path = join(cwd, file);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf8").trim();
      if (!content) continue;
      return content.length > MAX_CHARS ? `${content.slice(0, MAX_CHARS)}\n…(truncated)` : content;
    }
  }
  return undefined;
}
