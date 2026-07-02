# Example skills

Ready-to-use [skills](../../configuration.md#skills) — reusable playbooks the agent
loads on demand. Only each skill's name + description sit in the prompt; the full body
loads via the `skill` tool when a task matches, so a whole library costs almost nothing
until used.

| Skill | Use it for |
| --- | --- |
| [commit-message](./commit-message.md) | A clean Conventional-Commits message for the staged diff. |
| [pr-review](./pr-review.md) | A severity-grouped review of the current branch. |
| [add-tests](./add-tests.md) | Focused unit tests that match the project's existing style. |

## Install

Copy the ones you want into your project (or global) skills folder:

```bash
# project-local (this repo only)
mkdir -p .termcoder/skills
cp docs/examples/skills/pr-review.md .termcoder/skills/

# or global (every project)
mkdir -p ~/.config/termcoder/skills
cp docs/examples/skills/*.md ~/.config/termcoder/skills/
```

They show up immediately — `/skills` in the TUI, the **Skills** tab in the desktop app,
and the agent can pull one in whenever a request matches. Edit the markdown to fit your
team's conventions, or use them as a template for your own.
