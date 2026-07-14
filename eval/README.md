# Eval harness

A small agentic benchmark: each task seeds a throwaway project, drives one real
turn through the server (WebSocket, auto-approving permissions), then grades the
result. It measures whether a model can actually finish a coding task with the
tools — not just produce plausible text.

## Running

```bash
pnpm build                       # build core + server dist first
pnpm eval                        # all tasks, once, on the free model
pnpm eval --task=fix-sum-bug     # a single task
pnpm eval --category=debug       # every task in one category
pnpm eval --model=anthropic/claude-sonnet-5 --runs=3
pnpm eval --list                 # print the task table, don't run
pnpm eval --save                 # write eval/results/<stamp>.json + latest.json
pnpm eval --baseline=eval/results/latest.json   # flag regressions vs a saved run
```

Flags: `--model`, `--task`, `--category`, `--runs`, `--timeout` (seconds/turn),
`--save`, `--baseline=<file>`, `--list`.

## Scoring

A run **passes** when all of these hold:

- `verify` (if present) exits 0
- every `check` entry is satisfied
- no `protect`ed file was modified (hash compared before/after)
- the turn didn't error or time out

The report also tracks tool-call count, wall-clock seconds, and `leak` (tool
names that leaked chat-template markers like `<|`). Results are grouped by
category, and `--baseline` prints per-task regressions/improvements.

## Adding a task

Create `tasks/<name>/` with a `task.json` and a `seed/` directory (copied
verbatim into the temp workspace).

```jsonc
{
  "category": "debug",              // debug | feature | implement | testing | restraint | multi-file | ...
  "prompt": "what to ask the agent",
  "setup": "npm install",           // optional, run before the turn (2 min cap)
  "verify": "node test/x.test.js",  // optional shell command; exit 0 = pass
  "protect": ["test/x.test.js"],    // optional; failing if the agent edits these
  "check": [                        // optional file-content assertions
    { "file": "src/x.js", "contains": "export function x" },
    { "file": "src/x.js", "notContains": "TODO" },
    { "file": "src/x.js", "matches": "return\\s+\\d+" },
    { "file": "test/x.test.js", "minCount": 3, "of": "assert" }
  ]
}
```

A task needs at least a `verify` or a `check`. Use `protect` for "fix the bug,
don't touch the tests" and for restraint tasks. When you add a task, confirm the
seed actually fails before the fix and passes after it, so the eval measures the
model rather than a broken fixture.

The grader helpers (`gradeChecks`, `compareToBaseline`) live in `grade.mjs` and
have unit tests in `grade.test.mjs` (`node eval/grade.test.mjs`).
