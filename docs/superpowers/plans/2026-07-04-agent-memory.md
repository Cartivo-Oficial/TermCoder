# Agent Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give termcoder a persistent, agent-writable memory (project + user) that it recalls into context automatically, so even the small free model gets the right knowledge.

**Architecture:** Mirror the existing `skill/skills.ts` + `tools/skill.ts` pattern — markdown files with front matter, discovered from a project dir and a config dir, surfaced to the model as an always-on block (index + budgeted bodies), and read/written through a builtin `memory` tool. Session injects the recall block next to the existing skill menu and repo summary.

**Tech Stack:** TypeScript, pnpm monorepo (`@termcoder/core`, `@termcoder/server`, `@termcoder/tui`, `@termcoder/desktop`), Vitest, Ink (TUI), React (desktop). Node built-ins only.

## Global Constraints

- **No new runtime dependencies.** Reuse `parseFrontmatter` (`util/frontmatter.ts`) and `configDir` (`util/paths.ts`).
- **Node ≥ 20**, ESM. Tests colocated as `*.test.ts`, run with `npx vitest run`.
- **Never edit repo source via PowerShell** (UTF-8 mojibake) — use the editor tools.
- **Keyless stays default.** Memory must help the free model, not require a key.
- **Secrets are never stored in memory.** `saveMemory` rejects secret-shaped bodies.
- **Project memory** lives in `.termcoder/memory/*.md` (git-shared); **user memory** in `<configDir>/memory/*.md` (private). Project overrides user by name.
- **Memory types:** `project` | `preference` | `decision`.
- Keep the suite green (currently 222 tests). Bump `core`/`tui`/`desktop` to `0.7.0` and the tui `VERSION` const at the end.

---

### Task 1: Core memory module

**Files:**
- Create: `packages/core/src/memory/memory.ts`
- Test: `packages/core/src/memory/memory.test.ts`
- Modify: `packages/core/src/index.ts` (exports)

