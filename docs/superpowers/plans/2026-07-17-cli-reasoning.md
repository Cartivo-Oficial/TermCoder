# CLI Reasoning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the model's reasoning in the `term` CLI — a dimmed, collapsible thinking panel — and show the active model and agent in the status bar.

**Architecture:** The AI SDK v5 `fullStream` already emits `reasoning-delta`; the session loop discards it. Core starts yielding it as a `SessionEvent`, enables provider thinking where a flag is needed, and the TUI renders it as a new `ViewItem` kind. Everything degrades to today's behaviour for a model that does not reason.

**Tech Stack:** TypeScript, AI SDK v5 (`ai@^5`, `@ai-sdk/anthropic@^2`), Ink (React for the terminal), vitest.

**Spec:** `docs/superpowers/specs/2026-07-17-cli-reasoning-design.md`

## Global Constraints

- **Code carries no comments.** Hard repo rule, stated twice by the user, emphatically. Explanations go in commit messages.
- **A model that does not reason must look exactly like today** — no empty thinking panel, no "thought for 0s" when nothing was thought. Create the thinking item only on the first real `reasoning-delta`.
- **Anthropic thinking and `temperature` are mutually exclusive.** When thinking is enabled for an Anthropic model, `streamText` sends the thinking option and omits `temperature`, or the API 400s.
- **Enable thinking only for providers known to accept it.** Passing `providerOptions.anthropic` to a non-Anthropic model (the keyless/free model, Ollama, Google) must not break the request.
- **The reasoning panel must be switch-off-able and never dominate** — muted colour, bounded height. Reasoning that clutters the screen is the exact complaint that started this.
- Tests run with vitest from the WORKTREE ROOT, never a package subdirectory.
- The TUI is Ink; there is no scrollback — "collapse" and "expand" both mean re-rendering inline.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/session/session.ts` | emit `reasoning-delta`/`reasoning-end`; enable thinking per-provider |
| `packages/core/src/session/session.test.ts` | the stream + provider-option tests |
| `packages/core/src/config/config.ts` | a `reasoning` config toggle |
| `packages/tui/src/types.ts` | the `thinking` ViewItem |
| `packages/tui/src/components/Thinking.tsx` | the dimmed collapsible panel |
| `packages/tui/src/components/Transcript.tsx` | render the `thinking` item |
| `packages/tui/src/app.tsx` | map reasoning events to thinking items; the off switch |
| `packages/tui/src/components/StatusBar.tsx` | active model + agent |

---

### Task 1: Core emits reasoning from the stream

**Files:**
- Modify: `packages/core/src/session/session.ts`
- Test: `packages/core/src/session/session.test.ts`

**Interfaces:**
- Produces: `SessionEvent` gains `{ type: "reasoning-delta"; text: string }` and `{ type: "reasoning-end" }`. `prompt()` yields them as they arrive from `fullStream`.

- [ ] **Step 1: Write the failing test**

Read `session.test.ts` first for its existing fake-model / fake-stream setup and reuse it. The test drives `prompt()` with a fake `fullStream` that yields reasoning then text, and asserts the event order.

```ts
it("surfaces reasoning-delta events before the answer, in order", async () => {
  const session = makeSession({
    stream: [
      { type: "reasoning-delta", text: "Let me think. " },
      { type: "reasoning-delta", text: "The file is large." },
      { type: "reasoning-end" },
      { type: "text-delta", text: "Here is the fix." },
    ],
  });
  const events = [];
  for await (const e of session.prompt("hi")) events.push(e);
  const kinds = events.map((e) => e.type);
  expect(kinds).toEqual(["reasoning-delta", "reasoning-delta", "reasoning-end", "text-delta", "usage", "done"]);
  const reasoning = events.filter((e) => e.type === "reasoning-delta").map((e) => e.text).join("");
  expect(reasoning).toBe("Let me think. The file is large.");
});

it("emits no reasoning events for a stream that does not reason", async () => {
  const session = makeSession({ stream: [{ type: "text-delta", text: "hello" }] });
  const events = [];
  for await (const e of session.prompt("hi")) events.push(e);
  expect(events.some((e) => e.type.startsWith("reasoning"))).toBe(false);
});
```

Adapt `makeSession`/the stream fixture to whatever the file actually calls its helpers. If the existing tests build the fake stream differently, follow that shape rather than inventing `makeSession`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/core/src/session/session.test.ts`
Expected: FAIL — the reasoning events never appear (they are discarded by the stream loop).

