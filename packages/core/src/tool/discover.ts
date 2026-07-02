import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Schema } from "ai";
import type { z } from "zod";
import type { PermissionKind } from "../permission/permission";
import type { TermTool, ToolContext, ToolResult } from "../tools/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The shape a user's tool file may export (both native and OpenCode styles). */
interface RawTool {
  name?: string;
  description?: string;
  /** zod schema — OpenCode calls this `args`, we call it `inputSchema`. */
  args?: z.ZodType | Schema;
  inputSchema?: z.ZodType | Schema;
  readOnly?: boolean;
  permissionKind?: PermissionKind;
  execute?: (args: any, ctx: ToolContext) => Promise<string | ToolResult> | string | ToolResult;
  run?: (args: any, ctx: ToolContext) => Promise<ToolResult> | ToolResult;
}

function normalize(raw: RawTool, fallbackName: string): TermTool | null {
  const name = raw.name ?? fallbackName;
  const schema = raw.inputSchema ?? raw.args;
  const runner: TermTool["run"] | null = raw.run
    ? (input, ctx) => Promise.resolve(raw.run!(input, ctx))
    : raw.execute
      ? async (input, ctx) => {
          const r = await raw.execute!(input, ctx);
          return typeof r === "string" ? { output: r } : r;
        }
      : null;
  if (!name || !raw.description || !schema || !runner) return null;
  return {
    name,
    description: raw.description,
    inputSchema: schema as z.ZodType,
    readOnly: raw.readOnly ?? true,
    permissionKind: raw.permissionKind,
    run: runner,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface DiscoverToolsResult {
  tools: TermTool[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * Auto-discover user tools from `~/.config/termcoder/tools/` (global) and
 * `<cwd>/.termcoder/tools/` (project). Each `.js`/`.mjs`/`.cjs` file's default
 * (and named) exports become tools. (TypeScript must be compiled to JS first —
 * Node can't import `.ts` at runtime.)
 */
export async function discoverTools(opts: {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}): Promise<DiscoverToolsResult> {
  const env = opts.env ?? process.env;
  const dirs = [
    join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "termcoder", "tools"),
    join(opts.cwd, ".termcoder", "tools"),
  ];
  const tools: TermTool[] = [];
  const errors: DiscoverToolsResult["errors"] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!/\.(mjs|cjs|js)$/.test(f)) continue;
      const file = join(dir, f);
      try {
        const mod = (await import(pathToFileURL(file).href)) as Record<string, RawTool>;
        const base = f.replace(/\.(mjs|cjs|js)$/, "");
        const candidates: Array<[string, RawTool]> = [];
        if (mod.default) candidates.push([base, mod.default]);
        for (const [k, v] of Object.entries(mod)) {
          if (k === "default" || !v || typeof v !== "object") continue;
          if (v.execute || v.run) candidates.push([k, v]);
        }
        let added = 0;
        for (const [nm, raw] of candidates) {
          const tool = normalize(raw, nm);
          if (tool) {
            tools.push(tool);
            added += 1;
          }
        }
        if (added === 0) errors.push({ file, error: "no valid tool export" });
      } catch (err) {
        errors.push({ file, error: String(err) });
      }
    }
  }
  return { tools, errors };
}