**Interfaces:**
- Consumes: `parseFrontmatter` from `../util/frontmatter`; `configDir` from `../util/paths`.
- Produces:
  - `type MemoryScope = "project" | "user"`
  - `type MemoryType = "project" | "preference" | "decision"`
  - `interface MemoryEntry { name: string; description: string; type: MemoryType; body: string; scope: MemoryScope; file: string; updatedAt: number }`
  - `interface DiscoverMemoriesOptions { cwd: string; env?: NodeJS.ProcessEnv }`
  - `discoverMemories(opts: DiscoverMemoriesOptions): MemoryEntry[]`
  - `saveMemory(opts: { scope: MemoryScope; name: string; description: string; type: MemoryType; body: string; cwd: string; env?: NodeJS.ProcessEnv }): MemoryEntry`
  - `deleteMemory(opts: { name: string; cwd: string; env?: NodeJS.ProcessEnv }): boolean`
  - `memoryIndex(mems: MemoryEntry[]): string`
  - `recallMemories(mems: MemoryEntry[], budgetChars: number): string`
  - `slugifyMemoryName(raw: string): string`
  - `looksLikeSecret(text: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/memory/memory.test.ts
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  discoverMemories,
  saveMemory,
  deleteMemory,
  memoryIndex,
  recallMemories,
  slugifyMemoryName,
  looksLikeSecret,
} from "./memory";

let dir: string;
let cfg: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-mem-"));
  cfg = mkdtempSync(join(tmpdir(), "tc-cfg-"));
  env = { XDG_CONFIG_HOME: cfg };
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
});

describe("saveMemory + discoverMemories", () => {
  it("round-trips a project memory and a user memory; project overrides user by name", () => {
    saveMemory({ scope: "user", name: "Uses PNPM", description: "prefers pnpm", type: "preference", body: "always pnpm", cwd: dir, env });
    saveMemory({ scope: "project", name: "arch", description: "monorepo", type: "project", body: "four packages", cwd: dir, env });
    // same name in both scopes → project wins
    saveMemory({ scope: "user", name: "arch", description: "user arch", type: "project", body: "user body", cwd: dir, env });

    const mems = discoverMemories({ cwd: dir, env });
    const byName = Object.fromEntries(mems.map((m) => [m.name, m]));
    expect(byName["uses-pnpm"].scope).toBe("user");           // slugified
    expect(byName["uses-pnpm"].description).toBe("prefers pnpm");
    expect(byName["arch"].scope).toBe("project");             // project overrode user
    expect(byName["arch"].body).toBe("four packages");
    expect(existsSync(join(dir, ".termcoder", "memory", "arch.md"))).toBe(true);
    expect(existsSync(join(cfg, "termcoder", "memory", "uses-pnpm.md"))).toBe(true);
  });

  it("refuses to store a secret-shaped body", () => {
    expect(() => saveMemory({ scope: "user", name: "k", description: "d", type: "preference", body: "my key is sk-ant-abc123def456", cwd: dir, env })).toThrow(/secret/i);
  });
});

describe("deleteMemory", () => {
  it("removes a memory and returns whether it existed", () => {
    saveMemory({ scope: "project", name: "gone", description: "d", type: "project", body: "b", cwd: dir, env });
    expect(deleteMemory({ name: "gone", cwd: dir, env })).toBe(true);
    expect(deleteMemory({ name: "gone", cwd: dir, env })).toBe(false);
    expect(discoverMemories({ cwd: dir, env }).length).toBe(0);
  });
});

describe("memoryIndex + recallMemories", () => {
  it("index lists one line per memory; empty when none", () => {
    expect(memoryIndex([])).toBe("");
    saveMemory({ scope: "project", name: "a", description: "first", type: "project", body: "x", cwd: dir, env });
    const idx = memoryIndex(discoverMemories({ cwd: dir, env }));
    expect(idx).toContain("- a: first");
  });

  it("recall includes newest bodies until the budget, rest stay index-only; empty when none", () => {
    expect(recallMemories([], 4000)).toBe("");
    saveMemory({ scope: "project", name: "old", description: "old one", type: "project", body: "OLD_BODY " + "x".repeat(50), cwd: dir, env });
    saveMemory({ scope: "project", name: "new", description: "new one", type: "project", body: "NEW_BODY " + "y".repeat(50), cwd: dir, env });
    const mems = discoverMemories({ cwd: dir, env });
    const tiny = recallMemories(mems, 80); // only room for the index + at most one body
    expect(tiny).toContain("- old: old one");
    expect(tiny).toContain("- new: new one");
    // at least one full body is omitted under the tight budget
    const bodiesShown = (tiny.match(/_BODY/g) ?? []).length;
    expect(bodiesShown).toBeLessThan(2);
  });
});

describe("helpers", () => {
  it("slugifies names", () => {
    expect(slugifyMemoryName("Uses PNPM!")).toBe("uses-pnpm");
    expect(slugifyMemoryName("  A / B  ")).toBe("a-b");
  });
  it("flags secret-shaped text", () => {
    expect(looksLikeSecret("sk-ant-abc123def456ghi")).toBe(true);
    expect(looksLikeSecret("AIzaSyA1234567890abcdef")).toBe(true);
    expect(looksLikeSecret("ghp_abcdef1234567890")).toBe(true);
    expect(looksLikeSecret("just a normal note about pnpm")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/memory/memory.test.ts`
Expected: FAIL — "Cannot find module './memory'".

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/memory/memory.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "../util/frontmatter";
import { configDir } from "../util/paths";

export type MemoryScope = "project" | "user";
export type MemoryType = "project" | "preference" | "decision";

/**
 * One remembered fact. Only `name` + `description` go in the always-on index;
 * bodies are added up to a budget, and the rest load via the `memory` tool —
 * the same progressive-disclosure idea as skills, so the small free model isn't
 * drowned in context.
 */
export interface MemoryEntry {
  name: string;
  description: string;
  type: MemoryType;
  body: string;
  scope: MemoryScope;
  file: string;
  updatedAt: number;
}

const MEMORY_TYPES: MemoryType[] = ["project", "preference", "decision"];

export function slugifyMemoryName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-") || "note";
}

/** Cheap guard so an API key never lands in a committed memory file. */
export function looksLikeSecret(text: string): boolean {
  return (
    /\bsk-[A-Za-z0-9]{8,}/.test(text) ||
    /\bAIza[0-9A-Za-z_-]{10,}/.test(text) ||
    /\bghp_[A-Za-z0-9]{10,}/.test(text) ||
    /\bxox[baprs]-[A-Za-z0-9-]{10,}/.test(text) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)
  );
}

function projectDir(cwd: string): string {
  return join(cwd, ".termcoder", "memory");
}
function userDir(env?: NodeJS.ProcessEnv): string {
  return join(configDir(env ?? process.env), "memory");
}