- [ ] **Step 3: Implement**

In `session.ts`, add the two members to `SessionEvent` (after `text-delta`):

```ts
  | { type: "reasoning-delta"; text: string }
  | { type: "reasoning-end" }
```

In the stream loop (around `session.ts:443`), extend the branch chain — keep `text-delta` and `error` exactly as they are:

```ts
            if (chunk.type === "text-delta") {
              emittedText = true;
              yield { type: "text-delta", text: (chunk as { text?: string }).text ?? "" };
            } else if (chunk.type === "reasoning-delta") {
              yield { type: "reasoning-delta", text: (chunk as { text?: string }).text ?? "" };
            } else if (chunk.type === "reasoning-end") {
              yield { type: "reasoning-end" };
            } else if (chunk.type === "error") {
```

Also widen the `fullStream` type at `session.ts:34` if TypeScript requires it — it is already `{ type: string; text?: string; error?: unknown }`, which covers the new chunk shapes, so likely no change.

- [ ] **Step 4: Run it and watch it pass, then the full suite**

Run: `npx vitest run packages/core/src/session/session.test.ts` then `npx vitest run`
Report the real count.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/session.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): emit reasoning from the model stream"
```

---

### Task 2: Enable provider thinking, without breaking non-reasoning models

**Files:**
- Modify: `packages/core/src/session/session.ts`
- Modify: `packages/core/src/config/config.ts`
- Test: `packages/core/src/session/session.test.ts`

**Interfaces:**
- Consumes: the `SessionEvent` from Task 1.
- Produces: a `reasoning` config field; `streamText` sends the Anthropic thinking option and omits `temperature` when reasoning is on and the model is Anthropic.

- [ ] **Step 1: Read how the model id reveals its provider**

`streamText` gets a `model` object (`session.ts:288`, via `resolveModel`), but the provider is knowable from the model id string (`session.record.model`, e.g. `anthropic/claude-sonnet-5`). Determine the provider prefix the same way the rest of the code does (it splits on `/` in several places, e.g. `app.tsx:300`). Use that; do not add a new provider-detection scheme.

- [ ] **Step 2: Add the config toggle**

In `config.ts`, add to the config schema (near `theme`/`model`):

```ts
  reasoning: z.boolean().default(true),
```

Default `true` — surfacing reasoning is the point; a user disables it in config or hides it in the CLI. Add a one-line note in the commit that this spends thinking tokens on Anthropic.

- [ ] **Step 3: Write the failing test**

Assert on the arguments passed to `streamText` via a spy. Reuse the file's existing model-injection seam if it has one; otherwise inject a fake `streamText`.

```ts
it("enables Anthropic thinking and omits temperature when reasoning is on", async () => {
  const spy = captureStreamTextArgs();
  const session = makeSession({ model: "anthropic/claude-sonnet-5", config: { reasoning: true }, temperature: 0.3 });
  await drain(session.prompt("hi"));
  const args = spy.lastArgs();
  expect(args.providerOptions?.anthropic?.thinking?.type).toBe("enabled");
  expect(args.temperature).toBeUndefined();
});

it("sends no thinking option and keeps temperature for a non-Anthropic model", async () => {
  const spy = captureStreamTextArgs();
  const session = makeSession({ model: "google/gemini-2.5-pro", config: { reasoning: true }, temperature: 0.3 });
  await drain(session.prompt("hi"));
  const args = spy.lastArgs();
  expect(args.providerOptions?.anthropic).toBeUndefined();
  expect(args.temperature).toBe(0.3);
});

it("sends no thinking option when reasoning is off", async () => {
  const spy = captureStreamTextArgs();
  const session = makeSession({ model: "anthropic/claude-sonnet-5", config: { reasoning: false }, temperature: 0.3 });
  await drain(session.prompt("hi"));
  expect(spy.lastArgs().providerOptions?.anthropic).toBeUndefined();
  expect(spy.lastArgs().temperature).toBe(0.3);
});
```

Adapt the helper names to the file's real seams. If `streamText` is not injectable today, add the smallest seam that makes it so (a `deps.streamText` defaulting to the real import), and say so in your report.

- [ ] **Step 4: Run it and watch it fail**

Run: `npx vitest run packages/core/src/session/session.test.ts`
Expected: FAIL — thinking is never enabled and temperature is always sent.

- [ ] **Step 5: Implement**

In the `streamText` call (`session.ts:294`), build the options conditionally:

```ts
    const isAnthropic = (modelOverride ?? agent.model ?? this.record.model).split("/")[0] === "anthropic";
    const reasoningOn = this.deps.config.reasoning !== false;
    const wantThinking = isAnthropic && reasoningOn;
    return ({ system, messages, tools, signal }) =>
      streamText({
        model,
        system,
        messages,
        tools,
        ...(wantThinking ? {} : { temperature }),
        ...(wantThinking
          ? { providerOptions: { anthropic: { thinking: { type: "enabled", budgetTokens: 4000 } } } }
          : {}),
        abortSignal: signal,
      }) as unknown as ModelStreamResult;
