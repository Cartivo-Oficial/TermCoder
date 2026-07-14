import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ModelMessage } from "ai";

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  cwd: string;
  model: string;
  mode?: "build" | "plan";
  agent?: string;
  temperature?: number;
  maxSteps?: number;
  messages: ModelMessage[];
  usage?: { tokensIn: number; tokensOut: number };
}

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  cwd: string;
  model: string;
  messageCount: number;
  usage?: { tokensIn: number; tokensOut: number };
}

export function defaultSessionsDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.TERMCODER_DATA_DIR) return join(env.TERMCODER_DATA_DIR, "sessions");
  return join(homedir(), ".termcoder", "sessions");
}

export class SessionStore {
  private readonly baseDir: string;

  constructor(baseDir: string = defaultSessionsDir()) {
    this.baseDir = baseDir;
  }

  private file(id: string): string {
    return join(this.baseDir, `${id}.json`);
  }

  private ensureDir(): void {
    mkdirSync(this.baseDir, { recursive: true });
  }

  create(opts: {
    cwd: string;
    model: string;
    title?: string;
    mode?: "build" | "plan";
    agent?: string;
    temperature?: number;
    maxSteps?: number;
  }): SessionRecord {
    const now = Date.now();
    const record: SessionRecord = {
      id: randomUUID(),
      title: opts.title ?? "Untitled session",
      createdAt: now,
      updatedAt: now,
      cwd: opts.cwd,
      model: opts.model,
      mode: opts.mode,
      agent: opts.agent,
      temperature: opts.temperature,
      maxSteps: opts.maxSteps,
      messages: [],
    };
    this.save(record);
    return record;
  }

  exists(id: string): boolean {
    return existsSync(this.file(id));
  }

  save(record: SessionRecord): void {
    this.ensureDir();
    record.updatedAt = Date.now();
    writeFileSync(this.file(record.id), JSON.stringify(record, null, 2), "utf8");
  }

  import(record: SessionRecord): void {
    this.ensureDir();
    writeFileSync(this.file(record.id), JSON.stringify(record, null, 2), "utf8");
  }

  load(id: string): SessionRecord {
    if (!this.exists(id)) throw new Error(`Session not found: ${id}`);
    return JSON.parse(readFileSync(this.file(id), "utf8")) as SessionRecord;
  }

  delete(id: string): boolean {
    if (!this.exists(id)) return false;
    rmSync(this.file(id), { force: true });
    return true;
  }

  deleteAll(): number {
    if (!existsSync(this.baseDir)) return 0;
    let removed = 0;
    for (const name of readdirSync(this.baseDir)) {
      if (!name.endsWith(".json")) continue;
      rmSync(join(this.baseDir, name), { force: true });
      removed += 1;
    }
    return removed;
  }

  list(): SessionSummary[] {
    if (!existsSync(this.baseDir)) return [];
    const summaries: SessionSummary[] = [];
    for (const name of readdirSync(this.baseDir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const record = JSON.parse(
          readFileSync(join(this.baseDir, name), "utf8"),
        ) as SessionRecord;
        summaries.push({
          id: record.id,
          title: record.title,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          cwd: record.cwd,
          model: record.model,
          messageCount: record.messages.length,
          usage: record.usage,
        });
      } catch {
      }
    }
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
