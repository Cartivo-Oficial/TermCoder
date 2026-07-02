---
name: commit-message
description: Write a clear, conventional commit message for the staged changes
---
Write a commit message for the currently staged changes.

1. Run `git diff --staged` to see exactly what changed. If nothing is staged,
   say so and stop.
2. Summarize the change in a single imperative subject line (≤ 60 chars),
   prefixed with a Conventional Commits type: `feat`, `fix`, `refactor`,
   `docs`, `test`, `chore`, `perf`, or `build`. Add a scope in parentheses when
   one file/area dominates, e.g. `fix(parser): …`.
3. Leave a blank line, then a short body (2–4 bullet points) explaining *why*
   the change was made and any notable trade-offs. Skip the body for trivial
   changes.
4. Output only the final message in a fenced block — do not commit unless asked.
