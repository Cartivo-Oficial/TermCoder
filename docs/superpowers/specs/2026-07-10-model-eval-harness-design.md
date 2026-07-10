# Model Eval Harness — Design

**Status:** in progress (skeleton built, first run underway)
**Date:** 2026-07-10

## Why

The user says the models feel "horrible." The evidence is real: the keyless default (`termcoderfree/auto` → pollinations gpt-oss) leaks harmony tokens into tool names, takes minutes per turn, and — until a fix this week — could not use tools at all. But TermCoder does not train models; "improving the models" means changing four different things (the free default, the routing, the prompt/scaffolding, the model catalog). None of those can be improved responsibly without a way to **measure**, and there is none in the repo.

This harness is that measurement. Nothing about model quality gets changed until a number can move.

## What it measures

For each `(task, model)` pair: does the agent make a real, verifiable code change pass? Plus the cost of getting there. The score is not a vibe — it is a verify command's exit code.

- **pass** — the task's `verify` command exits 0, AND the agent did not tamper with a protected file (the test), AND the turn did not error.
- **toolCalls** — how many tools it used (a proxy for thrash).
- **seconds** — wall-clock for the turn (the free model's latency is a real product problem).
- **tokens** — in+out, when the provider reports usage.
- **leakedToolNames** — count of tool-call events whose name contains `<|` (the harmony-token leak the free model exhibits). A quality tripwire specific to what we have seen break.

## Structure

```
eval/
  run.mjs              the driver
  tasks/<name>/
    task.json          { prompt, verify, protect[] }
    seed/              a real project, in a failing state
  results/             (gitignored) JSON scorecards
```

`run.mjs` for each task: copy `seed/` to a fresh tempdir, fingerprint the `protect` files, start the real `@termcoder/server` in-process, create a session, set the model, drive one turn over the documented WebSocket (auto-allowing permissions), then run `verify` in the tempdir and compare the protected-file hashes. Cleans up the tempdir. Prints a scorecard and a JSON line.

It imports the built `../packages/*/dist/index.js` by relative path (eval/ is not a package), so `pnpm --filter @termcoder/{core,server} build` must run first.

## The anti-cheat rule (learned the hard way)

While recording the website hero, the free model "passed" a task by **editing the test** instead of the code. The harness must catch that, or every score is a lie. `protect` lists the files the agent must not touch (always the test); the runner hashes them before and after and fails the task on any change. This is not optional — it is the difference between measuring capability and measuring gaming.

## Tasks (seed set — grows over time)

1. **add-version-flag** — implement a `--version` flag reading `package.json`; a test asserts the exact output. Protect the test.
2. **fix-sum-bug** — a `sum` that subtracts; failing tests. Find and fix. Protect the test.

Both are verified to fail in their seed state (exit 1), so a pass means the agent actually did the work. More tasks (multi-file edits, a failing build, a refactor that must preserve behavior) come next; the harness scales by dropping a folder in `tasks/`.

## How it gets used

- **Baseline first:** run the seed tasks against the free model and against one strong model. The gap is the diagnosis — it shows whether "horrible" is the free tier, the routing, or the scaffolding.
- **Then, one lever at a time:** change the free default, or the routing, or the prompt — and re-run. A change that does not move the score does not ship.
- **Cost honesty:** the free model is slow but free; paid models cost the user money and are run deliberately, not on every commit. Gemini's free tier runs out. So CI does not run this; a human does, on purpose.

## Not in scope

- No judging answer "quality" with an LLM grader yet — pass/fail on a real verify command is harder to game and needs no second model. A rubric grader can come later for tasks without a clean verify.
- No leaderboard, no web UI. A printed scorecard and a JSON line are enough to make decisions.
