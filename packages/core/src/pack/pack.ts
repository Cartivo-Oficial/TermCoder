import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GitHubClient, parseGistId } from "../github/github";


export const PACK_KINDS = ["agents", "skills", "commands"] as const;
export type PackKind = (typeof PACK_KINDS)[number];

export interface PackManifest {
  name: string;
  description?: string;
  author?: string;
}

export interface PackItem {
  kind: PackKind;
  filename: string;
  content: string;
}

export interface Pack {
  manifest: PackManifest;
  items: PackItem[];
}

function globalTermcoderDir(env: NodeJS.ProcessEnv): string {
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "termcoder");
}

function termcoderDir(target: "project" | "global", cwd: string, env: NodeJS.ProcessEnv): string {
  return target === "global" ? globalTermcoderDir(env) : join(cwd, ".termcoder");
}

function gistName(item: PackItem): string {
  return `${item.kind}__${item.filename}`;
}

function parseGistName(name: string): { kind: PackKind; filename: string } | undefined {
  const m = name.match(/^(agents|skills|commands)__(.+\.md)$/);
  return m ? { kind: m[1] as PackKind, filename: m[2]! } : undefined;
}

export function readPack(dir: string): PackItem[] {
  const items: PackItem[] = [];
  for (const kind of PACK_KINDS) {
    const d = join(dir, kind);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (!f.endsWith(".md")) continue;
      items.push({ kind, filename: f, content: readFileSync(join(d, f), "utf8") });
    }
  }
  return items;
}

export async function publishPack(
  manifest: PackManifest,
  dir: string,
  client: GitHubClient,
  opts: { public?: boolean } = {},
): Promise<string> {
  const items = readPack(dir);
  if (items.length === 0) throw new Error(`No agents, skills, or commands found in ${dir}`);
  const files: Record<string, { content: string }> = {
    "pack.json": { content: JSON.stringify(manifest, null, 2) },
  };
  for (const it of items) files[gistName(it)] = { content: it.content };
  const gist = await client.createGist({
    description: `termcoder-pack: ${manifest.name}${manifest.description ? ` — ${manifest.description}` : ""}`,
    public: opts.public ?? false,
    files,
  });
  return gist.html_url;
}

export async function fetchPack(ref: string, client: GitHubClient): Promise<Pack> {
  const repoMatch = ref.match(/^([\w.-]+)\/([\w.-]+)(?:\/(.+))?$/);
  if (repoMatch && !ref.includes("gist.github")) {
    const owner = repoMatch[1]!;
    const repo = repoMatch[2]!;
    const base = repoMatch[3] ?? ".termcoder";
    let manifest: PackManifest = { name: repo };
    try {
      manifest = JSON.parse(await client.getRepoFile(owner, repo, `${base}/pack.json`)) as PackManifest;
    } catch {
    }
    const items: PackItem[] = [];
    for (const kind of PACK_KINDS) {
      let entries: Array<{ name: string; path: string; type: string }> = [];
      try {
        entries = await client.listRepoDir(owner, repo, `${base}/${kind}`);
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e.type !== "file" || !e.name.endsWith(".md")) continue;
        items.push({ kind, filename: e.name, content: await client.getRepoFile(owner, repo, e.path) });
      }
    }
    return { manifest, items };
  }

  const gist = await client.getGist(parseGistId(ref));
  let manifest: PackManifest = { name: "pack" };
  const items: PackItem[] = [];
  for (const name of Object.keys(gist.files)) {
    const content = (await client.gistFileContent(gist, name)) ?? "";
    if (name === "pack.json") {
      try {
        manifest = JSON.parse(content) as PackManifest;
      } catch {
      }
      continue;
    }
    const parsed = parseGistName(name);
    if (parsed) items.push({ ...parsed, content });
  }
  return { manifest, items };
}

export function writePack(
  pack: Pack,
  target: "project" | "global",
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const base = termcoderDir(target, cwd, env);
  const written: string[] = [];
  for (const it of pack.items) {
    const d = join(base, it.kind);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, it.filename), it.content, "utf8");
    written.push(join(it.kind, it.filename));
  }
  return written;
}

export async function installPack(
  ref: string,
  client: GitHubClient,
  opts: { target?: "project" | "global"; cwd: string; env?: NodeJS.ProcessEnv },
): Promise<{ manifest: PackManifest; written: string[] }> {
  const pack = await fetchPack(ref, client);
  if (pack.items.length === 0) throw new Error("That reference has no termcoder pack items.");
  const written = writePack(pack, opts.target ?? "project", opts.cwd, opts.env);
  return { manifest: pack.manifest, written };
}
