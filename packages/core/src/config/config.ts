import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { deepMerge } from "../util/merge";

/** How a class of potentially-dangerous action is handled by default. */
export const PermissionModeSchema = z.enum(["ask", "allow", "deny"]);
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

export const ConfigSchema = z.object({
  /** Provider-qualified model id, e.g. "anthropic/claude-sonnet-4-6". */
  model: z.string().default("anthropic/claude-sonnet-4-6"),
  /** Named theme from the built-in palette. */
  theme: z.string().default("default"),
  /** Optional keybind overrides (action -> key). */
  keybinds: z.record(z.string(), z.string()).default({}),
  /** Default handling per tool class that can mutate the workspace. */
  permission: z
    .object({
      bash: PermissionModeSchema.default("ask"),
      write: PermissionModeSchema.default("ask"),
      edit: PermissionModeSchema.default("ask"),
    })
    .default({}),
  /** Per-provider settings; apiKey falls back to environment variables. */
  providers: z
    .record(z.string(), z.object({ apiKey: z.string().optional() }))
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface LoadConfigOptions {
  /** Project root; project config is read from `<cwd>/.termcoder/config.json`. */
  cwd?: string;
  /** Global config directory; defaults to XDG_CONFIG_HOME or ~/.config/termcoder. */
  configDir?: string;
  /** Environment used for overrides and provider keys. */
  env?: NodeJS.ProcessEnv;
}

function defaultConfigDir(env: NodeJS.ProcessEnv): string {
  const xdg = env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "termcoder");
  return join(homedir(), ".config", "termcoder");
}

function readJsonIfExists(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Invalid JSON in config file ${path}: ${(err as Error).message}`);
  }
}

function envOverrides(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  if (env.TERMCODER_MODEL) overrides.model = env.TERMCODER_MODEL;
  if (env.TERMCODER_THEME) overrides.theme = env.TERMCODER_THEME;
  return overrides;
}

/**
 * Load configuration by layering: schema defaults < global file < project file
 * < environment overrides. The merged object is validated by {@link ConfigSchema},
 * so a malformed value produces a clear error rather than silently breaking later.
 */
export function loadConfig(options: LoadConfigOptions = {}): Config {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const configDir = options.configDir ?? defaultConfigDir(env);

  const globalRaw = readJsonIfExists(join(configDir, "config.json"));
  const projectRaw = readJsonIfExists(join(cwd, ".termcoder", "config.json"));

  const merged = deepMerge<Record<string, unknown>>(
    globalRaw,
    projectRaw,
    envOverrides(env),
  );

  return ConfigSchema.parse(merged);
}
