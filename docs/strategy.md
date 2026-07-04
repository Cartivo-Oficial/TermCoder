# TermCoder — Strategy

_Last updated: 2026-07-04. A living doc: positioning, funding, and how mega updates are shaped._

## 1. Positioning — the moat

TermCoder is not "another AI coding agent." It is **the free, learning-first coding agent**:

- **Free with no API key.** Rivals (Cursor, Copilot, Claude Code, OpenCode, Cody) need a subscription or a key. We start working on the first keystroke.
- **A tutor is built in.** TermExplorer turns the same tool into a patient study assistant. No rival has this.
- **Classrooms.** Teachers share packs and assignments; students join with a link — all over GitHub, nothing to host. No coding agent does this.

Everything we build should deepen that moat: **free**, **learning**, **classrooms**. When a feature also exists in a rival, it must be _more accessible_ here (free, local, no lock-in). When it's something a rival can't easily copy (study, classrooms), lean in — that's where we win.

One line: **the AI coding agent that's free, teaches you, and works for a whole classroom.**

## 2. Money — community + grants (no paid tiers, no infra)

The growth engine is being free for students. We do **not** tax that. We raise money in ways that **cost nothing to serve** and never require fronting an inference bill.

**Guardrails (non-negotiable):**
- **Never pay the GPU/API bill ourselves.** Fundraising comes _before_ any hosted infra — not after.
- **Don't monetize the keyless free tier.** It runs on Pollinations (a third party). It isn't ours, it can vanish, and reselling someone's free service is fragile and likely against their terms.
- **Keep the whole tool free and open.** No feature paywall for now.

**Sources (all zero-infra):**
- **GitHub Sponsors** — a `.github/FUNDING.yml` + a short sponsor page; tiers are recognition, not features.
- **Open Collective** — transparent, community-friendly; good for a student-run OSS project.
- **Grants & credit programs** — the real lever: OSS/education grants, edtech grants, hackathon prizes, and cloud/AI **credit** programs (they hand out inference credits, which is exactly what we'd otherwise pay for). The study + classroom story is a strong grant narrative — see the reinforcement below.

**How product and money reinforce each other:** the education/learning moat _is_ the grant and sponsor pitch. Every improvement to study mode and classrooms strengthens a grant application and gives sponsors a reason (helping students learn to code for free). So deepening the moat and raising money are the same motion.

## 3. How mega updates are shaped

A mega update is **not one change.** It is a **themed bundle of 4–6 shipped-together features**, released as one event, with:

- **A headline** — one sentence a user (and a rival-watcher) remembers.
- **A per-feature "why it beats X" line** — each feature names the rival it out-does and how (usually: we do it free / local / for learners).

We ship the bundle together, announce it as a set, and only then start the next. Small, one-off improvements still ship continuously — but they aren't called mega updates.

## 4. Roadmap — the next bundles

Each is its own spec → plan → build cycle, but shipped and announced as one mega update.

### Bundle A — "Ele te conhece" (smarter & yours)
_Headline: TermCoder now learns your project and your style._
- **Memory** (done, v0.7.0) — remembers your project + preferences across sessions. _Beats Copilot: persistent, shared-via-git project memory, not a per-chat window._
- **Retrieval** for large repos — bring the _right_ code into context. _Beats the small free model's blind spots._
- **Subscription login (Claude)** — bring a Pro/Max brain (spec ready, experimental). _Optional power for those who already pay._
- **Better git/run tools** — dedicated git + parsed test failures.
- **Smart `/init`** — bootstraps the project's first memories automatically.

### Bundle B — "Estudo sério" (the moat + the grant story)
_Headline: the only coding tool that also gets you through school._
- **Photo / PDF of notes → summary + flashcards** (multimodal ingest).
- **Quiz / exam mode** with scoring.
- **Progress dashboard** — streaks, per-subject stats.
- **Teacher dashboard** for classrooms — see who submitted, at a glance.
- _Every item here doubles as grant/sponsor evidence: "we help students learn, free."_

### Bundle C — "Sem atrito" (frictionless adoption)
_Headline: installs clean, updates itself — a friend onboards in one click._
- **Code-signed installers** — kill the "Windows protected your PC" / Gatekeeper scare. (Highest-leverage single fix for word-of-mouth growth.)
- **Desktop auto-update.**
- **Reliable free study generation** — fix the free-tier 500s on flashcard JSON.
- **Desktop panels** for packs / classrooms / connect (backends already exist).

**Ongoing (not a bundle):** GitHub Sponsors + Open Collective live; apply to grant/credit programs each cycle.

## 5. Sequencing

1. Ship **Bundle A** (memory already landed; add the rest), announce as one mega update.
2. Stand up the **funding basics** (FUNDING.yml + a Support page) — a one-hour, zero-cost win, do it anytime.
3. **Bundle B** next — it deepens the moat _and_ builds the grant narrative.
4. **Bundle C** — frictionless installs to convert the growing word-of-mouth.

Fast-follows and small fixes ship continuously between bundles.
