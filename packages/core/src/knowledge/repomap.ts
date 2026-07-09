import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";


const IGNORE = new Set([
  "node_modules", ".git", "dist", "out", "release", ".next", ".turbo", ".cache",
  "coverage", ".idea", ".vscode", "vendor", "target", "__pycache__",
]);

interface Stack {
  stack: string[];
  scripts: Record<string, string>;
}

function detectStack(cwd: string): Stack {
  const stack: string[] = [];
  const scripts: Record<string, string> = {};

  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
        workspaces?: unknown;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      stack.push("Node/JS");
      if (deps.typescript) stack.push("TypeScript");
      if (deps.react) stack.push("React");
      if (deps.next) stack.push("Next.js");
      if (deps.vue) stack.push("Vue");
      if (deps.svelte) stack.push("Svelte");
      if (deps.electron) stack.push("Electron");
      if (deps.express || deps.fastify || deps.koa || deps.hono) stack.push("Node server");
      if (deps.vitest) stack.push("Vitest");
      else if (deps.jest) stack.push("Jest");
      if (pkg.workspaces || existsSync(join(cwd, "pnpm-workspace.yaml"))) stack.push("monorepo");
      for (const k of ["build", "test", "lint", "typecheck", "dev", "start"]) {
        if (pkg.scripts?.[k]) scripts[k] = pkg.scripts[k]!;
      }
    } catch {
    }
  }

  const marker = (file: string, label: string) => {
    if (existsSync(join(cwd, file))) stack.push(label);
  };
  marker("go.mod", "Go");
  marker("Cargo.toml", "Rust");
  if (
    existsSync(join(cwd, "pyproject.toml")) ||
    existsSync(join(cwd, "requirements.txt")) ||
    existsSync(join(cwd, "setup.py"))
  ) {
    stack.push("Python");
  }
  if (existsSync(join(cwd, "pom.xml")) || existsSync(join(cwd, "build.gradle"))) stack.push("Java/JVM");
  marker("Gemfile", "Ruby");
  marker("composer.json", "PHP");
  marker("Dockerfile", "Docker");

  return { stack, scripts };
}

function countFiles(dir: string, depth = 0): number {
  if (depth > 4) return 0;
  let n = 0;
  try {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORE.has(ent.name)) continue;
      if (ent.isDirectory()) n += countFiles(join(dir, ent.name), depth + 1);
      else n++;
      if (n > 9999) break;
    }
  } catch {
  }
  return n;
}

function topDirs(cwd: string): Array<{ name: string; files: number }> {
  const out: Array<{ name: string; files: number }> = [];
  try {
    for (const ent of readdirSync(cwd, { withFileTypes: true })) {
      if (!ent.isDirectory() || IGNORE.has(ent.name) || ent.name.startsWith(".")) continue;
      out.push({ name: ent.name, files: countFiles(join(cwd, ent.name)) });
    }
  } catch {
  }
  return out.sort((a, b) => b.files - a.files).slice(0, 12);
}

const ENTRY_CANDIDATES = [
  "src/index.ts", "src/index.js", "src/main.ts", "src/main.tsx", "src/app.tsx",
  "src/cli.tsx", "src/cli.ts", "index.ts", "index.js", "main.py", "main.go",
  "src/main.rs", "cmd/main.go", "app.py", "server.js", "server.ts",
];

function entryPoints(cwd: string): string[] {
  return ENTRY_CANDIDATES.filter((p) => existsSync(join(cwd, p)));
}

export function projectSummary(cwd: string): string {
  const { stack, scripts } = detectStack(cwd);
  const dirs = topDirs(cwd);
  const entries = entryPoints(cwd);
  if (stack.length === 0 && dirs.length === 0) return "";

  const lines = ["Project map (auto-detected — verify before relying on it):"];
  if (stack.length) lines.push(`- Stack: ${stack.join(", ")}`);
  const scriptKeys = Object.keys(scripts);
  if (scriptKeys.length) lines.push(`- Scripts available: ${scriptKeys.join(", ")} (see the repomap tool for commands)`);
  if (dirs.length) lines.push(`- Key dirs: ${dirs.map((d) => `${d.name}/ (${d.files} files)`).join(", ")}`);
  if (entries.length) lines.push(`- Entry points: ${entries.join(", ")}`);
  return lines.join("\n");
}

function exportsOf(cwd: string, rel: string): string[] {
  try {
    const text = readFileSync(join(cwd, rel), "utf8");
    const names = new Set<string>();
    const re = /export\s+(?:async\s+)?(?:function|class|const|let|interface|type|enum)\s+([A-Za-z0-9_]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) names.add(m[1]!);
    if (/export\s+default/.test(text)) names.add("default");
    return [...names].slice(0, 30);
  } catch {
    return [];
  }
}

function shallowTree(cwd: string, rel: string): string[] {
  try {
    return readdirSync(join(cwd, rel), { withFileTypes: true })
      .filter((e) => !IGNORE.has(e.name))
      .slice(0, 40)
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  } catch {
    return [];
  }
}

export function repoDetail(cwd: string): string {
  const { stack, scripts } = detectStack(cwd);
  const dirs = topDirs(cwd);
  const entries = entryPoints(cwd);
  const out: string[] = ["# Repository map", ""];

  if (stack.length) out.push(`**Stack:** ${stack.join(", ")}`, "");
  const scriptKeys = Object.keys(scripts);
  if (scriptKeys.length) {
    out.push("**Scripts:**");
    for (const k of scriptKeys) out.push(`- \`${k}\` → \`${scripts[k]}\``);
    out.push("");
  }
  if (dirs.length) {
    out.push("**Top-level directories:**");
    for (const d of dirs) {
      const tree = shallowTree(cwd, d.name);
      out.push(`- \`${d.name}/\` (${d.files} files): ${tree.slice(0, 12).join(", ")}${tree.length > 12 ? ", …" : ""}`);
    }
    out.push("");
  }
  if (entries.length) {
    out.push("**Entry points & their exports:**");
    for (const e of entries) {
      const syms = exportsOf(cwd, e);
      out.push(`- \`${e}\`${syms.length ? `: ${syms.join(", ")}` : ""}`);
    }
  }
  return out.join("\n").trim();
}
