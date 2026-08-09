# Agent orchestration and the canvas — design

**Goal:** TermCoder runs other coding agents — Claude Code, Codex, opencode and the rest — as nodes of one run, and the canvas shows that run the way it deserves to be shown.

## The finding that shapes this

The obvious way to build this is one bespoke adapter per CLI: parse Codex's output, parse Claude Code's, parse opencode's, keep up with all of them forever. That is the version of this project that never finishes.

It is not necessary. **The Agent Client Protocol is an open standard for exactly this** — a client launches an agent as a subprocess and speaks JSON-RPC over stdio, the same shape LSP has for language servers. It is already spoken by Claude Agent, Codex CLI, Gemini CLI, OpenCode, Cursor, GitHub Copilot, Goose, Cline, Qwen Code and roughly thirty more. There is an official TypeScript SDK, `@agentclientprotocol/sdk` (Apache-2.0, compatible with our MIT), whose `client()` is our side of the wire.

So we implement one protocol, not N adapters, and every agent that speaks it works — including ones that do not exist yet.

We also do not need to copy anything from Synara. ACP is what both projects would build against.

## The second finding: our event stream already fits

`SessionEvent` in `packages/core/src/session/session.ts` already carries `subagent-start`, `tool-call`, `tool-result`, `usage`, `done` and `error`, each with an optional `sourceId`. The canvas (`packages/desktop/src/renderer/canvas/runGraph.ts`) already builds a tree of nodes from exactly those.

That means an external agent does not need a second data path. It enters the graph the way our own sub-agents already do — a `subagent-start` names it, and everything it emits carries its `sourceId`. **The canvas fills up for free.** What the canvas needs is not new plumbing; it is better-looking nodes and more of them.

The translation is small and total:

| ACP notification | our event |
| --- | --- |
| `agent_message_chunk` | `text-delta` |
| `agent_thought_chunk` | `reasoning-delta` |
| `tool_call` | `tool-call` |
| `tool_call_update` with `status: completed` | `tool-result` |
| `usage_update` | `usage` |
| `stopReason: end_turn` | `done` |
| `stopReason: refusal \| max_tokens \| max_turn_requests` | `error` with the reason |
| `stopReason: cancelled` | `done`, after our own cancel |
| `plan` | no equivalent today — carried as a `tool-call` named `plan` so it appears on the node rather than being dropped |

## What gets built

**An ACP client, in `packages/core/src/acp/`.** It launches an agent process, performs the `initialize` handshake, opens a session, sends a prompt, and turns the notification stream into our events. It knows nothing about the canvas or the desktop; it is a translator with a process attached.

**A registry of agents.** Which ones are installed, and how each is launched. Discovery looks for known binaries on `PATH`; a user can add or override an entry in settings with a command and arguments. On the machine this was designed on, `claude` is present and `codex`, `opencode`, `gemini` and `goose` are not — so the registry must degrade to "none available" without breaking anything, and must pick up a newly installed agent without an app update.

**Orchestration.** A turn can start several agents at once. Each becomes a node under the run's root, and the existing graph reducer handles the tree. Results come back as the agents' own messages; nothing is merged automatically, because merging two agents' opinions is a product decision this project is not making.

**The canvas, rebuilt.** Curved connectors between parent and child, an icon per agent so `codex` and `claude` are distinguishable at a glance, a run status bar reading `N running · M done`, and node cards that show what the agent is doing rather than a list of counters.

## The part that needs care: an external agent writes to your disk

This is the difference between this project and everything before it. A third-party agent, launched by us, editing files in the user's repository, is a real trust boundary — and ACP has a permission flow for it (`session/request_permission`).

**Every permission request from an external agent routes through our own `PermissionManager`**, the same one that gates our own tools, and appears in the same review surface. We do not auto-approve on the agent's behalf, and we do not invent a second policy. If the user has set `permission.write` to ask, an external agent asks.

An agent is launched with the session's working directory and nothing wider. Whatever credentials that agent has are its own — we do not pass ours, and we do not read its configuration.

## What this project does not do

- Merge or reconcile output from several agents. They report; the user decides.
- Install agents. If it is not on `PATH` and not configured, it is not offered.
- Replace our own `task` sub-agents. Those keep working and share the same graph.
- Restructure the IDE, or change the work panel added in 0.12.0 beyond giving the canvas tab better contents.
- Sandbox the external agent beyond the working directory and our permission gate. A stronger sandbox is worth doing and is not this project.

## How it is verified

- **The translator is a pure function over notifications** and is tested as one: every row of the table above, including the stop reasons, without a subprocess.
- **The registry is tested against a fake `PATH`**, so "none installed" and "three installed" are both covered on a machine that has neither.
- **One real end-to-end run against `claude`**, which is installed on the development machine — the handshake, a prompt, a tool call, and a clean finish.
- **`codex`, `opencode` and the others cannot be run here.** They are covered by the translator's tests and by the registry's, not by execution. That is stated plainly rather than discovered later: the first person with those installed is the real test, and the protocol is what makes that a reasonable bet.
- The canvas keeps its existing layout and zoom tests, and gains tests for the run summary.
