# Website Redesign — Design

**Status:** awaiting user approval
**Date:** 2026-07-09
**Scope:** `website/` only. The Welcome-screen redesign in the desktop app is a separate spec.

## Goal

The site has two failures. It is **untrue** — it never mentions memory, retrieval, subscription login, or the embedded terminal, and it advertises a CLI version two releases behind. And it is **derivative** — it was built to look like OpenCode, which is the one story that cannot differentiate TermCoder from OpenCode.

Fix both: a site that says what the product actually does, in a visual identity built from TermCoder's own brand instead of a rival's.

## Decisions locked in brainstorming

- **Own identity, not OpenCode-clean.** Built from the real brand: the diamond-of-dashes mark and the ember accent `#FF7A45`. Still restrained, still mono-forward, still no emoji.
- **Developer-first home.** The hero speaks to developers; study is a supporting section with its own page.
  - *Recorded tension:* `docs/strategy.md` names education as the moat and the growth engine. A dev-first home deliberately subordinates that. The user chose this knowingly. If conversion from students matters more later, the home is the first thing to revisit.
- **Hero = proof, not promise.** A terminal frame replaying a *real* TermCoder session, the brand mark above it, a headline leading with the one claim no rival can make (runs with no API key), and a real screenshot of the 0.8.0 desktop app below.
- **No build step.** Static HTML + one shared `style.css`, deployed from `website/` via GitHub Pages. No framework, no bundler, no hosted infra.
- **Version truth.** npm `@termcoder/core`/`@termcoder/tui` are published at 0.8.0 before the new copy ships, so the CLI and desktop tell the same story.

## 1. Information architecture

Pages stay as they are — the nav is already right. What changes is what each one says.

| Page | Job |
|---|---|
| `index.html` | Convince a developer in one screen. Hero → proof → what it does → the two install paths → study (brief) → support. |
| `features.html` | The full capability list, honestly scoped. |
| `study.html` | TermExplorer: the study tutor. The moat, given its own room. |
| `install.html` | Guided install, both paths, prerequisites stated. |
| `download.html` | OS-detected installer cards. |
| `docs.html` | Reference. Sidebar + scroll-spy. |
| `viewer.html` | Shared-session viewer. Unchanged. |

## 2. Visual system

A single `style.css` owns every token and component. `index.html`, `download.html`, and `docs.html` currently duplicate the whole sheet inline — that duplication is deleted, not extended.

- **Palette.** Ink `#0B0B0C`, panel `#0F0F11`, hairline `#232327`, text `#E7E7EA`, muted `#9A9AA3`, faint `#5C5C64`, ember `#FF7A45`. Ember is used for *one* thing per screen — the thing you should look at. It is not a decoration.
- **Type.** Mono for structure (eyebrows, nav, code, chips, labels); sans for prose. Headline sizes tighten with `clamp()` and negative tracking, as today.
- **The mark.** The diamond replaces the current `.brand .mk` glyph in the nav, and anchors the hero. It ships as an SVG (traced once from `packages/desktop/build/icon-source.png`) so it stays crisp at 18px in the nav and 96px in the hero. It is rendered in `currentColor`.
  - *Known constraint:* the mark's dashes are thin. Below ~24px it reads as a radial burst, not as individual strokes. That is acceptable and intentional at nav size; do not attempt to add detail there.
- **Motion.** Only the hero terminal types. Everything else is static. Respect `prefers-reduced-motion` by rendering the completed transcript immediately.
- **No emoji anywhere.** (`study.html` and the desktop Welcome currently use them; the site's are removed here.)

## 3. The hero

Three stacked elements, centered, above the fold:

1. The brand mark (~88px, ember, soft glow).
2. Headline: leads with the keyless claim. Sub: one sentence, what it is and that a study mode is built in.
3. A terminal frame that types out a **real, recorded** TermCoder session — a prompt, a tool call, a diff, a result. The transcript is a literal capture of a real run, stored as a plain JS array of lines in the page. It must not depict behavior the product does not have.

Immediately below the fold, a real screenshot of the desktop app (Command Deck, Terminal tab visible), captured with the Playwright `_electron` driver already used in this repo, committed as a static asset.

The two install paths (npm one-liner, desktop download) sit between the hero and the screenshot, because that is the moment intent is highest.

## 4. Content truth

The site must state these, because they are true and currently absent:

- **Runs with no API key.** Via a keyless community-hosted free model. State the caveats in the same breath: rate-limited at peak, and prompts go to a third party. Ollama is the private, unlimited upgrade. Do not sell the free tier as if it were ours.
- **Bring your own model** — Anthropic, OpenAI, Google, Ollama, and more.
- **Subscription login** — use an existing Claude Pro/Max or ChatGPT Plus/Pro plan. **Label it experimental**, because it is.
- **Memory and retrieval** — the agent remembers, and searches the codebase.
- **Embedded terminal** — a real shell inside the desktop app, with one-click launch for the coding CLIs on your PATH.
- **Autonomous mode** — it iterates against a verify command until it passes.
- **Study (TermExplorer)** — spaced-repetition flashcards, quizzes, progress streaks.

The site must **not**:
- Claim `termcoder/auto` is a trained model. It is a router plus a prompt layer. Say "routes to the best model for the task."
- Use the word "free" as the headline value proposition (per the existing brand rule); say "no API key, no account."
- Show a version number that is not what the links actually deliver.

## 5. Assets

| Asset | Origin |
|---|---|
| `website/mark.svg` | Traced once from `packages/desktop/build/icon-source.png`, `currentColor`, no background. |
| `website/app.png` | Playwright `_electron` screenshot of the built desktop app, Terminal tab visible. |
| `website/favicon.png`, `logo.png` | Existing. Unchanged. |

## 6. Non-goals

- No CSS framework, no JS framework, no build step.
- No analytics, no tracking, no cookie banner (nothing to consent to).
- No pricing page. There is no paid tier, per `docs/strategy.md`.
- Not touching `viewer.html` behavior.
- Not redesigning the desktop Welcome screen — separate spec.

## 7. Verification

- Every page renders with `style.css` alone; no page carries an inline `<style>` block.
- Every download link resolves: `curl -sI -L` returns 200/206 for all six installer assets.
- Every version string on the site matches what npm and GitHub Releases actually serve.
- No emoji in any `website/*.html`.
- Keyboard focus is visible on every interactive element; the site is legible at 320px wide.
- `prefers-reduced-motion: reduce` renders the hero transcript complete, without typing.
