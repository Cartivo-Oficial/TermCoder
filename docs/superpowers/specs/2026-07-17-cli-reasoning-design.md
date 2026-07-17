# CLI: show the model's reasoning, and sharpen the panels

**Date:** 2026-07-17
**Status:** draft, awaiting review

## Problem

The `term` CLI never shows the model thinking. When a turn runs, the user sees nothing until text starts, then tool calls. For a reasoning model that spends real time thinking, the terminal just sits there. The user asked to "improve the AI's thoughts" and the panels and general feel of the CLI.

Two things are true in the code:
- `SessionEvent` (`packages/core/src/session/session.ts:25`) has no reasoning event. The stream loop reads only `text-delta` and `error` and **discards every other chunk** — including the `reasoning-delta` the AI SDK v5 `fullStream` already produces (`session.ts:443`).
- `streamText` (`session.ts:294`) passes no `providerOptions`, so Anthropic extended thinking is never turned on. The reasoning that IS flowing today comes only from models that reason by default.

So the reasoning is partly there and thrown away, and partly not requested at all.

## What we build

1. **Core emits reasoning.** A new `reasoning-delta` (and a boundary marker) on `SessionEvent`, captured from `fullStream`. A config toggle turns model thinking on where the provider needs a flag.
2. **The CLI renders it.** A dimmed, collapsible "thinking" panel that streams while the model reasons and collapses to a one-line summary once the answer begins. Off-switchable.
3. **The panels get sharper.** The StatusBar shows the active model and agent — today it shows neither, so you cannot tell from the bar what you are talking to. A clearer working indicator while a turn runs.

Scope is deliberately these three. Not: a full theme redesign, not new commands, not the desktop.

## Core changes

`packages/core/src/session/session.ts`

- `SessionEvent` gains:
  ```ts
  | { type: "reasoning-delta"; text: string }
  | { type: "reasoning-end" }
  ```
  `reasoning-end` lets a consumer know thinking is over without waiting for the first `text-delta` (some turns reason, call a tool, and reason again).

- The stream loop adds branches:
  ```ts
  } else if (chunk.type === "reasoning-delta") {
    yield { type: "reasoning-delta", text: (chunk as { text?: string }).text ?? "" };
  } else if (chunk.type === "reasoning-end") {
    yield { type: "reasoning-end" };
  }
  ```
  Existing `text-delta`/`error` handling is untouched. Unknown chunk types are still ignored.

- **Enabling thinking is per-provider and collides with temperature.** Anthropic extended thinking is enabled with `providerOptions.anthropic.thinking = { type: "enabled", budgetTokens: N }`, and in that mode the request must not send a custom `temperature`. So when reasoning is enabled for an Anthropic model, `streamText` sends the thinking option and omits `temperature`. Models that reason by default (some OpenAI/Google reasoning models) need no flag. A model that does not reason gets nothing extra and simply emits no reasoning deltas — the feature degrades to today's behaviour.

- **Config toggle.** `config.reasoning` — off | on, defaulting to a sensible value (proposed: on, since the whole point is to surface it; a user who dislikes it disables it in config or hides it in the CLI). The budget for Anthropic is a fixed reasonable default, not user-facing at first.

- **Share/export.** `share.ts:61` already deliberately omits reasoning parts from the exported transcript (a `default: break` with a comment). That stays the sensible default — a shared session need not carry the model's private reasoning. The plan just confirms this and does not accidentally start exporting reasoning; no change expected unless we decide otherwise.

## CLI changes

`packages/tui`

- `ViewItem` (`types.ts`) gains `{ kind: "thinking"; text: string; done?: boolean }`.

- A new `Thinking.tsx`:
  - While streaming: a dimmed block, prefixed (e.g. `✻ thinking`), showing the reasoning as it arrives. It must not visually compete with the answer — muted colour, and a bounded height (show the tail, not an unbounded wall).
  - Once the answer starts (or `reasoning-end` fires): collapse to a single dimmed line, `✻ thought for {dur}`, which the design keeps in the transcript as a quiet record. Whether it is re-expandable is a plan decision (Ink has no scrollback, so "expand" means re-rendering the full text inline).
  - Never shown at all if the config/CLI switch is off.

- `app.tsx` maps `reasoning-delta` → append to the current thinking item; `reasoning-end` or the first `text-delta` → mark it `done`. A turn can have several thinking blocks (reason → tool → reason); each is its own item, in order.

- **StatusBar** (`StatusBar.tsx`) gains the active model and agent name. This is the cheapest, highest-value panel win: right now the bar shows path, ctx, tokens, auto, version — but not what model or agent you are on.

- **Working indicator.** While a turn runs and before any text, a small animated `✻ thinking…` line so the terminal is never silent. This is the same affordance the reasoning panel provides when reasoning exists; when it does not, the indicator still reassures.

## What could go wrong

- **A model with no reasoning** must look exactly like today — no empty thinking panel, no stray "thought for 0s". The thinking item is created only on the first `reasoning-delta`.
- **Thinking + temperature** — sending both to Anthropic is an API error. The core change must drop temperature when it enables thinking, and a test must cover that the option set is mutually exclusive.
- **The keyless/free model** may not support thinking or `providerOptions`; passing the option must not break it. Enable thinking only for providers known to accept it; everything else is unchanged.
- **Noise.** Reasoning can be long. The panel must be bounded and dimmed, and the whole thing must be switch-off-able, or it becomes clutter — the exact complaint that started this.
- **Cost/latency.** Extended thinking spends tokens and time. Defaulting it on is a product call; the plan should make the default easy to flip and document the token cost in the config comment.

## Testing

- **Core**: a fake `fullStream` emitting `reasoning-delta` then `text-delta` yields `reasoning-delta` then `text-delta` in order; a stream with no reasoning yields no reasoning events; enabling thinking for an Anthropic model sends the thinking option and omits temperature (assert on the `streamText` args via a spy); a non-Anthropic model sends neither.
- **CLI**: `app.tsx`'s reducer maps a `reasoning-delta`/`reasoning-end` pair to one thinking item marked done; a turn with two reasoning bursts makes two items; with the switch off, none. StatusBar renders model + agent.
- **Manual**: run `term` against a reasoning model, confirm the panel streams and collapses; run against the free model, confirm it looks like today.

## Out of scope

- A theme redesign, new slash commands, the desktop app.
- Per-turn reasoning-effort control from the CLI (config default only, at first).
- Persisting reasoning into saved sessions beyond whatever `share.ts` already does.
