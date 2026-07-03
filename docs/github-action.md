# GitHub Action

Run termcoder in CI to answer issues and review pull requests. Mention the trigger
phrase in a comment and the agent investigates the checked-out repo and replies as a
comment — optionally editing files and pushing a commit.

## Quick start

Add a repo secret for at least one provider (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or
`GEMINI_API_KEY`), then a workflow:

```yaml
# .github/workflows/termcoder.yml
name: termcoder
on:
  issue_comment:
    types: [created]
permissions:
  contents: write
  issues: write
  pull-requests: write
jobs:
  termcoder:
    if: >
      contains(github.event.comment.body, '/termcoder') &&
      contains(fromJson('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: Cartivo-Oficial/TermCoder@main          # or a pinned tag
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          model: termcoder/auto
          apply: "false"
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Now comment `/termcoder why does the parser drop trailing commas?` on any issue or PR and
it replies. This repo ships exactly this workflow at
[`.github/workflows/termcoder.yml`](../.github/workflows/termcoder.yml).

## Inputs

| Input | Default | Purpose |
| --- | --- | --- |
| `github-token` | — (required) | Token to post comments and, when applying, push commits. Use `${{ secrets.GITHUB_TOKEN }}`. |
| `model` | `termcoder/auto` | Model id. `termcoder/auto` routes to whichever provider key is configured. |
| `trigger` | `/termcoder` | Phrase that activates the bot in a comment or issue body. |
| `apply` | `false` | When `true`, the agent may edit files and push a commit to the branch. |
| `task` | `""` | An explicit task; overrides the comment/issue body when set. |

Provider keys are read from the job environment (`ANTHROPIC_API_KEY`, etc.), so pass them
as `env:` from your secrets. Local models (Ollama) aren't available on GitHub's runners.

## Read-only vs. applying

- **Default (`apply: false`)** — runs the read-only `plan` agent: it inspects and answers
  but cannot touch files. Safe for public repos and untrusted comments.
- **`apply: true`** — runs the `build` agent with auto-approval, then commits and pushes
  any changes it made (as `termcoder[bot]`). Grant `contents: write` and gate carefully —
  the `author_association` check in the example restricts it to collaborators.

## How it works

The action ([`action.yml`](../action.yml)) builds `@termcoder/core`, then runs
[`.github/scripts/termcoder-action.mjs`](../.github/scripts/termcoder-action.mjs):

1. Read the event payload (`$GITHUB_EVENT_PATH`) and extract the task after the trigger.
2. Create a headless `Session` in the checked-out repo (see the [SDK guide](./sdk.md)).
3. Stream the turn and collect the assistant's text.
4. Post it back via the GitHub REST API; if `apply` and files changed, commit and push.

Because it's just the headless core, its behavior matches the TUI and desktop app exactly.
