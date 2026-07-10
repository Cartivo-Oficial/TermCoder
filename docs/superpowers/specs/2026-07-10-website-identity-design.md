# Website Visual Identity — Design

**Status:** awaiting approval
**Date:** 2026-07-10
**Supersedes:** the visual half of `2026-07-09-website-redesign-design.md`. That spec's content decisions (what the site says) shipped and stand. Its visual decision — "keep it restrained" — produced a page that still reads as OpenCode with better copy. This spec replaces it.

## What went wrong last time

The user asked for an identity of TermCoder's own. The plan I wrote changed the hero, added a proof section, fixed the copy, and unified the CSS. It never touched the grid, the type scale, the colour system, or the page's rhythm — the four things that actually make a site look like someone. The result was a well-executed plan for the wrong goal.

So this spec defines the **system** first. No page may be written until the system exists and is visible in isolation.

## The idea

**The site is an editor, not a brochure.** Not a picture of a terminal — the structure of one. TermCoder's whole promise is that it lives where you work, so the page should be organised the way a source file is: a numbered gutter down the left, hairline rules where a file would have them, monospaced structure and proportional prose, one accent that means "this is the thing that runs".

This is *terminal-first* without being *terminal-cosplay*. OpenCode centres everything in a 1000px column and lets the type do nothing. We do the opposite: an asymmetric grid anchored to a gutter, a display face with real personality, and a second colour that only ever means "output".

## 1. Grid

- A **left gutter rail**, 72px on desktop, holding the section index (`01`, `02`, …) in the display face, set in `--faint`. It is sticky within its section, the way a line number stays beside its line.
- Content sits in a **12-column grid, max 1180px**, with the gutter outside it. Body prose caps at 62ch; code and terminal blocks may run to the full 12 columns.
- **Asymmetry is the rule.** A section is either left-anchored (text at columns 1–7) or right-anchored (columns 6–12). Nothing is centred except the hero mark. This alone kills the OpenCode read.
- Below 900px the gutter collapses to a 2px ember hairline and the index moves inline above the heading. Below 600px, single column.

## 2. Type

Two faces, self-hosted as `woff2` in `website/fonts/` (no build step, no CDN, no external request — the CSP-free static site stays a static site):

- **Display / structure:** a pixel-grid monospace, echoing the app's blocky ASCII wordmark. Headlines, the gutter index, eyebrows, nav, chips, code.
- **Prose:** a neutral grotesk. Body copy only.

Scale is a fifth (1.5), not the default 1.25, so headlines actually shout:
`12 / 14 / 16 / 21 / 32 / 48 / 72`. Display sizes get `-0.03em` tracking; the pixel face gets `0`.

Both faces ship with `font-display: swap` and a system fallback stack, so a cold load never blocks on a font.

## 3. Colour

The palette gains one axis. Today everything is ink + ember, which reads as "tasteful dark site". A terminal has two states: what you typed, and what came back.

| Token | Value | Means |
|---|---|---|
| `--ink` | `#0A0A0B` | page |
| `--panel` | `#0E0E10` | raised |
| `--rule` | `#1E1E22` | hairline |
| `--text` | `#E8E8EB` | prose |
| `--muted` | `#8E8E97` | secondary |
| `--faint` | `#55555E` | gutter index, captions |
| `--ember` | `#FF7A45` | **input.** the prompt, the accent, the one CTA per screen |
| `--signal` | `#5FD3A0` | **output.** passing tests, `✓` tool lines, "it worked" |

`--signal` is new and rationed: it never decorates. It appears only where the product succeeded — the `✓` in the hero transcript, `all tests passed`, a green status dot. That single rule gives every page a second, earned colour.

## 4. Signature devices

Three, and only three. A site with one device looks thin; a site with six looks like a template.

1. **The numbered gutter.** Every section is a numbered line.
2. **The recorded session.** Already built and shipping — the hero types a real capture. It stays, restyled onto the new type and the `--signal` green for `✓`.
3. **The brand mark as a rule terminator.** The diamond, at 10px in `--faint`, closes each section the way a glyph closes a block. Not a logo sprinkled around — a punctuation mark.

## 5. Motion

Unchanged in spirit: only the hero types. Section reveals are a 120ms opacity fade on scroll, nothing translating. `prefers-reduced-motion: reduce` disables the typing and the fades, and renders the transcript complete. No parallax, ever.

## 6. What this is not

- Not centred. Not a 1000px column with headings in the middle.
- No gradients, no glassmorphism, no blur, no drop shadows on cards. Depth comes from hairlines and the gutter, as in an editor.
- No emoji. No stock illustration. No abstract 3D render.
- No pricing page, no analytics, no cookie banner, no build step, no framework. Unchanged.

## 7. Scope and order

The system ships before the pages, and is proved before it is applied:

1. `website/style.css` — tokens, fonts, grid primitives, `.gutter`, type scale.
2. A **specimen page**, `website/_specimen.html`, rendering every token, both faces at every size, the grid at 1180 / 900 / 600 / 320, and both accents in context. It is not linked from the nav. It exists so the system can be judged before a single marketing sentence is written, and so the verifier can regression-test the system.
3. Then, one page at a time, re-laid onto the grid: `index`, `features`, `study`, `install`, `download`, `docs`. `viewer` keeps its tool chrome.

`website/tools/verify.mjs` grows two checks: no page may be centred (`text-align: center` on a section), and no page may load a font from a remote origin.

## 8. Verification

- The specimen renders identically at 1180 / 900 / 600 / 320 with zero horizontal scroll (measured, `scrollWidth - clientWidth === 0`, as in the last sweep).
- Fonts resolve from `website/fonts/` — zero requests to any other origin (assert by counting requests in the Electron harness).
- `--signal` appears in the rendered DOM only inside a success context. Grep the built pages.
- Contrast: `--text` on `--ink` ≥ 12:1; `--muted` ≥ 5:1; `--faint` ≥ 3:1 (it is never body copy).
- The existing verifier stays green: no inline `<style>`, no emoji, no pinned version, no "free" heading, subscription labelled experimental.
