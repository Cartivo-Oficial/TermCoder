import { existsSync } from "node:fs";
import { posix, win32 } from "node:path";

export interface ShellSpec {
  file: string;
  args: string[];
}

export interface QuickTool {
  id: string;
  label: string;
  command: string;
}

const STRIP_ENV = new Set([
  "ELECTRON_RUN_AS_NODE",
  "ELECTRON_NO_ATTACH_CONSOLE",
  "ELECTRON_NO_ASAR",
  "NODE_OPTIONS",
  "GDK_PIXBUF_MODULE_FILE",
  "GDK_PIXBUF_MODULEDIR",
]);

const CANDIDATES: Array<{ id: string; label: string; bin: string; command: string }> = [
  { id: "claude", label: "Claude Code", bin: "claude", command: "claude" },
  { id: "termcoder", label: "termcoder", bin: "term", command: "term" },
  { id: "codex", label: "Codex", bin: "codex", command: "codex" },
  { id: "gemini", label: "Gemini CLI", bin: "gemini", command: "gemini" },
];

export function defaultShell(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): ShellSpec {
  if (platform === "win32") return { file: env.ComSpec ?? "cmd.exe", args: [] };
  return { file: env.SHELL ?? "/bin/bash", args: ["-l"] };
}

export function terminalEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || STRIP_ENV.has(key)) continue;
    out[key] = value;
  }
  out.TERM = "xterm-256color";
  out.COLORTERM = "truecolor";
  return out;
}

export function resolveOnPath(
  name: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean = existsSync,
): string | null {
  const windows = platform === "win32";
  const path = env.PATH ?? env.Path ?? "";
  const dirs = path.split(windows ? ";" : ":").filter(Boolean);
  const exts = windows
    ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
    : [""];
  const join = windows ? win32.join : posix.join;
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}

export function detectQuickTools(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean = existsSync,
): QuickTool[] {
  return CANDIDATES.filter((c) => resolveOnPath(c.bin, env, platform, exists) !== null).map(
    ({ id, label, command }) => ({ id, label, command }),
  );
}
