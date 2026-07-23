# Plugins 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let plugins register slash commands and session-event hooks, carry a manifest (name/version/description), and be auto-discovered from `~/.termcoder/plugins/` — on top of the existing tool-adding capability.

**Architecture:** Task 1 rewrites the core `plugin.ts` (API + discovery + richer result + a guarded `runHooks` helper), node-tested. Task 2 wires it into the server: `createServer` deps gain plugin commands + hooks, `GET /commands` merges them, and the per-event stream loop invokes the hooks — without touching `session.ts`.

**Tech Stack:** TypeScript strict, vitest (`node` env). Node built-ins for discovery (`fs`/`path`/`url`/`os`).

## Global Constraints

- Source files carry NO comments (repo rule). Test files: descriptive names only.
- TypeScript strict (repo has `noUncheckedIndexedAccess: true`).
- Backward compatible: existing tool-only plugins keep working; `config.plugins` still honored; the discovery dir is optional. No plugin sandbox; no `addProvider`.
- Run a single test file with `npx vitest run <path>` from the worktree root.
- `SessionEvent` type is from `../session/session`; `CommandDef` from `../command/commands`.
- Commit after every task.

---

### Task 1: Core plugin API + discovery + hooks helper (`plugin.ts`)

**Files:**
- Modify (rewrite): `packages/core/src/plugin/plugin.ts`
- Test: `packages/core/src/plugin/plugin.test.ts` (extend; keep existing tests passing)

**Interfaces:**
- Produces:
  - `PluginApi { config; cwd; addTool; addCommand(c: CommandDef): void; onEvent(h: (e: SessionEvent) => void): void; log }`
  - `Plugin { name; version?: string; description?: string; register(api): void|Promise<void> }`
  - `LoadPluginsResult { tools: TermTool[]; commands: CommandDef[]; hooks: Array<(e: SessionEvent) => void>; logs: string[]; plugins: Array<{ name; version?; description?; ok; toolCount; commandCount; hookCount; error? }> }`
  - `discoverPluginSpecifiers(dir: string): string[]`
  - `loadPlugins(specifiers: string[], context: { config: Config; cwd: string; pluginsDir?: string }): Promise<LoadPluginsResult>`
  - `runHooks(hooks: Array<(e: SessionEvent) => void>, event: SessionEvent): void`
  - `definePlugin(plugin: Plugin): Plugin` (unchanged)

- [ ] **Step 1: Write the failing tests (append to plugin.test.ts)**

```ts
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPlugins, discoverPluginSpecifiers, runHooks } from "./plugin";
import type { Config } from "../config/config";
import type { SessionEvent } from "../session/session";

const CONFIG = { plugins: [] } as unknown as Config;

const PLUGIN_SRC = `export default {
  name: "demo", version: "1.2.0", description: "a demo",
  register(api) {
    api.addTool({ name: "demo_tool", description: "d", inputSchema: { parse: (x) => x }, readOnly: true, run: async () => ({ output: "ok" }) });
    api.addCommand({ name: "demo", description: "run demo", template: "do the demo" });
    api.onEvent((e) => { if (e.type === "done") api.log("done seen"); });
  },
};`;

describe("loadPlugins expanded", () => {
  let dir: string;
  let emptyDir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "tc-plug-")); emptyDir = mkdtempSync(join(tmpdir(), "tc-plug-empty-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); rmSync(emptyDir, { recursive: true, force: true }); });

  it("collects tools, commands, hooks, and manifest fields", async () => {
    const file = join(dir, "p.mjs");
    writeFileSync(file, PLUGIN_SRC, "utf8");
    const r = await loadPlugins([file], { config: CONFIG, cwd: dir, pluginsDir: emptyDir });
    expect(r.tools.map((t) => t.name)).toEqual(["demo_tool"]);
    expect(r.commands.map((c) => c.name)).toEqual(["demo"]);
    expect(r.hooks).toHaveLength(1);
    expect(r.plugins[0]).toMatchObject({ name: "demo", version: "1.2.0", description: "a demo", ok: true, toolCount: 1, commandCount: 1, hookCount: 1 });
  });

  it("auto-discovers .mjs files and index.mjs subdirs, and dedupes", async () => {
    const pdir = mkdtempSync(join(tmpdir(), "tc-plug-dir-"));
    writeFileSync(join(pdir, "a.mjs"), PLUGIN_SRC, "utf8");
    mkdirSync(join(pdir, "sub"));
    writeFileSync(join(pdir, "sub", "index.mjs"), PLUGIN_SRC, "utf8");
    const specs = discoverPluginSpecifiers(pdir);
    expect(specs).toHaveLength(2);
    const dup = specs[0]!;
    const r = await loadPlugins([dup], { config: CONFIG, cwd: pdir, pluginsDir: pdir });
    expect(r.plugins.filter((p) => p.ok)).toHaveLength(2);
    rmSync(pdir, { recursive: true, force: true });
  });

  it("returns empty specifiers for a missing dir", () => {
    expect(discoverPluginSpecifiers(join(dir, "nope"))).toEqual([]);
  });

  it("records a failed plugin without aborting the rest", async () => {
    const good = join(dir, "good.mjs"); writeFileSync(good, PLUGIN_SRC, "utf8");
    const bad = join(dir, "bad.mjs"); writeFileSync(bad, "export default { name: 'bad' };", "utf8");
    const r = await loadPlugins([good, bad], { config: CONFIG, cwd: dir, pluginsDir: emptyDir });
    expect(r.plugins.find((p) => p.ok === false)).toBeTruthy();
    expect(r.tools).toHaveLength(1);
  });
});

describe("runHooks", () => {
  it("calls every hook and swallows a throwing one", () => {
    const seen: string[] = [];
    const hooks = [(e: SessionEvent) => seen.push(e.type), () => { throw new Error("boom"); }, (e: SessionEvent) => seen.push("2:" + e.type)];
    expect(() => runHooks(hooks, { type: "done" })).not.toThrow();
    expect(seen).toEqual(["done", "2:done"]);
  });
});
```