```

`budgetTokens: 4000` is a reasonable default; keep it a named local if the file prefers.

- [ ] **Step 6: Run it and watch it pass, then the full suite**

Run: `npx vitest run packages/core/src/session/session.test.ts` then `npx vitest run`

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/session/session.ts packages/core/src/config/config.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): enable model thinking behind a reasoning toggle"
```

---

### Task 3: The thinking item and its component

**Files:**
- Modify: `packages/tui/src/types.ts`
- Create: `packages/tui/src/components/Thinking.tsx`
- Modify: `packages/tui/src/components/Transcript.tsx`
- Test: `packages/tui/src/components/components.test.tsx`

**Interfaces:**
- Produces: `ViewItem` gains `{ kind: "thinking"; text: string; done?: boolean; dur?: string }`; `<Thinking>` renders it.

- [ ] **Step 1: Add the ViewItem member**

In `types.ts`:

```ts
  | { kind: "thinking"; text: string; done?: boolean; dur?: string }
```

- [ ] **Step 2: Write the failing test**

Follow `components.test.tsx`'s existing ink-testing-library render pattern (read it first). Assert:
- a not-done thinking item renders its text under a `✻ thinking` heading;
- a done thinking item renders the collapsed one-line `✻ thought for {dur}` and NOT the full text.

```tsx
it("streams reasoning while thinking, collapses when done", () => {
  const live = render(<Thinking theme={theme} item={{ kind: "thinking", text: "weighing options", done: false }} />);
  expect(live.lastFrame()).toContain("thinking");
  expect(live.lastFrame()).toContain("weighing options");

  const done = render(<Thinking theme={theme} item={{ kind: "thinking", text: "weighing options", done: true, dur: "3.2s" }} />);
  expect(done.lastFrame()).toContain("thought for 3.2s");
  expect(done.lastFrame()).not.toContain("weighing options");
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run packages/tui/src/components/components.test.tsx`
Expected: FAIL — `Thinking` does not exist.

- [ ] **Step 4: Implement**

Create `Thinking.tsx`. Dimmed throughout (`theme.muted`/`theme.border`), bounded height while streaming (show the tail — the last ~6 lines — not the whole thing), collapsing to one line when `done`:

```tsx
import { Box, Text } from "ink";
import type { Theme } from "../theme";

const TAIL = 6;

export function Thinking({ theme, item }: { theme: Theme; item: { text: string; done?: boolean; dur?: string } }) {
  if (item.done) {
    return (
      <Box marginTop={1}>
        <Text color={theme.border}>{`✻ thought${item.dur ? ` for ${item.dur}` : ""}`}</Text>
      </Box>
    );
  }
  const lines = item.text.split("\n");
  const shown = lines.slice(-TAIL);
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.muted}>✻ thinking</Text>
      <Text color={theme.border}>
        {shown.map((l) => `  ${l}`).join("\n")}
      </Text>
    </Box>
  );
}
```

Then in `Transcript.tsx`'s `TranscriptItem` switch, add:

```tsx
    case "thinking":
      return <Thinking theme={theme} item={item} />;
```

