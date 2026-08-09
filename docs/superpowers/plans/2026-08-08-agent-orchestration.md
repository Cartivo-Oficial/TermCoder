# Agent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TermCoder launches other coding agents — Claude Code, Codex, opencode and the rest — as nodes of one run, and the canvas shows that run properly.

**Architecture:** One ACP client, not one adapter per CLI. `@agentclientprotocol/sdk` speaks JSON-RPC over the agent's stdio; a pure translator turns its session updates into the `SessionEvent`s this app already emits, so an external agent becomes a node in the run graph the canvas already builds. Permission requests from an external agent route through our own `PermissionManager`.

**Tech Stack:** Node 22+, TypeScript strict, `@agentclientprotocol/sdk` (Apache-2.0), vitest from the repository root, React 18 for the canvas.

## Global Constraints

- **The translator is pure.** It takes an ACP `SessionUpdate` and returns a `SessionEvent` or `null`. No process, no clock, no I/O. Everything about which event an update becomes is decided there and tested there.
- **Every permission request from an external agent goes through `PermissionManager`**, the same one that gates our own tools, and surfaces in the same review UI. Never auto-approve on the agent's behalf.
- **An agent is launched with the session's working directory and nothing wider.** We pass no credentials of ours and read none of its configuration.
- **A missing agent is not an error.** The registry degrades to "none available"; the app works exactly as it does today.
- `@agentclientprotocol/sdk` is Apache-2.0 and enters as a normal dependency of `@termcoder/core`. It is not vendored, so no notice file is needed.
- Source files carry **no comments**.
- TypeScript strict with `noUncheckedIndexedAccess: true`.
- Tests run from the repository root, `environment: "node"`.
- `pnpm test` (whole suite) cannot run on the development machine — `better-sqlite3` is built for Electron's ABI with no node-24 prebuild, so anything touching a `SessionStore` fails to load. Run the targeted tests each task names.
- **Only `claude` is installed on the development machine.** `codex`, `opencode`, `gemini` and `goose` are not. Do not write a test that requires them; do not claim to have run one.
- Conventional Commits, lowercase scope. End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## File Structure

**Created**

| path | responsibility |
| --- | --- |
| `packages/core/src/acp/translate.ts` | ACP `SessionUpdate` → our `SessionEvent`. Pure. |
| `packages/core/src/acp/translate.test.ts` | every row of the table, including stop reasons |
| `packages/core/src/acp/registry.ts` | which agents are installed and how each is launched |
| `packages/core/src/acp/registry.test.ts` | discovery against a fake `PATH` |
| `packages/core/src/acp/run.ts` | spawn, handshake, prompt, emit; permission routed to ours |
| `packages/core/src/acp/run.test.ts` | the loop, driven by an in-process fake agent |
| `packages/core/src/acp/live.test.ts` | one real run against `claude`, skipped when absent |
| `packages/desktop/src/renderer/canvas/summary.ts` | the run summary: how many running, how many done |
| `packages/desktop/src/renderer/canvas/summary.test.ts` | that summary |

**Modified**

| path | change |
| --- | --- |
| `packages/core/package.json` | `@agentclientprotocol/sdk` dependency |
| `packages/core/src/index.ts` | export the registry and the runner |
| `packages/core/src/agent/subagent.ts` | an external agent is a `task` target like any specialist |
| `packages/desktop/src/renderer/canvas/NodeCard.tsx` | the node card, rebuilt |
| `packages/desktop/src/renderer/canvas/AgentCanvas.tsx` | curved connectors, run summary bar |
| `packages/desktop/src/renderer/styles.css` | `.agent-*` on the scale |

---

## Phase 0 — The translation

### Task 1: ACP updates become our events