- [ ] **Step 2: Run tests, verify fail** — `npx vitest run packages/core/src/plugin/plugin.test.ts` → FAIL (addCommand/onEvent/discoverPluginSpecifiers/runHooks not present).

- [ ] **Step 3: Rewrite `plugin.ts`**

```ts
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
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run packages/core/src/plugin/plugin.test.ts` (existing + new all green).
- [ ] **Step 5: Typecheck + confirm the core index re-export still compiles** — `cd packages/core && npx tsc --noEmit 2>&1 | grep -E 'plugin/' || echo CLEAN` → `CLEAN`. (`packages/core/src/index.ts` re-exports `loadPlugins` — still valid.)
- [ ] **Step 6: Commit** — `git add packages/core/src/plugin/plugin.ts packages/core/src/plugin/plugin.test.ts && git commit -m "feat(plugins): commands, session hooks, folder discovery, and manifest in the plugin API"`

---

### Task 2: Server wiring — deps, command merge, hook invocation (`server.ts`, `serve.ts`)

**Files:**
- Modify: `packages/server/src/server.ts` (`ServerDeps`; `GET /commands` + `POST /commands/expand`; the two stream loops)
- Modify: `packages/server/src/serve.ts` (pass `plugins.commands`/`plugins.hooks` into `createServer`)
- Test: `packages/server/src/server.test.ts` (extend)

**Interfaces:**
- Consumes: `CommandDef`, `SessionEvent`, `runHooks`, `LoadPluginsResult` from `@termcoder/core`.
- `ServerDeps` gains `pluginCommands?: CommandDef[]` and `pluginHooks?: Array<(e: SessionEvent) => void>`.

- [ ] **Step 1: Write the failing test (append to server.test.ts)**

Add a test that a server created with `pluginCommands` merges them into `GET /commands` and dedupes a name collision with a discovered/builtin command. Use the existing test's server-construction + fetch helpers (mirror how other endpoint tests in this file create a server and call it). Concretely:

```ts
it("merges plugin commands into GET /commands and dedupes by name", async () => {
  const srv = createServer({
    cwd: process.cwd(),
    pluginCommands: [
      { name: "deploy", description: "ship it", template: "deploy the app" },
      { name: "init", description: "override", template: "should be dropped" },
    ],
  });
  const res = await fetchJson(srv, "GET", "/commands");
  const names = (res as Array<{ name: string }>).map((c) => c.name);
  expect(names).toContain("deploy");
  expect(names.filter((n) => n === "init")).toHaveLength(1);
  const initCmd = (res as Array<{ name: string; description?: string }>).find((c) => c.name === "init");
  expect(initCmd!.description).not.toBe("override");
});
```

(Use the same `createServer` + request helper the surrounding tests use — read the top of `server.test.ts` for the exact `fetchJson`/request utility name and reuse it; do not invent a new harness. The builtin `init` command exists in `discoverCommands`, so the collision assertion is real.)

