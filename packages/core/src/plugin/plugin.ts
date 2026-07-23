import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Config } from "../config/config";
import type { CommandDef } from "../command/commands";
import type { SessionEvent } from "../session/session";
import type { TermTool } from "../tools/types";

export interface PluginApi {
  config: Config;
  cwd: string;
  addTool: (tool: TermTool) => void;
  addCommand: (command: CommandDef) => void;
  onEvent: (handler: (event: SessionEvent) => void) => void;
  log: (message: string) => void;
}

export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  register: (api: PluginApi) => void | Promise<void>;
}

export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

export interface LoadPluginsResult {
  tools: TermTool[];
  commands: CommandDef[];
  hooks: Array<(event: SessionEvent) => void>;
  logs: string[];
  plugins: Array<{ name: string; version?: string; description?: string; ok: boolean; toolCount: number; commandCount: number; hookCount: number; error?: string }>;
}

function looksLikePath(spec: string): boolean {
  return spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("\\") || spec.startsWith("file:") || /^[A-Za-z]:[\\/]/.test(spec);
}

function toImportSpecifier(spec: string, cwd: string): string {
  if (spec.startsWith("file:")) return spec;
  if (looksLikePath(spec)) return pathToFileURL(isAbsolute(spec) ? spec : resolve(cwd, spec)).href;
  return spec;
}

export function discoverPluginSpecifiers(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isFile() && /\.(mjs|js|cjs)$/.test(name)) {
      out.push(pathToFileURL(full).href);
    } else if (st.isDirectory()) {
      for (const idx of ["index.mjs", "index.js", "index.cjs"]) {
        const p = join(full, idx);
        if (existsSync(p)) { out.push(pathToFileURL(p).href); break; }
      }
    }
  }
  return out;
}

export function runHooks(hooks: Array<(event: SessionEvent) => void>, event: SessionEvent): void {
  for (const h of hooks) {
    try { h(event); } catch { }
  }
}

export async function loadPlugins(
  specifiers: string[],
  context: { config: Config; cwd: string; pluginsDir?: string },
): Promise<LoadPluginsResult> {
  const pluginsDir = context.pluginsDir ?? join(homedir(), ".termcoder", "plugins");
  const wanted = [...specifiers.map((s) => toImportSpecifier(s, context.cwd)), ...discoverPluginSpecifiers(pluginsDir)];
  const seen = new Set<string>();
  const list = wanted.filter((s) => (seen.has(s) ? false : (seen.add(s), true)));

  const tools: TermTool[] = [];
  const commands: CommandDef[] = [];
  const hooks: Array<(event: SessionEvent) => void> = [];
  const logs: string[] = [];
  const plugins: LoadPluginsResult["plugins"] = [];

  const api: PluginApi = {
    config: context.config,
    cwd: context.cwd,
    addTool: (tool) => tools.push(tool),
    addCommand: (command) => commands.push(command),
    onEvent: (handler) => hooks.push(handler),
    log: (message) => logs.push(message),
  };

  for (const spec of list) {
    const bt = tools.length, bc = commands.length, bh = hooks.length;
    try {
      const mod = (await import(spec)) as { default?: Plugin; plugin?: Plugin };
      const plugin = mod.default ?? mod.plugin;
      if (!plugin || typeof plugin.register !== "function") {
        throw new Error("plugin must export (default or `plugin`) an object with a register()");
      }
      await plugin.register(api);
      plugins.push({ name: plugin.name, version: plugin.version, description: plugin.description, ok: true, toolCount: tools.length - bt, commandCount: commands.length - bc, hookCount: hooks.length - bh });
    } catch (err) {
      plugins.push({ name: spec, ok: false, toolCount: 0, commandCount: 0, hookCount: 0, error: String(err) });
    }
  }

  return { tools, commands, hooks, logs, plugins };
}
