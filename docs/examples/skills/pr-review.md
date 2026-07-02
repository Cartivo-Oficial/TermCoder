---
name: pr-review
description: Review the current branch's changes for bugs, edge cases, and style
---
Review the changes on the current branch as a careful senior engineer.

1. Get the diff: `git diff main...HEAD` (fall back to `git diff` if there's no
   `main`). Read every changed file's surrounding context, not just the hunks.
2. For each change, check in this order:
   - **Correctness** — off-by-one, null/undefined, error handling, async races,
     resource leaks, and edge cases the change forgot.
   - **Security** — injection, path traversal, secrets in code, unsafe input.
   - **Fit** — does it match the file's existing patterns, naming, and style?
   - **Tests** — is the new behavior covered? Note gaps.
3. Report findings grouped by severity (Blocking / Should-fix / Nit). For each,
   give `file:line`, one sentence on the problem, and a concrete fix.
4. If you find nothing substantive, say so plainly — don't invent nitpicks.