- [ ] **Step 2: Run test, verify fail** — `npx vitest run packages/server/src/server.test.ts` → FAIL (`pluginCommands` not in deps / not merged).

- [ ] **Step 3: Extend `ServerDeps`** (`packages/server/src/server.ts`, the interface at line ~105)

Add these two fields to `ServerDeps`:
```ts
  pluginCommands?: import("@termcoder/core").CommandDef[];
  pluginHooks?: Array<(event: import("@termcoder/core").SessionEvent) => void>;
```
(If `CommandDef`/`SessionEvent` are already imported at the top of the file, use the bare names instead of the inline `import(...)`.)

- [ ] **Step 4: Merge plugin commands in the two command handlers**

At the top of `createServer`'s request handler scope (where `deps` is in scope), add a helper that produces the merged command list for a cwd:
```ts
  const mergedCommands = (cwd: string): CommandDef[] => {
    const base = discoverCommands({ cwd });
    const names = new Set(base.map((c) => c.name));
    return [...base, ...(deps.pluginCommands ?? []).filter((c) => !names.has(c.name))];
  };
```
Then in `GET /commands` (server.ts:~673) replace `discoverCommands({ cwd: ctx.cwd })` with `mergedCommands(ctx.cwd)`, and in `POST /commands/expand` (server.ts:~686) replace `discoverCommands({ cwd: ctx.cwd }).find(...)` with `mergedCommands(ctx.cwd).find(...)`. (Ensure `CommandDef` is imported in `server.ts`; it already imports `discoverCommands` from `@termcoder/core`, add `CommandDef` to that import.)

- [ ] **Step 5: Invoke plugin hooks in the stream loops**

Import `runHooks` from `@termcoder/core` (add to the existing core import). In the prompt-streaming loop at server.ts:~1147:
```ts
    for await (const event of session.prompt(text, { signal, attachments })) {
      runHooks(deps.pluginHooks ?? [], event);
      // ... existing forwarding of event to the client unchanged ...
    }
```
Do the same in the `runAutonomous` loop at server.ts:~1172 IF it yields `SessionEvent`s (it yields autonomous events `ae`; only call `runHooks` there if `ae` is a `SessionEvent` — check its type; if it is a different shape, leave that loop alone and note it). `runHooks` already guards throws, so a bad hook can never break the stream.

- [ ] **Step 6: Pass plugin commands + hooks from serve.ts**

In `packages/server/src/serve.ts:61`, change `createServer({ config, registry, cwd, webDir, status })` to `createServer({ config, registry, cwd, webDir, status, pluginCommands: plugins.commands, pluginHooks: plugins.hooks })`. (`plugins` is the `loadPlugins` result already in scope at serve.ts:42. `loadPlugins` now also reads `~/.termcoder/plugins/` via its default `pluginsDir`, so no other change is needed for discovery.)

- [ ] **Step 7: Run the server test + typecheck + build**
- Run: `npx vitest run packages/server/src/server.test.ts` → all green (existing + the new merge test).
- Run: `cd packages/server && npx tsc --noEmit 2>&1 | grep -E 'server\.ts|serve\.ts' || echo CLEAN` → `CLEAN`.
- Run: `pnpm --filter @termcoder/server build` → OK.

- [ ] **Step 8: Commit** — `git add packages/server/src/server.ts packages/server/src/serve.ts packages/server/src/server.test.ts && git commit -m "feat(plugins): wire plugin commands and session hooks into the server"`

---

## Self-review notes

- Spec coverage: `addCommand`/`onEvent`/manifest (T1 PluginApi + Plugin + result), discovery folder + dedupe (T1 discoverPluginSpecifiers + loadPlugins), `runHooks` guard (T1), command merge on both endpoints (T2 mergedCommands), hook invocation in the stream loop (T2), serve.ts plumbing (T2), manifest via existing `status.plugins` (already populated by `plugins.plugins`, now richer — no code needed).
- No placeholders; complete code except the two "read the surrounding test/loop to match the existing helper/shape" notes, which are precise about what to reuse and why (the test harness and the autonomous-event shape are local facts the implementer must read, not invent).
- Types consistent: `PluginApi`, `Plugin`, `LoadPluginsResult`, `discoverPluginSpecifiers`, `loadPlugins(specifiers, {config, cwd, pluginsDir?})`, `runHooks`, `ServerDeps.pluginCommands/pluginHooks`.
- Backward compat: tool-only plugins unaffected (addCommand/onEvent simply unused); `config.plugins` still passed; discovery dir optional/defaulted.
```
