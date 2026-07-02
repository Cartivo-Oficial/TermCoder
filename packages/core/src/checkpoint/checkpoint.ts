import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

interface CheckpointData {
  turnId: string;
  /** Original content per absolute path; null means the file did not exist. */
  files: Record<string, string | null>;
}

/**
 * Snapshots files just before the agent first modifies them in a turn, so a
 * whole turn's file changes can be undone with one click. Snapshots live under
 * `<dir>/latest.json` and are consumed (deleted) on revert.
 */
export class CheckpointManager {
  private pending: Record<string, string | null> | null = null;

  constructor(private readonly dir: string) {}

  /** Start capturing for a new turn. */
  begin(): void {
    this.pending = {};
  }

  /** Record a file's pre-change state once. No-op if already captured. */
  capture(absPath: string): void {
    if (!this.pending || absPath in this.pending) return;
    this.pending[absPath] = existsSync(absPath) ? readFileSync(absPath, "utf8") : null;
  }

  /** Whether the current (uncommitted) turn has captured any file changes. */
  hasPending(): boolean {
    return !!this.pending && Object.keys(this.pending).length > 0;
  }

  /** Persist the captured snapshot as the latest. Returns true if it had files. */
  commit(turnId: string): boolean {
    const files = this.pending;
    this.pending = null;
    if (!files || Object.keys(files).length === 0) return false;
    mkdirSync(this.dir, { recursive: true });
    const data: CheckpointData = { turnId, files };
    writeFileSync(this.latestFile(), JSON.stringify(data), "utf8");
    return true;
  }

  hasLatest(): boolean {
    return existsSync(this.latestFile());
  }

  /** Restore files from the latest snapshot and consume it. Returns restored paths. */
  revertLatest(): string[] {
    const file = this.latestFile();
    if (!existsSync(file)) return [];
    const data = JSON.parse(readFileSync(file, "utf8")) as CheckpointData;
    const restored: string[] = [];
    for (const [path, content] of Object.entries(data.files)) {
      if (content === null) {
        if (existsSync(path)) rmSync(path, { force: true });
      } else {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content, "utf8");
      }
      restored.push(path);
    }
    rmSync(file, { force: true });
    return restored;
  }

  private latestFile(): string {
    return join(this.dir, "latest.json");
  }
}

/** Default checkpoint directory for a session. */
export function checkpointDir(cwd: string, sessionId: string): string {
  return join(cwd, ".termcoder", "checkpoints", sessionId);
}