function readMemoryDir(dir: string, scope: MemoryScope): MemoryEntry[] {
  if (!existsSync(dir)) return [];
  const out: MemoryEntry[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const file = join(dir, f);
    try {
      const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
      const name = typeof data.name === "string" && data.name.trim() ? slugifyMemoryName(data.name) : f.replace(/\.md$/, "");
      const description = typeof data.description === "string" ? data.description : "";
      const type = MEMORY_TYPES.includes(data.type as MemoryType) ? (data.type as MemoryType) : "project";
      out.push({ name, description, type, body: body.trim(), scope, file, updatedAt: statSync(file).mtimeMs });
    } catch {
      /* skip unreadable memory files */
    }
  }
  return out;
}

/** Project memory (`.termcoder/memory`) overrides user memory (`<config>/memory`) by name. */
export function discoverMemories(opts: { cwd: string; env?: NodeJS.ProcessEnv }): MemoryEntry[] {
  const byName = new Map<string, MemoryEntry>();
  for (const m of readMemoryDir(userDir(opts.env), "user")) byName.set(m.name, m);
  for (const m of readMemoryDir(projectDir(opts.cwd), "project")) byName.set(m.name, m);
  return [...byName.values()];
}

export function saveMemory(opts: {
  scope: MemoryScope; name: string; description: string; type: MemoryType; body: string;
  cwd: string; env?: NodeJS.ProcessEnv;
}): MemoryEntry {
  if (looksLikeSecret(opts.body) || looksLikeSecret(opts.description)) {
    throw new Error("Refusing to store what looks like a secret (API key or private key) in memory.");
  }
  const name = slugifyMemoryName(opts.name);
  const dir = opts.scope === "project" ? projectDir(opts.cwd) : userDir(opts.env);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.md`);
  const type: MemoryType = MEMORY_TYPES.includes(opts.type) ? opts.type : "project";
  const md = `---\nname: ${name}\ndescription: ${opts.description.replace(/\n/g, " ").trim()}\ntype: ${type}\n---\n${opts.body.trim()}\n`;
  writeFileSync(file, md, "utf8");
  return { name, description: opts.description, type, body: opts.body.trim(), scope: opts.scope, file, updatedAt: Date.now() };
}

/** Delete a memory from either scope (project checked first). Returns whether one existed. */
export function deleteMemory(opts: { name: string; cwd: string; env?: NodeJS.ProcessEnv }): boolean {
  const name = slugifyMemoryName(opts.name);
  let removed = false;
  for (const dir of [projectDir(opts.cwd), userDir(opts.env)]) {
    const file = join(dir, `${name}.md`);
    if (existsSync(file)) { rmSync(file); removed = true; }
  }
  return removed;
}

/** One line per memory; empty string when there are none. */
export function memoryIndex(mems: MemoryEntry[]): string {
  if (mems.length === 0) return "";
  return mems.map((m) => `- ${m.name}: ${m.description || "(no description)"}`).join("\n");
}

/**
 * The block injected into the system prompt: an always-present index, then full
 * bodies (newest first) until `budgetChars` is reached. Empty when no memories.
 */
export function recallMemories(mems: MemoryEntry[], budgetChars: number): string {
  if (mems.length === 0) return "";
  const index = memoryIndex(mems);
  const ordered = [...mems].sort((a, b) => b.updatedAt - a.updatedAt);
  const bodies: string[] = [];
  let used = index.length;
  for (const m of ordered) {
    const block = `## ${m.name}\n${m.body}`;
    if (used + block.length + 2 > budgetChars) continue;
    bodies.push(block);
    used += block.length + 2;
  }
  return [
    "What you remember about this project and user — keep it in mind. Load any",
    "item's full text with the `memory` tool's `read` command, and save a new",
    "durable fact with its `save` command.",
    index,
    ...(bodies.length ? ["", ...bodies] : []),
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/memory/memory.test.ts`
Expected: PASS.

- [ ] **Step 5: Export + commit**

Add to `packages/core/src/index.ts` (near the study/reliability exports):

```ts
export {
  discoverMemories,
  saveMemory,
  deleteMemory,
  memoryIndex,
  recallMemories,
  slugifyMemoryName,
  looksLikeSecret,
  type MemoryEntry,
  type MemoryScope,
  type MemoryType,
} from "./memory/memory";
```

```bash
git add packages/core/src/memory/memory.ts packages/core/src/memory/memory.test.ts packages/core/src/index.ts
git commit -m "feat(core): agent memory store — discover/save/delete/recall"
```

---

### Task 2: The `memory` builtin tool

**Files:**
- Create: `packages/core/src/tools/memory.ts`
- Test: `packages/core/src/tools/memory.test.ts`
- Modify: `packages/core/src/tools/index.ts` (register)

**Interfaces:**
- Consumes: `discoverMemories`, `saveMemory`, `deleteMemory`, `memoryIndex` (Task 1); `defineTool` from `./types`.
- Produces: `memoryTool` — a builtin with a `command` field (`save` | `read` | `list` | `delete`).

**Note:** The tool is marked `readOnly: true` (like `skill`) so auto-save is never gated by a permission prompt — it only ever writes inside `.termcoder/memory/` and the config memory dir, never arbitrary paths, and never runs anything. This mirrors how draft/favorites writes are ungated.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/tools/memory.test.ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { memoryTool } from "./memory";

let dir: string;
let cfg: string;
let prevXdg: string | undefined;
// ToolContext is just { cwd }; user-scope memory resolves via configDir(process.env),
// so point XDG at a temp dir to keep the test hermetic.
const ctx = () => ({ cwd: dir }) as never;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-memtool-"));
  cfg = mkdtempSync(join(tmpdir(), "tc-memtoolcfg-"));
  prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = cfg;
});
afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  rmSync(dir, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
});

describe("memoryTool", () => {
  it("saves, lists, reads, and deletes a memory", async () => {
    const saved = await memoryTool.run({ command: "save", scope: "project", name: "arch", description: "monorepo", type: "project", body: "four packages" }, ctx());
    expect(saved.output).toMatch(/saved/i);

    const list = await memoryTool.run({ command: "list" }, ctx());
    expect(list.output).toContain("- arch: monorepo");

    const read = await memoryTool.run({ command: "read", name: "arch" }, ctx());
    expect(read.output).toContain("four packages");

    const del = await memoryTool.run({ command: "delete", name: "arch" }, ctx());
    expect(del.output).toMatch(/deleted/i);
    const after = await memoryTool.run({ command: "list" }, ctx());
    expect(after.output).not.toContain("arch");
  });

  it("reports a missing memory on read", async () => {
    const read = await memoryTool.run({ command: "read", name: "nope" }, ctx());
    expect(read.output).toMatch(/no memory/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/tools/memory.test.ts`
Expected: FAIL — "Cannot find module './memory'".

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/tools/memory.ts
import { z } from "zod";
import { defineTool } from "./types";
import { discoverMemories, saveMemory, deleteMemory, memoryIndex } from "../memory/memory";

/**
 * Read and write the agent's memory. The recall block (index + budgeted bodies)
 * is injected into the system prompt; this tool loads a full item on demand and
 * lets the agent save a durable, high-value fact it just learned.
 */
export const memoryTool = defineTool({
  name: "memory",
  description:
    "Remember durable, high-value facts across sessions. command=save stores a fact (a project convention, an architectural truth, a stated user preference, or a decision and why); read loads one by name; list shows the index; delete removes one. Never store secrets or transient task state. Prefer updating an existing memory over a near-duplicate.",
  inputSchema: z.object({
    command: z.enum(["save", "read", "list", "delete"]),
    scope: z.enum(["project", "user"]).optional().describe("save: 'project' (this repo, shared via git) or 'user' (your global preference). Default project."),
    name: z.string().optional().describe("save/read/delete: the memory's short slug name."),
    description: z.string().optional().describe("save: one-line summary shown in the always-on index."),
    type: z.enum(["project", "preference", "decision"]).optional(),
    body: z.string().optional().describe("save: the fact itself."),
  }),
  readOnly: true,
  describe(args) {
    return { title: args.command === "save" ? `Remember: ${args.name ?? "note"}` : `memory ${args.command}` };
  },
  async run(args, ctx) {
    const cwd = ctx.cwd;
    if (args.command === "list") {
      const idx = memoryIndex(discoverMemories({ cwd }));
      return { output: idx || "No memories yet." };
    }
    if (args.command === "read") {
      const m = discoverMemories({ cwd }).find((x) => x.name === args.name);
      return { output: m ? `# Memory: ${m.name}\n\n${m.body}` : `No memory named "${args.name ?? ""}".` };
    }
    if (args.command === "delete") {
      const removed = deleteMemory({ name: args.name ?? "", cwd });
      return { output: removed ? `Deleted memory "${args.name}".` : `No memory named "${args.name ?? ""}".` };
    }
    // save
    if (!args.name || !args.body) return { output: "To save a memory, provide name and body." };
    try {
      const m = saveMemory({
        scope: args.scope ?? "project",
        name: args.name,
        description: args.description ?? "",
        type: args.type ?? "project",
        body: args.body,
        cwd,
      });
      return { output: `Saved ${m.scope} memory "${m.name}".` };
    } catch (err) {
      return { output: err instanceof Error ? err.message : String(err) };
    }
  },
});
```

- [ ] **Step 4: Register the tool** in `packages/core/src/tools/index.ts`

Add the import next to `import { skillTool } from "./skill";`:

```ts
import { memoryTool } from "./memory";
```

Add `memoryTool` to the `builtinTools` array, right after `skillTool,`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/tools/memory.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tools/memory.ts packages/core/src/tools/memory.test.ts packages/core/src/tools/index.ts
git commit -m "feat(core): memory tool (save/read/list/delete)"
```

---

### Task 3: Recall injection + save guidance in the session

**Files:**
- Modify: `packages/core/src/config/config.ts` (`context.memoryChars`)
- Modify: `packages/core/src/session/session.ts` (inject recall; prompt guidance)
- Test: `packages/core/src/session/session.test.ts`

**Interfaces:**
- Consumes: `discoverMemories`, `recallMemories` (Task 1); `config.context.memoryChars`.
- Produces: the recall block appears in `opts.system` when memories exist, and is absent when none do.

- [ ] **Step 1: Add the config knob** in `packages/core/src/config/config.ts`, inside the `context` object (after `keepRecentToolResults`):

```ts
      /** Max characters of remembered facts injected into the prompt (index always fits). */
      memoryChars: z.number().int().positive().default(4000),
```

- [ ] **Step 2: Write the failing test** in `packages/core/src/session/session.test.ts`

Reuse the file's existing capturing-runner pattern (see the "pr-review" test). Add:

```ts
it("injects saved memories into the system prompt, and nothing when there are none", async () => {
  const prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = join(dir, "xdg"); // isolate user memory from the real machine
  try {
    let captured = "";
    const runner: ModelRunner = (opts) => {
      captured = opts.system;
      async function* stream() { yield { type: "text-delta", text: "ok" }; }
      return { fullStream: stream(), response: Promise.resolve({ messages: [] }), finishReason: Promise.resolve("stop"), toolCalls: Promise.resolve([]) };
    };
    // no memories yet → no recall header
    await collect(makeSession(runner), "hi");
    expect(captured).not.toMatch(/What you remember/);

    // add a project memory, then a fresh session sees it
    saveMemory({ scope: "project", name: "arch", description: "monorepo of four packages", type: "project", body: "core, server, tui, desktop", cwd: dir });
    await collect(makeSession(runner), "hi again");
    expect(captured).toMatch(/What you remember/);
    expect(captured).toContain("- arch: monorepo of four packages");
  } finally {
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
  }
});
```

(This assumes the session's memory lookup falls back to `process.env` when `deps.env` is unset, which `makeSession` leaves undefined. If `makeSession` passes an `env`, set `XDG_CONFIG_HOME` on that object instead.)

Add the import at the top of the test file:

```ts
import { saveMemory } from "../memory/memory";
```

(`makeSession`/`dir`/`collect` already exist in this file. `makeSession` uses `dir` as cwd, so a memory saved under `dir/.termcoder/memory` is discovered.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/core/src/session/session.test.ts -t "injects saved memories"`
Expected: FAIL — the recall header isn't present yet.

- [ ] **Step 4: Add the import** at the top of `packages/core/src/session/session.ts`, next to the skills import:

```ts
import { discoverMemories, recallMemories } from "../memory/memory";
```

- [ ] **Step 5: Compute the recall block.** In `session.ts`, right after the `repoSummary` line (`const repoSummary = projectSummary(ctx.cwd);`), add:

```ts
    // What the agent has remembered about this project and user — injected as an
    // always-on index plus full bodies within a budget, so even the small free
    // model starts with the right context.
    const memoryRecall = recallMemories(
      discoverMemories({ cwd: ctx.cwd, env: this.deps.env }),
      this.deps.config.context?.memoryChars ?? 4000,
    );
```

- [ ] **Step 6: Inject it** into the `system` string built in the stream loop. Change the block (currently):

```ts
            system:
              systemPrompt(ctx.cwd, agent, persona) +
              (persona !== "study" && repoSummary ? `\n\n${repoSummary}` : "") +
              (skillMenu ? `\n\n${skillMenu}` : ""),
```

to add the memory recall:

```ts
            system:
              systemPrompt(ctx.cwd, agent, persona) +
              (persona !== "study" && repoSummary ? `\n\n${repoSummary}` : "") +
              (memoryRecall ? `\n\n${memoryRecall}` : "") +
              (skillMenu ? `\n\n${skillMenu}` : ""),
```

- [ ] **Step 7: Add save guidance to the prompt.** In `systemPrompt` (`session.ts`), in the editing/mutate branch `lines.push(...)` that already mentions the plan→verify protocol, append one line:

```ts
      "Save a durable, high-value fact you learn (a convention, an architectural truth, a stated preference, a decision) with the memory tool — few and specific, never secrets.",
```

- [ ] **Step 8: Run the tests + build**

Run: `npx vitest run packages/core/src/session/session.test.ts && pnpm --filter @termcoder/core build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/config/config.ts packages/core/src/session/session.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): recall memories into the prompt + save guidance"
```

---

### Task 4: Server `/memory` routes

**Files:**
- Modify: `packages/server/src/server.ts`
- Test: `packages/server/src/server.test.ts`

**Interfaces:**
- Consumes: `discoverMemories`, `saveMemory`, `deleteMemory` from `@termcoder/core`.
- Produces: `GET /memory` (list), `POST /memory` (save), `DELETE /memory/:name` (delete) — mirroring the existing `/skills` routes.

- [ ] **Step 1: Write the failing test** in `packages/server/src/server.test.ts` (mirror the `/skills` route tests):

```ts
it("lists, saves, and deletes memories", async () => {
  const save = await fetch(`${base}/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope: "project", name: "arch", description: "monorepo", type: "project", body: "four packages" }),
  });
  expect(save.status).toBe(200);

  const list = await (await fetch(`${base}/memory`)).json();
  expect(list.memories.some((m: { name: string }) => m.name === "arch")).toBe(true);

  const del = await fetch(`${base}/memory/arch`, { method: "DELETE" });
  expect(del.status).toBe(200);
});
```

(Use the file's existing `base` server-URL helper and setup. `cwd` for the server is a temp dir per the existing tests.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/server/src/server.test.ts -t "lists, saves, and deletes memories"`
Expected: FAIL — routes return 404.

- [ ] **Step 3: Add the imports** in `packages/server/src/server.ts`, in the `@termcoder/core` import block:

```ts
  discoverMemories,
  saveMemory,
  deleteMemory,
```

- [ ] **Step 4: Add the routes.** Right after the `DELETE /skills/:name` handler, add analogous handlers. The server routes on `parts` (the pathname split into segments) and `req.method`, and responds with `sendJson(res, status, obj)` (status is the **second** arg); the request body is read with `await readJson(req)`. Match that exactly:

```ts
  // GET /memory — remembered facts (project + user)
  if (req.method === "GET" && parts.length === 1 && parts[0] === "memory") {
    const memories = discoverMemories({ cwd: ctx.cwd }).map((m) => ({
      name: m.name, description: m.description, type: m.type, scope: m.scope, body: m.body,
    }));
    return sendJson(res, 200, { memories });
  }
  // POST /memory — save a fact
  if (req.method === "POST" && parts.length === 1 && parts[0] === "memory") {
    const body = await readJson(req);
    try {
      const m = saveMemory({
        scope: body.scope === "user" ? "user" : "project",
        name: String(body.name ?? ""),
        description: String(body.description ?? ""),
        type: ["project", "preference", "decision"].includes(body.type) ? body.type : "project",
        body: String(body.body ?? ""),
        cwd: ctx.cwd,
      });
      return sendJson(res, 200, { ok: true, name: m.name });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  // DELETE /memory/:name
  if (req.method === "DELETE" && parts.length === 2 && parts[0] === "memory") {
    const removed = deleteMemory({ name: parts[1]!, cwd: ctx.cwd });
    return sendJson(res, 200, { ok: removed });
  }
```

- [ ] **Step 5: Run tests + build**

Run: `pnpm --filter @termcoder/core build && npx vitest run packages/server/src/server.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/server.ts packages/server/src/server.test.ts
git commit -m "feat(server): /memory routes (list/save/delete)"
```

---

### Task 5: TUI commands — `/remember`, `/memories`, `/forget`

**Files:**
- Modify: `packages/tui/src/commands.ts` (registry)
- Modify: `packages/tui/src/app.tsx` (handlers)

**Interfaces:**
- Consumes: `saveMemory`, `discoverMemories`, `deleteMemory` from `@termcoder/core`; the existing `pushHistory({ kind, text })`.
- Produces: three commands. `/remember [project] <text>` saves (default user/preference; `project` prefix → project scope); `/memories` lists; `/forget <name>` deletes.

- [ ] **Step 1: Register the commands** in `packages/tui/src/commands.ts`, near the other stateful commands:

```ts
  { name: "remember", arg: "[project] <text>", desc: "Save a fact to memory (default: your global preference)" },
  { name: "memories", desc: "List what termcoder remembers" },
  { name: "forget", arg: "<name>", desc: "Delete a memory by name" },
```

- [ ] **Step 2: Import the helpers** in `app.tsx`, in the `@termcoder/core` import block:

```ts
  saveMemory,
  discoverMemories,
  deleteMemory,
  slugifyMemoryName,
```

- [ ] **Step 3: Handle the commands** in `app.tsx` `handleCommand`, adding cases:

```ts
      case "remember": {
        const text = arg.trim();
        if (!text) { pushHistory({ kind: "notice", text: "Usage: /remember [project] <text>" }); break; }
        const isProject = /^project\s+/i.test(text);
        const bodyText = isProject ? text.replace(/^project\s+/i, "") : text;
        const description = bodyText.length > 60 ? `${bodyText.slice(0, 57)}…` : bodyText;
        try {
          const m = saveMemory({
            scope: isProject ? "project" : "user",
            name: slugifyMemoryName(bodyText.split(/\s+/).slice(0, 5).join(" ")),
            description,
            type: isProject ? "project" : "preference",
            body: bodyText,
            cwd,
          });
          pushHistory({ kind: "notice", text: `✓ Remembered (${m.scope}): ${m.name}` });
        } catch (err) {
          pushHistory({ kind: "error", text: err instanceof Error ? err.message : String(err) });
        }
        break;
      }
      case "memories": {
        const mems = discoverMemories({ cwd });
        pushHistory({
          kind: "notice",
          text: mems.length
            ? `Memory:\n${mems.map((m) => `  • [${m.scope}] ${m.name} — ${m.description}`).join("\n")}`
            : "No memories yet. Save one with /remember, or just tell me something worth keeping.",
        });
        break;
      }
      case "forget": {
        const name = arg.trim();
        if (!name) { pushHistory({ kind: "notice", text: "Usage: /forget <name>" }); break; }
        const removed = deleteMemory({ name, cwd });
        pushHistory({ kind: removed ? "notice" : "error", text: removed ? `Forgot "${slugifyMemoryName(name)}".` : `No memory named "${name}".` });
        break;
      }
```

- [ ] **Step 4: Typecheck + build**

Run: `cd packages/tui && npx tsc --noEmit`
Expected: exit 0. Then `pnpm --filter @termcoder/tui build`.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/commands.ts packages/tui/src/app.tsx
git commit -m "feat(tui): /remember, /memories, /forget"
```

---

### Task 6: Desktop Memory tab

**Files:**
- Modify: `packages/desktop/src/renderer/Settings.tsx` (new `memory` tab, mirroring the `skills` tab)
- Modify: `packages/desktop/src/renderer/i18n.ts` (copy keys)

**Interfaces:**
- Consumes: server routes `GET/POST/DELETE /memory` (Task 4); the existing `httpBase`, `t()`, and the Skills-tab layout.
- Produces: a **Memory** tab listing memories (scope + type badges), with add and delete, and a project/user scope toggle on the add form.

- [ ] **Step 1: Add the tab id** to the `SettingsTab` union in `Settings.tsx`:

```ts
  | "memory"
```

- [ ] **Step 2: Add the tab to the nav list and label map.** Where the tabs array lists `["skills", "settings.skills"]`, add:

```ts
      ["memory", "settings.memory"],
```

And in the label map where `skills: "settings.skills"` is, add:

```ts
  memory: "settings.memory",
```

- [ ] **Step 3: Add the panel state + loader**, mirroring `loadSkills`:

```tsx
  const [memories, setMemories] = useState<Array<{ name: string; description: string; type: string; scope: string; body: string }>>([]);
  function loadMemories() {
    fetch(`${httpBase}/memory`).then((r) => r.json()).then((d) => setMemories(d.memories ?? [])).catch(() => {});
  }
  async function addMemory(scope: string, name: string, description: string, body: string) {
    await fetch(`${httpBase}/memory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, name, description, body, type: scope === "user" ? "preference" : "project" }),
    });
    loadMemories();
  }
  async function delMemory(name: string) {
    await fetch(`${httpBase}/memory/${encodeURIComponent(name)}`, { method: "DELETE" }).catch(() => {});
    loadMemories();
  }
```

And where other tabs load on open (the `if (p.tab === "skills") loadSkills();` effect), add:

```tsx
    if (p.tab === "memory") loadMemories();
```

- [ ] **Step 4: Render the panel** where tab panels are rendered (mirror the skills panel markup — a list with delete buttons plus an add form with name/description/body inputs and a project/user scope select). Add:

```tsx
{tab === "memory" ? (
  <div className="settings-panel">
    <p className="muted">{t("settings.memoryDesc")}</p>
    {memories.map((m) => (
      <div className="srow" key={m.name}>
        <div>
          <b>{m.name}</b> <span className="badge">{m.scope}</span> <span className="badge">{m.type}</span>
          <div className="muted">{m.description}</div>
        </div>
        <button className="settings-btn ghost" onClick={() => delMemory(m.name)}>{t("common.delete")}</button>
      </div>
    ))}
    <MemoryAdd onAdd={addMemory} t={t} />
  </div>
) : null}
```

Add a small `MemoryAdd` component in the same file (mirroring the skills add form), with a scope `<select>` (project/user), `name`, `description`, and `body` fields, calling `onAdd(scope, name, description, body)` then clearing. Reuse `common.delete` if it exists; otherwise use the literal label the skills tab uses for its delete button.

- [ ] **Step 5: Add copy keys** to each of en/pt/es in `i18n.ts` (mirroring `settings.skills`):

```ts
  "settings.memory": "Memory",
  "settings.memoryDesc": "Facts termcoder remembers across sessions. Project memory is shared via git; your preferences stay private.",
```
(pt: "Memória" / "Fatos que o termcoder lembra entre sessões. A memória de projeto é compartilhada via git; suas preferências ficam privadas." es: "Memoria" / analogous.)

- [ ] **Step 6: Typecheck**

Run: `cd packages/desktop && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src/renderer/Settings.tsx packages/desktop/src/renderer/i18n.ts
git commit -m "feat(desktop): Memory settings tab"
```

---

### Task 7: Docs + version bump

**Files:**
- Modify: `docs/configuration.md` (a Memory section)
- Modify: `packages/{core,tui,desktop}/package.json` (version → 0.7.0), `packages/tui/src/app.tsx` (`VERSION`)

- [ ] **Step 1: Add a docs section** to `docs/configuration.md` under a new "## Memory" heading:

```markdown
## Memory

termcoder remembers durable facts across sessions and recalls them automatically.

- **Project memory** lives in `.termcoder/memory/*.md` and is committed with your repo, so collaborators (and classmates) inherit what the agent learned about the project.
- **User memory** lives in your config dir and stays private — your global preferences.

The agent saves high-value facts on its own, and you can manage them with `/remember [project] <text>`, `/memories`, and `/forget <name>` (or the Memory tab in the desktop app). Only a compact index plus the most recent facts (up to `context.memoryChars`, default 4000) are sent to the model each turn; the rest load on demand. Secrets are never stored.
```

- [ ] **Step 2: Bump versions to 0.7.0** in the three package.json files and the tui `VERSION` const (currently `0.6.0`).

- [ ] **Step 3: Build + full suite + typecheck**

Run:
```bash
pnpm -r build && pnpm -r typecheck && npx vitest run
```
Expected: exit 0; all tests pass (222 prior + the new memory/tool/session/server tests).

- [ ] **Step 4: Live smoke** (from `packages/core`, Node): save a project memory to a temp dir, `discoverMemories`, confirm `recallMemories(..., 4000)` includes the body and `memoryIndex` lists it. (This is what Task 1's tests already assert; the smoke just confirms the built `dist`.)

```bash
node -e "const m=require('./packages/core/dist/index.js'); const d=require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'s')); m.saveMemory({scope:'project',name:'arch',description:'monorepo',type:'project',body:'four packages',cwd:d}); console.log(m.recallMemories(m.discoverMemories({cwd:d}),4000));"
```
Expected: prints the recall block with "- arch: monorepo" and "four packages".

- [ ] **Step 5: Commit + push**

```bash
git add -A
git commit -m "feat: agent memory — remember + recall across sessions (v0.7.0)"
git push origin master:main
```

---

## Follow-up (separate plans, not this one)

- **Retrieval / deep context** (theme piece 2): embedding-based recall of the *right* memories and code for large repos, replacing the budget-order heuristic.
- **Sync user memory** across machines: the current sync layer mirrors single JSON files; a memory *directory* of markdown needs a small extension.
- **Claude OAuth login** (theme piece 3): spec already at `docs/superpowers/specs/2026-07-04-claude-oauth-login-design.md`.
