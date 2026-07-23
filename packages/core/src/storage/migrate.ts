import { existsSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { SessionRecord } from "./storage";

export function migrateJsonSessions(
  baseDir: string,
  store: { exists(id: string): boolean; import(record: SessionRecord): void },
): number {
  if (!existsSync(baseDir)) return 0;
  let migrated = 0;
  for (const name of readdirSync(baseDir)) {
    if (!name.endsWith(".json") || name.endsWith(".json.bak")) continue;
    const full = join(baseDir, name);
    let record: SessionRecord;
    try {
      record = JSON.parse(readFileSync(full, "utf8")) as SessionRecord;
    } catch {
      continue;
    }
    try {
      if (!store.exists(record.id)) {
        store.import(record);
        migrated += 1;
      }
      renameSync(full, full + ".bak");
    } catch {
      try {
        renameSync(full, full + ".failed");
      } catch {}
    }
  }
  return migrated;
}
