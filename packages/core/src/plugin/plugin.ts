import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Config } from "../config/config";
import type { TermTool } from "../tools/types";

export interface PluginApi {
  config: Config;
  cwd: string;
  addTool: (tool: TermTool) => void;
  log: (message: string) => void;
}

export interface Plugin {
  name: string;
  register: (api: PluginApi) => void | Promise<void>;
}

export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

export interface LoadPluginsResult {
  tools: TermTool[];
  logs: string[];
  plugins: Array<{ name: string; ok: boolean; toolCount: number; error?: string }>;
}

function looksLikePath(spec: string): boolean {
  return (
    spec.startsWith(".") ||
    spec.startsWith("/") ||
    spec.startsWith("\\") ||
    spec.startsWith("file:") ||
    /^[A-Za-z]:[\\/]/.test(spec)
  );
}

function toImportSpecifier(spec: string, cwd: string): string {
  if (spec.startsWith("file:")) return spec;
  if (looksLikePath(spec)) {
    return pathToFileURL(isAbsolute(spec) ? spec : resolve(cwd, spec)).href;
  }
  return spec; // bare package name
}

export async function loadPlugins(
  specifiers: string[],
  context: { config: Config; cwd: string },
): Promise<LoadPluginsResult> {
  const tools: TermTool[] = [];
  const logs: string[] = [];
  const plugins: LoadPluginsResult["plugins"] = [];

  const api: PluginApi = {
    config: context.config,
    cwd: context.cwd,
    addTool: (tool) => tools.push(tool),
    log: (message) => logs.push(message),
  };

  for (const spec of specifiers) {
    const before = tools.length;
    try {
      const mod = (await import(toImportSpecifier(spec, context.cwd))) as {
        default?: Plugin;
        plugin?: Plugin;
      };
      const plugin = mod.default ?? mod.plugin;
      if (!plugin || typeof plugin.register !== "function") {
        throw new Error("plugin must export (default or `plugin`) an object with a register()");
      }
      await plugin.register(api);
      plugins.push({ name: plugin.name, ok: true, toolCount: tools.length - before });
    } catch (err) {
      plugins.push({ name: spec, ok: false, toolCount: 0, error: String(err) });
    }
  }

  return { tools, logs, plugins };
}