**Files:**
- Create: `packages/core/src/acp/translate.ts`, `packages/core/src/acp/translate.test.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Produces: `translateUpdate(update: SessionUpdate, sourceId: string): SessionEvent | null` and `translateStop(stopReason: string, sourceId: string): SessionEvent`. Later tasks call only these two.

This is the whole protocol surface reduced to a function. Get it right here and the rest is plumbing.

- [ ] **Step 1: Add the dependency**

```bash
cd packages/core && pnpm add @agentclientprotocol/sdk@1.3.0
```

Expected: `packages/core/package.json` gains the dependency, nothing else changes.

- [ ] **Step 2: Write the failing test**

Create `packages/core/src/acp/translate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { translateStop, translateUpdate } from "./translate";

const SRC = "node-1";

describe("an ACP update becomes one of our events", () => {
  it("carries an assistant message chunk as text", () => {
    const e = translateUpdate(
      { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } } as never,
      SRC,
    );
    expect(e).toEqual({ type: "text-delta", text: "hello", sourceId: SRC });
  });

  it("carries a thought chunk as reasoning", () => {
    const e = translateUpdate(
      { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "thinking" } } as never,
      SRC,
    );
    expect(e).toEqual({ type: "reasoning-delta", text: "thinking", sourceId: SRC });
  });

  it("opens a tool call", () => {
    const e = translateUpdate(
      { sessionUpdate: "tool_call", toolCallId: "t1", title: "Read file", kind: "read", status: "pending" } as never,
      SRC,
    );
    expect(e).toMatchObject({ type: "tool-call", id: "t1", name: "read", title: "Read file", sourceId: SRC });
  });

  it("closes a tool call only when it completes", () => {
    const running = translateUpdate(
      { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "in_progress" } as never,
      SRC,
    );
    expect(running).toBeNull();

    const done = translateUpdate(
      {
        sessionUpdate: "tool_call_update",
        toolCallId: "t1",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "ok" } }],
      } as never,
      SRC,
    );
    expect(done).toMatchObject({ type: "tool-result", id: "t1", output: "ok", isError: false, sourceId: SRC });
  });

  it("marks a failed tool call as an error result", () => {
    const e = translateUpdate(
      { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "failed" } as never,
      SRC,
    );
    expect(e).toMatchObject({ type: "tool-result", id: "t1", isError: true });
  });

  it("carries usage", () => {
    const e = translateUpdate({ sessionUpdate: "usage_update", used: 120, size: 200000 } as never, SRC);
    expect(e).toMatchObject({ type: "usage", inputTokens: 120, sourceId: SRC });
  });

  it("keeps a plan visible instead of dropping it", () => {
    const e = translateUpdate(
      {
        sessionUpdate: "plan",
        entries: [{ content: "read the config", priority: "medium", status: "pending" }],
      } as never,
      SRC,
    );
    expect(e).toMatchObject({ type: "tool-call", name: "plan", sourceId: SRC });
  });

  it("returns null for an update it does not model, rather than inventing one", () => {
    expect(translateUpdate({ sessionUpdate: "something_new" } as never, SRC)).toBeNull();
  });
});

