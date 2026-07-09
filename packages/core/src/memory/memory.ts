import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "../util/frontmatter";
import { configDir } from "../util/paths";

export type MemoryScope = "project" | "user";
export type MemoryType = "project" | "preference" | "decision";

export interface MemoryEntry {
  name: string;
  description: string;
  type: MemoryType;
  body: string;
  scope: MemoryScope;
  file: string;
  updatedAt: number;
}

const MEMORY_TYPES: MemoryType[] = ["project", "preference", "decision"];

export function slugifyMemoryName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-") || "note";
}

export function looksLikeSecret(text: string): boolean {
  return (
    /\bsk-[A-Za-z0-9-]{15,}/.test(text) ||
    /\bAIza[0-9A-Za-z_-]{10,}/.test(text) ||
    /\bghp_[A-Za-z0-9]{10,}/.test(text) ||
    /\bxox[baprs]-[A-Za-z0-9-]{10,}/.test(text) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text) ||
    /\bAKIA[0-9A-Z]{16}\b/.test(text) || // AWS access key id
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./.test(text) || // JWT
    /:\/\/[^\s:@/]+:[^\s:@/]+@/.test(text) || // URL with inline credentials
    /\b(secret|token|password|passwd|api[_-]?key|access[_-]?key|private[_-]?key)\b\s*[:=]\s*['"]?\S{6,}/i.test(text)
  );
}

export interface DiscoverMemoriesOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

function projectDir(cwd: string): string {
  return join(cwd, ".termcoder", "memory");
}
function userDir(env?: NodeJS.ProcessEnv): string {
  return join(configDir(env ?? process.env), "memory");
}

function readMemoryDir(dir: string, scope: MemoryScope): MemoryEntry[] {
  if (!existsSync(dir)) return [];
  const out: MemoryEntry[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const file = join(dir, f);
    try {
      const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
      const name = typeof data.name === "string" && data.name.trim() ? slugifyMemoryName(data.name) : f.replace(/\.md$/, "");
      const description = typeof data.description === "string" ? data.description : "";
      const type = MEMORY_TYPES.includes(data.type as MemoryType) ? (data.type as MemoryType) : "project";
      out.push({ name, description, type, body: body.trim(), scope, file, updatedAt: statSync(file).mtimeMs });
    } catch {
    }
  }
  return out;
}

export function discoverMemories(opts: DiscoverMemoriesOptions): MemoryEntry[] {
  const byName = new Map<string, MemoryEntry>();
  for (const m of readMemoryDir(userDir(opts.env), "user")) byName.set(m.name, m);
  for (const m of readMemoryDir(projectDir(opts.cwd), "project")) byName.set(m.name, m);
  return [...byName.values()];
}

export function saveMemory(opts: {
  scope: MemoryScope; name: string; description: string; type: MemoryType; body: string;
  cwd: string; env?: NodeJS.ProcessEnv;
}): MemoryEntry {
  if (looksLikeSecret(opts.body) || looksLikeSecret(opts.description)) {
    throw new Error("Refusing to store what looks like a secret (API key or private key) in memory.");
  }
  const name = slugifyMemoryName(opts.name);
  const dir = opts.scope === "project" ? projectDir(opts.cwd) : userDir(opts.env);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.md`);
  const type: MemoryType = MEMORY_TYPES.includes(opts.type) ? opts.type : "project";
  const description = opts.description.replace(/\n/g, " ").trim();
  const md = `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\ntype: ${type}\n---\n${opts.body.trim()}\n`;
  writeFileSync(file, md, "utf8");
  return { name, description, type, body: opts.body.trim(), scope: opts.scope, file, updatedAt: Date.now() };
}

export function deleteMemory(opts: { name: string; cwd: string; env?: NodeJS.ProcessEnv }): boolean {
  const name = slugifyMemoryName(opts.name);
  let removed = false;
  for (const dir of [projectDir(opts.cwd), userDir(opts.env)]) {
    const file = join(dir, `${name}.md`);
    if (existsSync(file)) { rmSync(file); removed = true; }
  }
  return removed;
}

export function memoryIndex(mems: MemoryEntry[]): string {
  if (mems.length === 0) return "";
  return mems.map((m) => `- ${m.name}: ${m.description || "(no description)"}`).join("\n");
}

export function recallMemories(mems: MemoryEntry[], budgetChars: number): string {
  if (mems.length === 0) return "";
  const index = memoryIndex(mems);
  const ordered = [...mems].sort((a, b) => b.updatedAt - a.updatedAt);
  const bodies: string[] = [];
  let used = index.length;
  for (const m of ordered) {
    const block = `## ${m.name}\n${m.body}`;
    if (used + block.length + 2 > budgetChars) continue;
    bodies.push(block);
    used += block.length + 2;
  }
  return [
    "What you remember about this project and user — keep it in mind. Load any",
    "item's full text with the `memory` tool's `read` command, and save a new",
    "durable fact with its `save` command.",
    index,
    ...(bodies.length ? ["", ...bodies] : []),
  ].join("\n");
}