and import it.

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run packages/tui/src/components/components.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add packages/tui/src/types.ts packages/tui/src/components/Thinking.tsx packages/tui/src/components/Transcript.tsx packages/tui/src/components/components.test.tsx
git commit -m "feat(tui): a dimmed collapsible thinking panel"
```

---

### Task 4: Wire reasoning into the turn

**Files:**
- Modify: `packages/tui/src/app.tsx`

**Interfaces:**
- Consumes: the `reasoning-delta`/`reasoning-end` events (Task 1) and the `thinking` ViewItem (Task 3).

- [ ] **Step 1: Read the stream loop**

`app.tsx:452-531` is the `for await` over `useSession.prompt`, building `localLive`. There is an existing `markThought()` (`app.tsx:459`) that pushes a `✻ Thought {dur}` notice when the first text/tool arrives. The reasoning panel supersedes that primitive: a live thinking item that collapses, rather than a bare duration notice.

- [ ] **Step 2: Add the cases**

Add a `thinkingIdx` alongside `assistantIdx`, and handle the events. Respect the off switch — read the config `reasoning` flag (available via the session/config in app state); when off, drop the deltas entirely.

```tsx
          case "reasoning-delta": {
            if (session.config?.reasoning === false) break;
            setStatus("Thinking…");
            if (thinkingIdx === null) {
              localLive.push({ kind: "thinking", text: event.text, done: false });
              thinkingIdx = localLive.length - 1;
            } else {
              const cur = localLive[thinkingIdx];
              if (cur?.kind === "thinking") localLive[thinkingIdx] = { ...cur, text: cur.text + event.text };
            }
            sync();
            break;
          }
          case "reasoning-end": {
            if (thinkingIdx !== null) {
              const cur = localLive[thinkingIdx];
              if (cur?.kind === "thinking") {
                const ms = Date.now() - turnStart;
                localLive[thinkingIdx] = { ...cur, done: true, dur: ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s` };
              }
              thinkingIdx = null;
            }
            break;
          }
```

When a `text-delta` or `tool-call` arrives and `thinkingIdx` is still open (a model that reasons but emits no `reasoning-end`), mark it done there too — factor the "close the current thinking block" logic into a local helper and call it from `markThought()` so the two do not diverge. Confirm the exact `session`/config accessor name by reading how `app.tsx` already reads `session.record.model`; adapt `session.config?.reasoning` to the real shape.

- [ ] **Step 3: Verify by build + a real run**

Run: `cd packages/tui && npm run build` (or the repo's TUI build), and `npx vitest run`.
Then run `term` against a reasoning Anthropic model if a key is available, and against the free model. Report what you saw for each. If no key is available, say so — this is a manual gate, not skippable by assertion.

- [ ] **Step 4: Commit**

```bash
git add packages/tui/src/app.tsx
git commit -m "feat(tui): render the model's reasoning as it streams"
```

---

### Task 5: The status bar shows the model and agent

**Files:**
- Modify: `packages/tui/src/components/StatusBar.tsx`
- Modify: `packages/tui/src/app.tsx`
- Test: `packages/tui/src/components/components.test.tsx`

**Interfaces:**
- Produces: `StatusBar` gains `model` and `agent` props and renders them.

- [ ] **Step 1: Write the failing test**

```tsx
it("shows the active model and agent", () => {
  const frame = render(
    <StatusBar theme={theme} cwd="/x/y" tokens={0} autoApprove={false} model="anthropic/claude-sonnet-5" agent="build" />,
  ).lastFrame();
  expect(frame).toContain("claude-sonnet-5");
  expect(frame).toContain("build");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/tui/src/components/components.test.tsx`
Expected: FAIL — `StatusBar` takes no `model`/`agent`.

- [ ] **Step 3: Implement**

Add `model?: string` and `agent?: string` to `StatusBarProps`. Render the model (short form — the part after `/`) and the agent, using the same `dot` separator pattern already in the file. Keep it left of the existing fields or wherever reads cleanest; do not let it wrap on a narrow terminal — the model short name and agent are short.

Wire the props in `app.tsx` where `<StatusBar .../>` is rendered, from `session.record.model` and `session.record.agent ?? session.record.mode ?? "build"` (the same expression `app.tsx:365` already uses).

- [ ] **Step 4: Run it and watch it pass, then build**

Run: `npx vitest run packages/tui/src/components/components.test.tsx` then the TUI build.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/components/StatusBar.tsx packages/tui/src/app.tsx packages/tui/src/components/components.test.tsx
git commit -m "feat(tui): show the active model and agent in the status bar"
```

---

## Manual acceptance

- [ ] `term` against a reasoning Anthropic model: the thinking panel streams dimmed, collapses to `✻ thought for {dur}` when the answer starts.
- [ ] `term` against the free/keyless model: looks exactly like today — no thinking panel, no stray line.
- [ ] Set `reasoning: false` in config: no thinking panel even on Anthropic; temperature is honoured again.
- [ ] The status bar shows the model short name and the agent, and does not wrap on an 80-column terminal.
