# SDK (`@termcoder/core`)

The core is a headless engine you can drive directly — no server, no terminal. This is
the layer every client is built on.

## Install

Inside the monorepo it's `@termcoder/core`. Standalone, add it plus the AI SDK peer:

```bash
pnpm add @termcoder/core zod
```

## Run a turn

A `Session` needs four things: a `SessionStore` (where transcripts live), a
`ToolRegistry` (what the agent can do), a `Config` (model + settings), and a
`PermissionManager` (how mutating actions are approved). `prompt()` returns an async
generator of typed events.

```ts
import {
  loadConfig,
  SessionStore,
  ToolRegistry,
  builtinTools,
  PermissionManager,
  Session,
} from "@termcoder/core";

const config = loadConfig({ cwd: process.cwd() });          // layered: defaults < global < project < env
const store = new SessionStore();                            // ~/.local/share/termcoder by default
const registry = new ToolRegistry(builtinTools);

// Approve every mutation without prompting. In a real client, ask the user instead.
const permission = new PermissionManager(config.permission, async () => "allow");

const session = Session.create({ store, registry, config, permission }, {
  cwd: process.cwd(),
  agent: "build",                 // or "plan", "explore", or a custom agent name
});

for await (const event of session.prompt("Explain what this project does.")) {
  if (event.type === "text-delta") process.stdout.write(event.text);
  if (event.type === "tool-call") console.log(`\n[tool] ${event.name}`);
  if (event.type === "error") console.error(event.error);
}
```

`Session.resume(deps, id)` reopens a saved session by id. The event shapes are the same
ones the server forwards over the WebSocket (see [Server API](./server-api.md)).

## Gating permissions

The `PermissionManager` is the one place mutating tools (write/edit/bash/mcp) are
approved. The asker callback receives the request; return a decision:

```ts
const permission = new PermissionManager(config.permission, async (req) => {
  console.log(`Allow ${req.kind}? ${req.title}`);
  if (req.detail) console.log(req.detail);      // a diff or the command
  return "allow";                                // "allow" | "deny" | "allow-always"
});
```

Config rules resolve before the asker is ever called: a kind set to `"allow"`/`"deny"`
(or a glob rule that resolves to one) short-circuits the prompt. Per-agent overrides and
glob-scoped rules are covered in [Configuration](./configuration.md#permissions).

## Custom tools

A tool is its model-facing schema plus a host-side executor. `readOnly` tools never hit
the permission gate; mutating ones declare a `permissionKind` and an optional `target`
(the path or command used to resolve glob permission rules).

```ts
import { defineTool, ToolRegistry, builtinTools } from "@termcoder/core";
import { z } from "zod";

const wc = defineTool({
  name: "wordcount",
  description: "Count the words in a file.",
  inputSchema: z.object({ path: z.string() }),
  readOnly: true,
  run: async ({ path }, ctx) => {
    const text = await import("node:fs/promises").then((fs) =>
      fs.readFile(`${ctx.cwd}/${path}`, "utf8"),
    );
    return { output: String(text.trim().split(/\s+/).length) };
  },
});

const registry = new ToolRegistry([...builtinTools, wc]);
```

To ship a tool for others, wrap it in a plugin (`definePlugin`, see the root README) or
drop a `.termcoder/tools/*.js` file that exports it — both are auto-discovered.

## Resolving models

`resolveModel(config, "provider/model")` returns an AI SDK model, resolving provider
keys from config or the environment. The virtual `termcoder/auto` id routes to the best
available provider (local/free first). See
[Configuration → Models & providers](./configuration.md#models--providers).

## Key exports

| Export | What |
| --- | --- |
| `loadConfig`, `saveConfig`, `writeGlobalConfig` | Read/merge/persist config. |
| `Session` | Create/resume a session; `prompt()` streams a turn. |
| `SessionStore` | Reads/writes session transcripts on disk. |
| `ToolRegistry`, `builtinTools`, `defineTool` | The tool set and how to extend it. |
| `PermissionManager`, `resolvePermissionMode` | The approval gate + glob rule resolution. |
| `resolveModel`, `getModelCatalog` | Model resolution and the discoverable catalog. |
| `discoverAgents`, `resolveAgent` | Built-in + custom agent profiles. |
| `discoverCommands`, `expandCommand` | Custom slash-commands. |
| `definePlugin`, `connectMcpServers`, `connectLspServers` | Plugins, MCP, LSP wiring. |
