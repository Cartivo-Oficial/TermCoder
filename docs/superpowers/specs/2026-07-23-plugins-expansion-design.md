# Plugins 2.0 — commands, hooks, discovery, manifest

Date: 2026-07-23
Status: approved design, pending implementation plan
Packages: `@termcoder/core` (plugin API), `@termcoder/server` (wiring)

## Summary

Expand the existing plugin system (today a plugin can only `addTool`) so a
plugin can also register **slash commands** and **session-event hooks**, carry
a **manifest** (name/version/description), and be **auto-discovered** from a
`~/.termcoder/plugins/` folder in addition to the configured list. No plugin
sandbox — plugins are trusted installed code; safety stays at the tool level
(the tools they add are permission-gated).

## Goals

- `PluginApi` gains `addCommand(command: CommandDef)` and `onEvent(handler: (event: SessionEvent) => void)`, keeping `addTool`/`log`.
- `Plugin` gains optional `version?` and `description?` (the manifest).
- Auto-discovery: `loadPlugins` also loads plugins found in a plugins dir (default `~/.termcoder/plugins/`), combined with `config.plugins`, deduped.
- Plugin commands merge with `discoverCommands` on `GET /commands` (and `POST /commands/expand`); plugin hooks are invoked per session event where the server already streams them — WITHOUT touching `session.ts`.
- The richer per-plugin manifest (name/version/description/counts/error) flows through the existing `status.plugins` the desktop settings already shows.

## Non-goals

- No plugin-code sandbox (plugins are trusted; their tools are permission-gated). No `addProvider` (the provider registry is out of scope for v1). No hot-reload, no plugin marketplace/install UI.

## Existing context

- `packages/core/src/plugin/plugin.ts`: `PluginApi { config, cwd, addTool, log }`, `Plugin { name, register(api) }`, `definePlugin`, `LoadPluginsResult { tools, logs, plugins: {name, ok, toolCount, error?}[] }`, `loadPlugins(specifiers, {config, cwd})` — imports each specifier (path or bare package), calls `register(api)`, collects tools. `toImportSpecifier` handles path↔URL↔bare.
- `packages/core/src/command/commands.ts`: `CommandDef { name; description?; agent?; model?; subtask?; template }`, `discoverCommands({cwd})`, `expandCommand`.
- `packages/core/src/session/session.ts`: `SessionEvent = SessionEventKind & { sourceId? }` (`text-delta | reasoning-delta | reasoning-end | tool-call | tool-result | usage | subagent-start | subagent-end | done | error`).
- `packages/server/src/serve.ts:42`: `const plugins = await loadPlugins(config.plugins, { config, cwd })` → `plugins.tools` into `new ToolRegistry([...builtinTools, ...mcp.tools, ...lsp.tools, ...plugins.tools])`; `plugins.plugins` into `status.plugins`.
- `packages/server/src/server.ts:672`: `GET /commands` returns `discoverCommands({cwd})`; `:686` `POST /commands/expand` looks a command up in `discoverCommands`.
- `packages/server/src/server.ts:1147`: `for await (const event of session.prompt(text, {signal, attachments}))` — the server's per-event streaming loop (and `:1172` `runAutonomous`).
- `createServer(deps)` in `server.ts` receives the registry, store, status, etc.

## Architecture

### `plugin.ts` (core) — the API + discovery
- `PluginApi`:
  ```ts
  interface PluginApi {
    config: Config;
    cwd: string;
    addTool: (tool: TermTool) => void;
    addCommand: (command: CommandDef) => void;
    onEvent: (handler: (event: SessionEvent) => void) => void;
    log: (message: string) => void;
  }
  ```
- `Plugin`: add `version?: string; description?: string;` (keep `name`, `register`).
- `LoadPluginsResult`:
  ```ts
  interface LoadPluginsResult {
    tools: TermTool[];
    commands: CommandDef[];
    hooks: Array<(event: SessionEvent) => void>;
    logs: string[];
    plugins: Array<{ name: string; version?: string; description?: string; ok: boolean; toolCount: number; commandCount: number; hookCount: number; error?: string }>;
  }
  ```
