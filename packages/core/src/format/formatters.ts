import { spawnSync } from "node:child_process";
import { extname } from "node:path";
import type { Config, FormatterConfig } from "../config/config";

interface Formatter {
  name: string;
  command: string[];
  extensions: string[];
  environment?: Record<string, string>;
}

/** Built-in formatters. `$FILE` is replaced with the edited file's path. */
const BUILTINS: Formatter[] = [
  {
    name: "prettier",
    command: ["prettier", "--write", "$FILE"],
    extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".less", ".html", ".vue", ".svelte", ".md", ".mdx", ".yaml", ".yml"],
  },
  { name: "gofmt", command: ["gofmt", "-w", "$FILE"], extensions: [".go"] },
  { name: "rustfmt", command: ["rustfmt", "$FILE"], extensions: [".rs"] },
  { name: "ruff", command: ["ruff", "format", "$FILE"], extensions: [".py"] },
  { name: "shfmt", command: ["shfmt", "-w", "$FILE"], extensions: [".sh", ".bash"] },
  { name: "clang-format", command: ["clang-format", "-i", "$FILE"], extensions: [".c", ".cc", ".cpp", ".cxx", ".h", ".hpp"] },
];

/** Which formatters apply to a file extension, given the config. */
export function formattersFor(config: Config, ext: string): Formatter[] {
  const f = config.formatter;
  if (f === false || f === undefined) return [];
  const overrides: Record<string, FormatterConfig> = typeof f === "object" && f !== null ? f : {};
  const result: Formatter[] = [];
  for (const b of BUILTINS) {
    const o = overrides[b.name];
    if (o?.disabled) continue;
    const extensions = o?.extensions ?? b.extensions;
    if (extensions.includes(ext)) {
      result.push({ name: b.name, command: o?.command ?? b.command, extensions, environment: o?.environment });
    }
  }
  // Custom formatters (a config key that isn't a built-in).
  for (const [name, o] of Object.entries(overrides)) {
    if (BUILTINS.some((b) => b.name === name) || o?.disabled) continue;
    if (o.command && o.extensions && o.extensions.includes(ext)) {
      result.push({ name, command: o.command, extensions: o.extensions, environment: o.environment });
    }
  }
  return result;
}

/**
 * Run the matching formatters on a file. Best-effort: a missing formatter
 * binary is silently skipped (it never fails the edit). Returns the names that
 * actually ran.
 */
export function formatFile(config: Config, absPath: string, cwd: string): string[] {
  const ext = extname(absPath).toLowerCase();
  const ran: string[] = [];
  for (const f of formattersFor(config, ext)) {
    const [bin, ...rest] = f.command;
    if (!bin) continue;
    const args = rest.map((a) => (a === "$FILE" ? absPath : a));
    const r = spawnSync(bin, args, {
      cwd,
      encoding: "utf8",
      timeout: 15_000,
      env: f.environment ? { ...process.env, ...f.environment } : process.env,
    });
    if (!r.error && r.status === 0) ran.push(f.name);
  }
  return ran;
}