describe("a turn ends", () => {
  it("ends cleanly on end_turn", () => {
    expect(translateStop("end_turn", SRC)).toEqual({ type: "done", sourceId: SRC });
  });

  it("ends cleanly on cancelled, because we asked", () => {
    expect(translateStop("cancelled", SRC)).toEqual({ type: "done", sourceId: SRC });
  });

  it("reports refusal and the limits as errors, with the reason", () => {
    for (const reason of ["refusal", "max_tokens", "max_turn_requests"]) {
      const e = translateStop(reason, SRC);
      expect(e.type).toBe("error");
      expect((e as { error: string }).error).toContain(reason);
    }
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run packages/core/src/acp/translate.test.ts
```

Expected: FAIL — `Failed to resolve import "./translate"`.

- [ ] **Step 4: Write the translator**

Create `packages/core/src/acp/translate.ts`:

```ts
import type { SessionUpdate } from "@agentclientprotocol/sdk/schema";
import type { SessionEvent } from "../session/session";

function textOf(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  const block = content as { type?: string; text?: string };
  if (block.type === "text" && typeof block.text === "string") return block.text;
  return "";
}

function outputOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      const wrapped = item as { type?: string; content?: unknown };
      return wrapped.type === "content" ? textOf(wrapped.content) : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function translateUpdate(update: SessionUpdate, sourceId: string): SessionEvent | null {
  const u = update as unknown as Record<string, unknown>;
  switch (u.sessionUpdate) {
    case "agent_message_chunk":
      return { type: "text-delta", text: textOf(u.content), sourceId };
    case "agent_thought_chunk":
      return { type: "reasoning-delta", text: textOf(u.content), sourceId };
    case "tool_call":
      return {
        type: "tool-call",
        id: String(u.toolCallId),
        name: String(u.kind ?? "tool"),
        args: u.rawInput ?? {},
        title: typeof u.title === "string" ? u.title : undefined,
        sourceId,
      };
    case "tool_call_update": {
      if (u.status !== "completed" && u.status !== "failed") return null;
      return {
        type: "tool-result",
        id: String(u.toolCallId),
        name: String(u.kind ?? "tool"),
        output: outputOf(u.content),
        isError: u.status === "failed",
        sourceId,
      };
    }
    case "usage_update":
      return { type: "usage", inputTokens: Number(u.used ?? 0), outputTokens: 0, sourceId };
    case "plan": {
      const entries = Array.isArray(u.entries) ? u.entries : [];
      const lines = entries.map((e) => {
        const entry = e as { content?: string; status?: string };
        return `${entry.status ?? "pending"}: ${entry.content ?? ""}`;
      });
      return {
        type: "tool-call",
        id: `plan-${entries.length}`,
        name: "plan",
        args: { entries },
        title: "Plan",
        detail: lines.join("\n"),
        sourceId,
      };
    }
    default:
      return null;
  }
}

export function translateStop(stopReason: string, sourceId: string): SessionEvent {
  if (stopReason === "end_turn" || stopReason === "cancelled") return { type: "done", sourceId };
  return { type: "error", error: `the agent stopped: ${stopReason}`, sourceId };
}
```

`SessionEvent` does not currently declare `sourceId`. Add it as an optional field to every member of that union in `packages/core/src/session/session.ts` — the desktop's `SessionEventLike` already has it, so this makes the core type match what the renderer already assumes.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run packages/core/src/acp/translate.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/acp packages/core/src/session/session.ts packages/core/package.json
git commit -m "feat(core): ACP session updates become our own events

One protocol instead of an adapter per CLI. The whole surface reduces to
a pure function, so the thirty agents that speak ACP are covered by
twelve tests rather than by thirty integrations we cannot run.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 1 — Knowing what is installed

### Task 2: The agent registry

**Files:**
- Create: `packages/core/src/acp/registry.ts`, `packages/core/src/acp/registry.test.ts`

**Interfaces:**
- Produces: `interface AgentSpec { id: string; label: string; command: string; args: string[] }`, `KNOWN_AGENTS: AgentSpec[]`, and `discoverAgents(deps: { path?: string; exists: (file: string) => boolean; extra?: AgentSpec[] }): AgentSpec[]`.

Discovery is injected, not ambient, because the development machine has one agent installed and the tests must cover none and several.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/acp/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { discoverAgents, KNOWN_AGENTS } from "./registry";

const PATH = ["/usr/bin", "/home/u/.local/bin"].join(":");

describe("finding the agents on this machine", () => {
  it("finds nothing when nothing is installed, and does not throw", () => {
    expect(discoverAgents({ path: PATH, exists: () => false })).toEqual([]);
  });

  it("finds the ones that are on the path", () => {
    const found = discoverAgents({
      path: PATH,
      exists: (file) => file.includes("claude") || file.includes("codex"),
    });
    expect(found.map((a) => a.id).sort()).toEqual(["claude", "codex"]);
  });

  it("knows how to launch each one it knows about", () => {
    for (const spec of KNOWN_AGENTS) {
      expect(spec.command).toBeTruthy();
      expect(Array.isArray(spec.args)).toBe(true);
      expect(spec.label).toBeTruthy();
    }
  });

  it("takes a user's own agent, and lets it override a known one", () => {
    const extra = [{ id: "claude", label: "My build", command: "/opt/claude", args: ["acp"] }];
    const found = discoverAgents({ path: PATH, exists: () => true, extra });
    const claude = found.find((a) => a.id === "claude");
    expect(claude?.command).toBe("/opt/claude");
    expect(found.filter((a) => a.id === "claude")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run packages/core/src/acp/registry.test.ts
```

Expected: FAIL — `Failed to resolve import "./registry"`.

- [ ] **Step 3: Write the registry**

Create `packages/core/src/acp/registry.ts`:

```ts
import { delimiter, join } from "node:path";

export interface AgentSpec {
  id: string;
  label: string;
  command: string;
  args: string[];
}

export const KNOWN_AGENTS: AgentSpec[] = [
  { id: "claude", label: "Claude Code", command: "claude", args: ["--acp"] },
  { id: "codex", label: "Codex", command: "codex", args: ["acp"] },
  { id: "opencode", label: "opencode", command: "opencode", args: ["acp"] },
  { id: "gemini", label: "Gemini CLI", command: "gemini", args: ["--experimental-acp"] },
  { id: "goose", label: "Goose", command: "goose", args: ["acp"] },
];

const WINDOWS_EXT = ["", ".exe", ".cmd", ".bat"];

function onPath(command: string, path: string, exists: (file: string) => boolean): boolean {
  if (command.includes("/") || command.includes("\\")) return exists(command);
  for (const dir of path.split(delimiter).filter(Boolean)) {
    for (const ext of WINDOWS_EXT) {
      if (exists(join(dir, command + ext))) return true;
    }
  }
  return false;
}

export function discoverAgents(deps: {
  path?: string;
  exists: (file: string) => boolean;
  extra?: AgentSpec[];
}): AgentSpec[] {
  const path = deps.path ?? process.env.PATH ?? "";
  const byId = new Map<string, AgentSpec>();
  for (const spec of KNOWN_AGENTS) byId.set(spec.id, spec);
  for (const spec of deps.extra ?? []) byId.set(spec.id, spec);
  return [...byId.values()].filter((spec) => onPath(spec.command, path, deps.exists));
}
```

The launch flags above are this project's best current knowledge and **must be verified against each agent's own documentation before that agent is offered to a user**. Task 4 verifies `claude`'s; the rest carry the risk stated in the spec. If a flag turns out wrong, it is one line here, which is the point of keeping them in one table.

- [ ] **Step 4: Run the tests**

```bash
npx vitest run packages/core/src/acp/registry.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/acp/registry.ts packages/core/src/acp/registry.test.ts
git commit -m "feat(core): find the coding agents installed on this machine

Discovery is injected rather than ambient, so 'none installed' and
'several installed' are both covered on a machine that has one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 2 — Running one

### Task 3: The runner, driven by a fake agent

**Files:**
- Create: `packages/core/src/acp/run.ts`, `packages/core/src/acp/run.test.ts`

**Interfaces:**
- Consumes: `translateUpdate`, `translateStop` from `./translate`; `AgentSpec` from `./registry`.
- Produces **two** functions, and the split is the point:
  - `runSession(opts: { connectTo: unknown; cwd: string; prompt: string; sourceId: string; emit: (e: SessionEvent) => void; askPermission: (req: { title: string; options: Array<{ id: string; name: string }> }) => Promise<string>; signal?: AbortSignal }): Promise<void>` — the protocol, against any counterpart. This is what the test drives.
  - `runAgent(opts: { spec: AgentSpec; … same rest … }): Promise<void>` — spawns the process from an `AgentSpec` and hands it to `runSession`.

  Task 4 and Task 5 call `runAgent`. Only the tests call `runSession` directly.

The SDK's client side is:

```ts
import { client, ndJsonStream } from "@agentclientprotocol/sdk";

const app = client().onRequest("session/request_permission", async (params) => { … });
await app.connectWith(stream, async (agent) => {
  const session = await agent.buildSession(cwd).start();
  const finished = session.prompt(prompt);
  for (;;) {
    const msg = await session.nextUpdate();
    if (msg.kind === "stop") break;
    emit(translateUpdate(msg.update, sourceId));
  }
  await finished;
});
```

`ndJsonStream(writable, readable)` takes web streams; a Node child process gives Node streams, so convert with `Writable.toWeb(child.stdin)` and `Readable.toWeb(child.stdout)` from `node:stream`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/acp/run.test.ts`. It drives the runner against an in-process fake agent — the SDK's `client()` can connect directly to an `agent()` app with no transport, which is what makes this testable without a subprocess:

```ts
import { agent } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import { runSession } from "./run";
import type { SessionEvent } from "../session/session";

function fakeAgent() {
  return agent()
    .onRequest("initialize", async () => ({ protocolVersion: 1, agentCapabilities: {} }))
    .onRequest("session/new", async () => ({ sessionId: "s1" }))
    .onRequest("session/prompt", async (params, ctx) => {
      await ctx.notify("session/update", {
        sessionId: "s1",
        update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } },
      });
      return { stopReason: "end_turn" };
    });
}

describe("running an agent", () => {
  it("emits what the agent said, then finishes", async () => {
    const events: SessionEvent[] = [];
    await runSession({
      connectTo: fakeAgent(),
      cwd: "/repo",
      prompt: "do it",
      sourceId: "node-1",
      emit: (e) => events.push(e),
      askPermission: async () => "allow",
    });
    expect(events.map((e) => e.type)).toEqual(["text-delta", "done"]);
    expect(events.every((e) => e.sourceId === "node-1")).toBe(true);
  });
});
```

Adapt the fake's method names and context calls to the SDK's actual `agent()` API by reading `node_modules/@agentclientprotocol/sdk/dist/acp.d.ts` — the shape above is the intent, and the SDK is the authority on the exact handler signatures. If the in-process connection turns out not to support this, say so in your report and drive the test through `ndJsonStream` over a pair of in-memory streams instead; do not skip the test.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run packages/core/src/acp/run.test.ts
```

Expected: FAIL — `Failed to resolve import "./run"`.

- [ ] **Step 3: Write the runner**

Create `packages/core/src/acp/run.ts` with two exports: `runSession` (takes an already-connectable counterpart, which is what the test drives) and `runAgent` (spawns the process from an `AgentSpec` and calls `runSession`). Splitting them is what makes the protocol testable without a subprocess.

The permission handler must call the injected `askPermission` and map its answer onto the option the agent offered — never pick an option itself.

Kill the child process when the `AbortSignal` fires and when the run ends, in a `finally`. A leaked agent process holds the user's repository open.

- [ ] **Step 4: Run the tests**

```bash
npx vitest run packages/core/src/acp
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/acp
git commit -m "feat(core): run an ACP agent and emit what it does

Split so the protocol is testable without a subprocess: runSession takes
a counterpart, runAgent spawns one. Permission requests are answered by
the caller, never by us.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 4: One real run against Claude Code

**Files:**
- Create: `packages/core/src/acp/live.test.ts`

This is the task that proves the protocol works against a real agent rather than against our own fake. `claude` is installed on the development machine; nothing else is.

- [ ] **Step 1: Write the test, skipped when the agent is absent**

```ts
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { discoverAgents } from "./registry";
import { runAgent } from "./run";
import type { SessionEvent } from "../session/session";

const installed = discoverAgents({ exists: existsSync });
const claude = installed.find((a) => a.id === "claude");

describe.skipIf(!claude)("a real run against Claude Code", () => {
  it("completes a turn and tells us what happened", async () => {
    const events: SessionEvent[] = [];
    await runAgent({
      spec: claude!,
      cwd: process.cwd(),
      prompt: "Reply with the single word: ready. Do not use any tools.",
      sourceId: "live",
      emit: (e) => events.push(e),
      askPermission: async () => "deny",
    });
    expect(events.at(-1)?.type).toBe("done");
    expect(events.some((e) => e.type === "text-delta")).toBe(true);
  }, 120_000);
});
```

- [ ] **Step 2: Run it**

```bash
npx vitest run packages/core/src/acp/live.test.ts
```

Report what actually happened, including the whole error if it failed. **If `claude` does not accept `--acp`, that is the finding**: correct the flag in `registry.ts` from `claude --help`, and say in your report what the right flag is. Do not delete the test to make the suite green.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/acp/live.test.ts packages/core/src/acp/registry.ts
git commit -m "test(core): a real ACP turn against Claude Code

Skipped when the agent is not installed, so CI and other machines stay
green while the one machine that has it proves the protocol.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 3 — Many at once, and showing them

### Task 5: An external agent is a node of the run

**Files:**
- Modify: `packages/core/src/agent/subagent.ts`, `packages/core/src/index.ts`
- Test: `packages/core/src/agent/subagent.test.ts`

**Interfaces:**
- Consumes: `discoverAgents`, `runAgent`.
- Produces: the `task` tool accepts an installed agent's id in its `agent` argument, alongside the existing specialists.

`subagent.ts` already emits `subagent-start` with an `agent` name, forwards the child's events with `sourceId`, and emits `subagent-end`. An external agent takes the same path — that is why the canvas needs no new data source.

- [ ] **Step 1** Write a test that `task` with `agent: "claude"` emits `subagent-start` naming it, forwards its events with that `sourceId`, and ends with `subagent-end`. Drive it with an injected runner, not a real process.
- [ ] **Step 2** Extend the tool: if `agent` matches an installed `AgentSpec`, run it through `runAgent`; otherwise fall through to the existing specialist path. An unknown name must still fail the way it does today.
- [ ] **Step 3** Extend the tool's description so the model knows which external agents are available this session — built from `discoverAgents`, so it says nothing about agents that are not installed.
- [ ] **Step 4** `npx vitest run packages/core/src/agent packages/core/src/acp`
- [ ] **Step 5** `git add packages/core/src && git commit -m "feat(core): delegate a task to an installed coding agent"`

### Task 6: The canvas, rebuilt

**Files:**
- Create: `packages/desktop/src/renderer/canvas/summary.ts` and `summary.test.ts`
- Modify: `canvas/NodeCard.tsx`, `canvas/AgentCanvas.tsx`, `styles.css`

The canvas already lays out the tree and handles zoom and pan, with tests. This task changes what it looks like, not how it computes.

- [ ] **Step 1** Write `summary.test.ts` first: given a `RunGraph`, `runSummary(graph)` returns `{ running, done, failed }`. Cover an empty graph, a mixed one, and one where every node finished.
- [ ] **Step 2** Write `summary.ts` to pass.
- [ ] **Step 3** Rebuild `NodeCard.tsx`: an icon per agent (`claude`, `codex`, `opencode`, our own specialists, a fallback), the agent's name, its status, the single most recent activity, and its token and duration counters. Keep the existing `onSelect` and `onToggleCollapse` handlers and the `agent-node-hit` button — a node must stay reachable by keyboard.
- [ ] **Step 4** In `AgentCanvas.tsx`, draw connectors as cubic curves between a parent's bottom and a child's top instead of straight lines, and add a summary bar reading `N running · M done` from `runSummary`.
- [ ] **Step 5** Put the new `.agent-*` CSS on the scale — the style guard covers this file and will fail otherwise. `.agent-node` and its siblings are currently on the guard's `UNSWEPT` list; remove exactly the entries this task sweeps.
- [ ] **Step 6** `pnpm --filter @termcoder/desktop typecheck && npx vitest run packages/desktop/src/renderer && pnpm --filter @termcoder/desktop build`
- [ ] **Step 7** Try to look at it: `unset ELECTRON_RUN_AS_NODE && pnpm --filter @termcoder/desktop dev`. Electron does not open a window in the agent environment — report exactly what happened and do not describe a screen you did not see.
- [ ] **Step 8** `git add -A packages/desktop && git commit -m "feat(desktop): the canvas shows the run"`

---

## Not in this plan

- Merging or reconciling several agents' output. They report; the user decides.
- Installing agents, or configuring their credentials.
- A sandbox stronger than the working directory and our permission gate.
- Replacing our own `task` specialists.
- The IDE, the work panel's other tabs, or any palette or theme change.
