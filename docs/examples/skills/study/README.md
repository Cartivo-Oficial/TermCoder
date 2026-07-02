# Study skills (for termexplorer)

Ready-to-use [skills](../../../configuration.md#skills) for the
[termexplorer](../../../termexplorer.md) study assistant. They're optional —
termexplorer already summarizes, explains and makes study aids on its own — but skills let
you trigger a precise, consistent format every time.

| Skill | Use it for |
| --- | --- |
| [flashcards](./flashcards.md) | Turn notes or a topic into Q→A study cards. |
| [study-plan](./study-plan.md) | A realistic day-by-day revision schedule for an exam. |
| [practice-quiz](./practice-quiz.md) | A self-test quiz with an answer key. |

## Install

Copy them into your global skills folder so they're available in every project:

```bash
mkdir -p ~/.config/termcoder/skills
cp docs/examples/skills/study/*.md ~/.config/termcoder/skills/
```

Then pick the **termexplorer** model and just ask — e.g. "make flashcards from these
notes" — and it'll use the matching skill.
