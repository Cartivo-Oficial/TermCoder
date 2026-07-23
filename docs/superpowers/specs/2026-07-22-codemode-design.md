# CodeMode — confined code execution over the tool registry

Date: 2026-07-22
Status: approved design, pending implementation plan
Package: `@termcoder/core`

## Summary

Add a single opt-in tool, `run_code`, that lets the model write one small
JavaScript program which orchestrates the existing tools — sequencing,
looping, branching, transforming data, and running independent calls in
parallel — in a single execution instead of many round-trip tool calls.

The program runs in a locked-down `node:vm` context whose only capability is
a frozen `tools` object. It receives no ambient filesystem, process, network,
or module authority; every effect goes through the same permission-gated tool
path a normal tool call uses.

## Goals

- One `run_code` tool the model calls when orchestration helps; normal
  tool-calling is unchanged and still available.
- The program can `await tools.<name>(args)` for any registered tool, plus
  sequence/loop/branch/`Promise.all` over them.
- Effects go through the exact same `tool.run(args, ctx)` path — permission
  checks and session events included — so a program can do nothing a normal
  tool call could not.
- Deterministic, bounded execution: timeout, tool-call cap, output truncation.
- No new native dependencies; no infra.

## Non-goals

- Not a mode toggle and not a replacement for tool-calling (opt-in tool only).
- Not a hardened boundary against a deliberately malicious model. `node:vm`
  is not an escape-proof sandbox; the security argument is that the program's
  only reachable capability is the permission-gated tool set (same surface as
  normal tool calls). `isolated-vm` is a future hardening option, out of scope.
- No persistence of programs, no cross-call state, no scheduling.

## Known limitations

- Because both the `runInContext` timeout and the outer `withTimeout` race run on
  the single Node event loop, a program that `await`s something and then enters a
  synchronous infinite loop can block that loop entirely, so neither timeout ever
  fires and the process hangs; this is inherent to the `node:vm`-only approach,
  and moving to `isolated-vm` or a worker thread (see Non-goals) is the follow-up
  that would let the host actually preempt a stuck program.

## Existing context

- Tools implement `TermTool` (`packages/core/src/tools/types.ts`):
  `{ name, description, inputSchema: ZodType, readOnly, permissionKind?,
  run(args, ctx): Promise<ToolResult> }`, where
  `ToolResult = { output: string; meta?: Record<string, unknown> }` and
  `ToolContext = { cwd; toolCallId?; emit? }`.
- Tools are registered in `packages/core/src/tools/index.ts` (a registry with
  `get(name)`); current tools: bash, edit, glob, grep, ls, read, write,
  memory, recipe, repomap, skill, symbols, webfetch, websearch.
- Permission enforcement and event emission already happen on the normal
  tool-call path; `run_code` reuses that path per call, so it inherits both.

## Architecture

Three small, independently testable units under `packages/core/src/codemode/`:

### `bridge.ts` — tool surface builder
- `buildToolBridge(registry, ctx, opts)` returns `{ tools, callCount() }`.
- For each registered tool (excluding `run_code` itself), creates an async
  function `tools[name] = async (args) => { ... }` that:
  1. increments a call counter; throws if it exceeds `opts.maxCalls`.
  2. validates `args` with the tool's `inputSchema` (Zod `parse`), throwing a
     readable error on invalid args.
  3. calls `tool.run(parsed, ctx)` — same path as a normal tool call, so
     permission + `ctx.emit` events fire.
  4. returns `result.output` (string). `meta` is available via a second form
     `tools[name].full(args) => { output, meta }` only if we find we need it;
     default returns the string for ergonomics.
- The returned `tools` object is deep-frozen before handing to the sandbox.

### `sandbox.ts` — the confined runner
- `runProgram(code, tools, opts)` builds a `vm` context that contains ONLY:
  - `tools` (frozen),
  - a captured `console` (`log`/`error`/`warn` push to an in-memory buffer,
    truncated to `opts.maxLog`),
  - safe intrinsics that `vm` provides by default (JSON, Math, Array, Object,
    Promise, String, Number, Date),
  - NOTHING else: no `require`, `process`, `Buffer`, `fetch`, `import`,
    `globalThis` escape, `setTimeout`/`setInterval` (omitted), `eval` off.
