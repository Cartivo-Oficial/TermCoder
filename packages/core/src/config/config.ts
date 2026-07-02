import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { deepMerge } from "../util/merge";

/** How a class of potentially-dangerous action is handled by default. */
export const PermissionModeSchema = z.enum(["ask", "allow", "deny"]);
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

/**
 * A permission rule is either a single mode applied to every action of its
 * kind, or a map of glob patterns to modes for fine-grained, path-aware control
 * (e.g. `{ "src/**": "allow", "**\/*.env": "deny", "**": "ask" }`). Later
 * matching patterns win. Globs are matched against the file path (write/edit) or
 * the command string (bash).
 */
export const PermissionRuleSchema = z.union([
  PermissionModeSchema,
  z.record(z.string(), PermissionModeSchema),
]);
export type PermissionRule = z.infer<typeof PermissionRuleSchema>;

/** How to connect to an external MCP (Model Context Protocol) server. */
export const McpServerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stdio"),
    command: z.string(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
    enabled: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("http"),
    url: z.string().url(),
    enabled: z.boolean().default(true),
  }),
]);
export type McpServerConfig = z.infer<typeof McpServerSchema>;

/** A language server to launch over stdio, keyed by the file extensions it handles. */
export const LspServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  extensions: z.array(z.string()).min(1),
  enabled: z.boolean().default(true),
});
export type LspServerConfig = z.infer<typeof LspServerSchema>;

/** A configurable agent: a model/prompt/permission/tool profile. */
export const AgentSchema = z.object({
  description: z.string().optional(),
  mode: z.enum(["primary", "subagent", "all"]).default("all"),
  model: z.string().optional(),
  prompt: z.string().optional(),
  temperature: z.number().optional(),
  steps: z.number().optional(),
  permission: z
    .object({
      bash: PermissionRuleSchema,
      write: PermissionRuleSchema,
      edit: PermissionRuleSchema,
      mcp: PermissionRuleSchema,
    })
    .partial()
    .optional(),
  /** Allowlist of tool names; omit for "all permitted". */
  tools: z.union([z.array(z.string()), z.record(z.string(), z.boolean())]).optional(),
  color: z.string().optional(),
});
export type AgentConfig = z.infer<typeof AgentSchema>;

/** A file formatter: a command with `$FILE` placeholder run after edits. */
export const FormatterSchema = z.object({
  disabled: z.boolean().optional(),
  command: z.array(z.string()).optional(),
  extensions: z.array(z.string()).optional(),
  environment: z.record(z.string(), z.string()).optional(),
});
export type FormatterConfig = z.infer<typeof FormatterSchema>;

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
      bash: PermissionRuleSchema.default("ask"),
      write: PermissionRuleSchema.default("ask"),
      edit: PermissionRuleSchema.default("ask"),
      mcp: PermissionRuleSchema.default("ask"),
    })
    .default({}),
  /** Per-provider settings; apiKey falls back to environment variables. */
  providers: z
    .record(
      z.string(),
      z.object({
        apiKey: z.string().optional(),
        /** Override the API base URL (for OpenAI-compatible servers like Groq, OpenRouter, local). */
        baseURL: z.string().optional(),
      }),
    )
    .default({}),
  /** External MCP servers to connect at startup, keyed by name. */
  mcp: z.record(z.string(), McpServerSchema).default({}),
  /** Language servers to launch at startup, keyed by name. */
  lsp: z.record(z.string(), LspServerSchema).default({}),
  /** Plugin module specifiers (package names or file paths) to load at startup. */
  plugins: z.array(z.string()).default([]),
  /** Named, configurable agents (model/prompt/permission/tool profiles). */
  agent: z.record(z.string(), AgentSchema).default({}),
  /** Settings for the built-in "termcoder/auto" orchestrator. */
  termcoder: z
    .object({
      /** Ordered model ids the router should prefer; first wins. */
      route: z.array(z.string()).optional(),
    })
    .default({}),
  /** Auto-format edited files: `true` enables all built-ins, or configure per name. */
  formatter: z
    .union([z.boolean(), z.record(z.string(), FormatterSchema)])
    .default(false),
  /** GitHub integration (e.g. a token for publishing sessions as Gists). */
  github: z.object({ token: z.string().optional() }).default({}),
  /** Token-economy controls: bound how much tool output is fed back to the model. */
  context: z
    .object({
      /** Max characters of any single tool result sent to the model (head+tail kept). */
      maxToolOutputChars: z.number().int().positive().default(8000),
      /** Keep this many most-recent tool results in full; older ones are elided. */
      keepRecentToolResults: z.number().int().positive().default(6),
    })
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

/** Find the nearest `.termcoder/config.json` walking up from `startDir`. */
function findProjectConfig(startDir: string): string | undefined {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, ".termcoder", "config.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
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
  const projectConfigPath = findProjectConfig(cwd);
  const projectRaw = projectConfigPath ? readJsonIfExists(projectConfigPath) : {};

  const merged = deepMerge<Record<string, unknown>>(
    globalRaw,
    projectRaw,
    envOverrides(env),
  );

  return ConfigSchema.parse(merged);
}

export interface SaveConfigOptions {
  /** Global config directory; defaults to XDG_CONFIG_HOME or ~/.config/termcoder. */
  configDir?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Merge a partial config into the global `config.json` and persist it. The
 * merged result is validated against {@link ConfigSchema} first, so the UI can
 * never write something {@link loadConfig} would later reject. Returns the path
 * written.
 */
export function saveConfig(
  partial: Record<string, unknown>,
  options: SaveConfigOptions = {},
): string {
  const env = options.env ?? process.env;
  const configDir = options.configDir ?? defaultConfigDir(env);
  const file = join(configDir, "config.json");

  const existing = readJsonIfExists(file);
  const merged = deepMerge<Record<string, unknown>>(existing, partial);
  // Throws on a type error before we touch disk (defaults fill in the rest).
  ConfigSchema.parse(merged);

  mkdirSync(configDir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return file;
}

/** The raw (un-merged) global config object, for edits that add/remove keys. */
export function readGlobalConfig(options: SaveConfigOptions = {}): Record<string, unknown> {
  const env = options.env ?? process.env;
  const configDir = options.configDir ?? defaultConfigDir(env);
  return readJsonIfExists(join(configDir, "config.json"));
}

/** Validate and persist a full global config object (replacing the file). */
export function writeGlobalConfig(
  config: Record<string, unknown>,
  options: SaveConfigOptions = {},
): void {
  const env = options.env ?? process.env;
  const configDir = options.configDir ?? defaultConfigDir(env);
  ConfigSchema.parse(config);
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
