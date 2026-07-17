import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { deepMerge } from "../util/merge";

export const PermissionModeSchema = z.enum(["ask", "allow", "deny"]);
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

export const PermissionRuleSchema = z.union([
  PermissionModeSchema,
  z.record(z.string(), PermissionModeSchema),
]);
export type PermissionRule = z.infer<typeof PermissionRuleSchema>;

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
    headers: z.record(z.string(), z.string()).optional(),
    enabled: z.boolean().default(true),
  }),
]);
export type McpServerConfig = z.infer<typeof McpServerSchema>;

export const LspServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  extensions: z.array(z.string()).min(1),
  enabled: z.boolean().default(true),
});
export type LspServerConfig = z.infer<typeof LspServerSchema>;

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
  tools: z.union([z.array(z.string()), z.record(z.string(), z.boolean())]).optional(),
  color: z.string().optional(),
});
export type AgentConfig = z.infer<typeof AgentSchema>;

export const FormatterSchema = z.object({
  disabled: z.boolean().optional(),
  command: z.array(z.string()).optional(),
  extensions: z.array(z.string()).optional(),
  environment: z.record(z.string(), z.string()).optional(),
});
export type FormatterConfig = z.infer<typeof FormatterSchema>;

export const ConfigSchema = z.object({
  model: z.string().default("anthropic/claude-sonnet-5"),
  reasoning: z.boolean().default(true),
  theme: z.string().default("default"),
  keybinds: z.record(z.string(), z.string()).default({}),
  permission: z
    .object({
      bash: PermissionRuleSchema.default("ask"),
      write: PermissionRuleSchema.default("ask"),
      edit: PermissionRuleSchema.default("ask"),
      mcp: PermissionRuleSchema.default("ask"),
    })
    .default({}),
  providers: z
    .record(
      z.string(),
      z.object({
        apiKey: z.string().optional(),
        baseURL: z.string().optional(),
        oauth: z
          .object({ accessToken: z.string(), refreshToken: z.string(), expiresAt: z.number(), accountId: z.string().optional() })
          .optional(),
      }),
    )
    .default({}),
  mcp: z.record(z.string(), McpServerSchema).default({}),
  lsp: z.record(z.string(), LspServerSchema).default({}),
  plugins: z.array(z.string()).default([]),
  agent: z.record(z.string(), AgentSchema).default({}),
  termcoder: z
    .object({
      route: z.array(z.string()).optional(),
    })
    .default({}),
  formatter: z
    .union([z.boolean(), z.record(z.string(), FormatterSchema)])
    .default(false),
  github: z.object({ token: z.string().optional() }).default({}),
  context: z
    .object({
      maxToolOutputChars: z.number().int().positive().default(8000),
      keepRecentToolResults: z.number().int().positive().default(6),
      memoryChars: z.number().int().positive().default(4000),
      retrievalFiles: z.number().int().positive().default(8),
    })
    .default({}),
  reliability: z
    .object({
      idleTimeoutMs: z.number().int().positive().default(45000),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface LoadConfigOptions {
  cwd?: string;
  configDir?: string;
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
  configDir?: string;
  env?: NodeJS.ProcessEnv;
}

export function saveConfig(
  partial: Record<string, unknown>,
  options: SaveConfigOptions = {},
): string {
  const env = options.env ?? process.env;
  const configDir = options.configDir ?? defaultConfigDir(env);
  const file = join(configDir, "config.json");

  const existing = readJsonIfExists(file);
  const merged = deepMerge<Record<string, unknown>>(existing, partial);
  ConfigSchema.parse(merged);

  mkdirSync(configDir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return file;
}

export function readGlobalConfig(options: SaveConfigOptions = {}): Record<string, unknown> {
  const env = options.env ?? process.env;
  const configDir = options.configDir ?? defaultConfigDir(env);
  return readJsonIfExists(join(configDir, "config.json"));
}

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