- Wraps user code as `(async () => { <code> })()`, compiles with
  `vm.Script`, runs with `runInContext(ctx, { timeout: opts.timeoutMs })`,
  and awaits the returned promise on the host (the vm context shares the
  host microtask queue, so `await tools.x()` on host async functions works).
- Enforces the wall-clock timeout around the whole await (the `vm` `timeout`
  option only bounds synchronous execution, so we also race the awaited
  promise against a host timer and abort).
- Returns `{ returnValue, logs, error? }`.

### `runcode.ts` — the `run_code` tool
- `defineTool({ name: "run_code", inputSchema: z.object({ code: z.string() }),
  readOnly: false, run })`.
- `run({ code }, ctx)`:
  1. builds the bridge over the live registry + `ctx`,
  2. runs the program in the sandbox with configured limits,
  3. formats `ToolResult.output`:
     - on success: JSON-stringified `returnValue` (truncated) followed by the
       captured `logs` (truncated), with clear section markers;
     - on error: a `"CodeMode error: <message>"` line plus any logs captured
       before the failure, so the model can fix and retry.
  - `describe` returns a short title ("run code") for the UI.

Registration: add `run_code` to the tools registry (`tools/index.ts`), gated
the same way other tools are surfaced to the model.

## Data flow

```
model emits run_code({code})
  -> runcode.run: buildToolBridge(registry, ctx, limits)
  -> sandbox.runProgram(code, tools, limits)
       program: await tools.grep(...); for (...) await tools.read(...); return summary
         each tools.x() -> validate(Zod) -> tool.run(args, ctx) [permission + emit]
  -> format {returnValue, logs, error} into ToolResult.output
  -> output returned to the model as the tool result
```

## Limits (configurable, sane defaults)

- `timeoutMs`: 30000
- `maxCalls`: 100 (tool calls per program)
- `maxLog`: 16 KB captured console output
- `maxOutput`: 24 KB final `ToolResult.output` (truncate with a notice)

Sourced from config with these defaults; no per-call model control (YAGNI).

## Error handling

- Invalid tool args -> the `tools.x()` call rejects with a Zod-derived message;
  surfaces to the program (it can catch) and, if unhandled, into the error output.
- Exceeding `maxCalls` -> the call throws `CodeMode: tool-call limit reached`.
- Timeout -> abort, return a `CodeMode: timed out after Ns` error output.
- Program throw / syntax error -> caught, returned as usable error output +
  partial logs. Never crashes the host session.

## Testing

Unit tests under `packages/core/src/codemode/`:
- happy path: a program that calls a read tool, loops, and `return`s a value ->
  output contains the value + logs.
- parallelism: `Promise.all([tools.read(a), tools.read(b)])` resolves both.
- ambient denial: `typeof require`, `typeof process`, `typeof fetch`,
  `typeof Buffer` are all `"undefined"` inside the program.
- arg validation: bad args to a tool reject with a readable message.
- call cap: a loop over `maxCalls+1` calls throws the limit error.
- timeout: a program that never resolves aborts within the bound.
- error surfacing: `throw new Error("x")` returns a `CodeMode error: x` output.
- permission/emit: `ctx.emit` is invoked for each tool call the program makes.

Follow the repo convention of comment-free source; tests may use minimal
descriptive names.

## File layout

```
packages/core/src/codemode/
  bridge.ts
  bridge.test.ts
  sandbox.ts
  sandbox.test.ts
  runcode.ts
  runcode.test.ts
  index.ts        (exports run_code tool + types)
packages/core/src/tools/index.ts   (register run_code)
packages/core/src/config/...        (defaults for the 4 limits)
```

## Rollout

Single implementation plan. Land behind the normal tool registry so the model
can start using `run_code` immediately; no flag needed since it is additive
and inherits existing permissioning.