- `discoverPluginSpecifiers(dir: string): string[]` (exported) — if `dir` exists, for each entry return an import specifier: a `.mjs/.js/.cjs` file → its `file:` URL; a subdirectory → its `index.{mjs,js,cjs}` (first match) as a `file:` URL. Non-matching entries (including subdirs without an `index.*` file) are ignored. Returns [] if the dir is absent. (v1 does not resolve a subdir's `package.json` main/exports — a packaged plugin should expose an `index.*` entry.)
- `loadPlugins(specifiers, context)`:
  - `context` gains an optional `pluginsDir?: string` (default `join(homedir(), ".termcoder", "plugins")`).
  - Build the load list = `specifiers` (config.plugins) ++ `discoverPluginSpecifiers(pluginsDir)`, deduped (by resolved specifier string).
  - The `api` now also has `addCommand` (push to `commands`) and `onEvent` (push to `hooks`).
  - Per plugin, record `commandCount`/`hookCount` deltas alongside `toolCount`, plus `version`/`description` from the plugin object.
  - Import failures stay non-fatal (recorded with `ok: false`).

### Server wiring (no `session.ts` change)
- `serve.ts`: keep `plugins.tools` in the registry. Pass `plugins.commands` and `plugins.hooks` into `createServer` via new deps (`pluginCommands`, `pluginHooks`). `plugins.plugins` still populates `status.plugins` (now richer).
- `server.ts`:
  - `createServer` deps gain `pluginCommands?: CommandDef[]` and `pluginHooks?: Array<(e: SessionEvent) => void>` (both default `[]`).
  - `GET /commands` (server.ts:672) returns `[...discoverCommands({cwd}), ...pluginCommands]` (plugin commands appended; a builtin/discovered name wins on collision — dedupe by name keeping the first). `POST /commands/expand` (:686) looks up in the same merged list.
  - The event-streaming loop (server.ts:1147, and the `runAutonomous` loop at :1172): for each yielded `event`, call `for (const hook of pluginHooks) { try { hook(event); } catch {} }` before/after forwarding it to the client. A throwing hook must never break the stream.

### Manifest / listing
- No new endpoint needed: `status.plugins` (already surfaced and shown in the desktop settings "Plugins N") now carries `version`, `description`, `commandCount`, `hookCount`. The desktop can render the list from the existing status payload (a small UI follow-up, out of scope here).

## Data flow

```
serve.ts: loadPlugins(config.plugins, {config, cwd, pluginsDir})
  = config specifiers ++ discovered(~/.termcoder/plugins) -> import each -> register(api)
    api.addTool -> tools ; api.addCommand -> commands ; api.onEvent -> hooks
  -> registry gets tools ; createServer gets {pluginCommands, pluginHooks} ; status.plugins gets manifest
GET /commands -> discoverCommands ++ pluginCommands
session.prompt() stream -> each event also fed to every pluginHook (guarded) -> client
```

## Error handling

- A plugin that fails to import/register: recorded `ok:false` with the error; other plugins still load (unchanged tolerance).
- A hook that throws while handling an event: caught and ignored per event; the stream and other hooks are unaffected.
- A discovered entry that isn't a valid module: import fails → recorded `ok:false`, non-fatal.
- Command-name collision between a builtin/discovered command and a plugin command: the first (builtin/discovered) wins; the plugin's is dropped from the merged list (no throw).

## Testing (vitest, node env)

- `plugin.test.ts` (extend): a fake plugin (in-memory module via a temp `.mjs` file) that calls `addTool`, `addCommand`, `onEvent`, and sets `version`/`description` → `loadPlugins` returns them in `tools`/`commands`/`hooks` and the manifest entry has the right counts + version/description.
- discovery: a temp `pluginsDir` with one `.mjs` plugin file and one subdir plugin → both load; a non-module file is ignored; absent dir → no error. Dedup: the same specifier in both `config.plugins` and the dir loads once.
- hook safety: a hook that throws does not propagate out of the invocation helper (unit-test the small `runHooks(hooks, event)` helper if one is extracted, or assert via the loadPlugins result shape).
- server wiring: `GET /commands` includes plugin commands and dedupes name collisions; a plugin hook receives events during a prompt (server-level test if the existing `server.test.ts` harness supports it; otherwise a focused test of the merge/hook-invocation helpers).

Source files carry NO comments (repo rule).

## File layout

```
packages/core/src/plugin/plugin.ts        (PluginApi + Plugin manifest + discovery + richer result; +tests)
packages/server/src/serve.ts              (pass pluginsDir; forward commands+hooks to createServer)
packages/server/src/server.ts             (createServer deps + merge commands + invoke hooks in the stream loop)
```

## Rollout

Single implementation plan, TDD for the core `plugin.ts` (pure-ish, node-testable) then the server wiring. Additive and backward-compatible: existing tool-only plugins keep working; `config.plugins` still honored; the discovery dir is optional.
