# Provider marks — design

**Goal:** every provider on the site's provider grid shows its real mark, in colour, instead of a letter in a box.

## Why the grid is uneven today

`app/src/components/site/brand-icon.tsx` reads its art from `simple-icons`. That set carries seven of the twelve rows. The other five — OpenAI, Groq, xAI, Together, Cerebras — were **withdrawn from `simple-icons` at the trademark owners' request** and will not come back. The component falls back to a monogram rather than invent a mark, which was the right call and is why the grid looks half-finished.

So this is not a bug to fix in the component. It is a sourcing problem: the set we chose cannot cover our list.

## Decision on the withdrawn marks

The five withdrawn marks **will be shown**. The risk was raised and the call was made deliberately: these are registered marks whose owners asked an open catalogue to stop distributing them, and TermCoder is MIT and redistributed. Using a company's mark to identify that company's service is ordinarily nominative use, and every comparable site does it, but the risk is not zero and this record exists so the decision is not mistaken for an oversight later.

## Source

Vendor the path data from **`@lobehub/icons-static-svg` v1.94.0 (MIT)** — a set built for AI-provider brands. It covers all eleven providers on the same `0 0 24 24` grid the component already uses, and ships colour art for six of them.

Vendored, not installed: the paths are copied into our own file. This keeps the property the current file was written for — its comment explains that `simple-icons` ships 3,450 icons as one module, so only named imports are used — and it means no runtime dependency and no catalogue in the bundle.

MIT requires the copyright notice to travel with the copied work. The repository has no third-party notices file, so this project creates `THIRD-PARTY-NOTICES.md` at the root carrying LobeHub's notice.

`simple-icons` stays installed and untouched: the navigation still uses it for the GitHub mark.

## What "coloured" means per mark

Six providers have genuine multi-colour marks and use their colour art as published: **Google, Mistral, DeepSeek, OpenRouter, Together, Cerebras**.

Five are monochrome by their owners' own design — `@lobehub/icons-static-svg` ships them as `currentColor` with no colour variant at all: **Anthropic, OpenAI, Groq, xAI, Ollama**. For these, "coloured" cannot mean inventing a hex. All five render through **one** shared CSS custom property, which defaults to the site's foreground colour — not one property per brand. A brand that is a black mark renders as a black mark, which is the brand.

**The technical wrinkle this creates.** `BrandIcon` today takes a single `d` string and draws one `<path fill="currentColor">`. Colour art is not one path: it is several, each carrying its own `fill`. So `ProviderMark` stores each mark as a small record — a list of paths, each with an optional fill, plus whatever `fill-rule` or `clip-rule` the original art needs — and a mark with no fills on its paths inherits the shared property. One shape covers both kinds of mark; there is no branch between "coloured" and "monochrome" at render time.

The twelfth row, `termcoderfree`, keeps our own `Mark`. It is not a third-party provider.

## Two components, not one

`BrandIcon` has two callers with opposite needs: the provider grid wants colour, and `nav.tsx` wants the GitHub mark to follow the surrounding text colour. Teaching one component both jobs buys a conditional that nobody understands in six months.

- **`BrandIcon`** — unchanged. Monochrome, `currentColor`, `simple-icons`. Its only remaining caller is the GitHub link in `nav.tsx`.
- **`ProviderMark`** — new. Knows only how to draw a provider's mark at a given size, in colour. Owns the vendored path data. Falls back to the caller's node when a slug is unknown, exactly as `BrandIcon` does today.

Each answers "what does it do" in one sentence, and neither can break the other.

## Dark theme

OpenAI, xAI and Anthropic are near-black marks, so the theme matters to them more than to the six coloured ones.

**Correction, made after the work was verified in the browser: the site already has a dark theme.** This section originally claimed it did not — a wrong inference from grepping for `dark:` utility classes, when the theme is applied as `html.dark` and switches the whole palette. The design survives the correction unchanged, and in fact this is what makes it right: because the monochrome marks inherit their colour rather than carrying a hex, they flip on their own. Measured in the running site — dark: mark `rgb(242,239,235)` on tile `rgb(23,22,21)`; light: mark `rgb(26,26,25)` on tile `rgb(242,240,237)`. Legible both ways, with no per-theme rule written anywhere.

`--provider-mark` still earns its place: it is the one hook for overriding a mark's colour without touching path data.

## How it is verified

- **A test over the real list.** It walks the `PROVIDERS` array in `home.tsx` and fails if any slug resolves to no art. The current gap was invisible to every test and only showed up by looking at the page; after this, adding a thirteenth provider without a mark fails the suite.
- The GitHub mark in the navigation still follows text colour.
- The bundle gains no icon catalogue: the vendored paths are the only art added.
- The page is looked at, in the browser, at the real breakpoints — twelve marks, no monogram except `termcoderfree`'s own.

## Not in this project

- Any change to the copy, layout, or card design of the provider grid. Marks only.
- A dark theme for the site.
- Replacing `simple-icons` anywhere else.
- Marks for providers not already on the list.
