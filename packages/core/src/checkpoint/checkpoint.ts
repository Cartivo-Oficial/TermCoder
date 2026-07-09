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
  files: Record<string, string | null>;
}

export class CheckpointManager {
  private pending: Record<string, string | null> | null = null;

  constructor(private readonly dir: string) {}

  begin(): void {
    this.pending = {};
  }

  capture(absPath: string): void {
    if (!this.pending || absPath in this.pending) return;
    this.pending[absPath] = existsSync(absPath) ? readFileSync(absPath, "utf8") : null;
  }

  hasPending(): boolean {
    return !!this.pending && Object.keys(this.pending).length > 0;
  }

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

export function checkpointDir(cwd: string, sessionId: string): string {
  return join(cwd, ".termcoder", "checkpoints", sessionId);
}
