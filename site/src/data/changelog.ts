import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ChangelogEntry {
  version: string;
  title?: string;
  body: string;
}

export function parseChangelog(md: string): ChangelogEntry[] {
  const parts = md.split(/^## +/m).slice(1);
  return parts.map((part) => {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    const body = (nl === -1 ? "" : part.slice(nl + 1)).replace(/\n+$/, "").trim();
    const dash = heading.split(/\s+—\s+/);
    const version = dash[0].trim();
    const title = dash.length > 1 ? dash.slice(1).join(" — ").trim() : undefined;
    return title ? { version, title, body } : { version, body };
  });
}

export function loadChangelog(): ChangelogEntry[] {
  const path = join(process.cwd(), "..", "CHANGELOG.md");
  return parseChangelog(readFileSync(path, "utf8"));
}
