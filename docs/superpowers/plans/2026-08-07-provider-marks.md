# Provider Marks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every row of the site's provider grid shows that provider's real mark, in colour, instead of a letter in a box.

**Architecture:** The art is vendored — a generator reads `@lobehub/icons-static-svg` from a temporary `npm pack` and emits one TypeScript file of path data, which is committed. Nothing new is installed. A new `ProviderMark` component draws that data; the existing `BrandIcon` is left alone for the monochrome GitHub mark in the navigation. The provider list moves out of the page into its own module so a test can walk the real list and fail when a provider has no mark.

**Tech Stack:** React 19, Vite, TypeScript, vitest (from the repository root, `environment: "node"`), Tailwind.

## Global Constraints

- **The five withdrawn marks are shown.** OpenAI, Groq, xAI, Together and Cerebras were removed from `simple-icons` at the trademark owners' request. Showing them is a deliberate decision recorded in the spec, not an oversight to re-litigate.
- **Nothing is added to `package.json`.** The art is vendored as path data. `@lobehub/icons-static-svg` is fetched once by the generator and never becomes a dependency.
- **`simple-icons` stays.** `nav.tsx` uses it for the GitHub mark. Do not remove it, and do not change `brand-icon.tsx`.
- **No layout, copy or card changes.** Marks only. The provider grid's markup, classes, text and order stay exactly as they are.
- **`viewBox` is `0 0 24 24`** for every mark, the grid `brand-icon.tsx` already uses.
- **The five monochrome brands share one custom property**, `--provider-mark`, falling back to the inherited colour. Not one property per brand, and no invented hex values.
- Vitest runs from the repository root and covers `app/src/**/*.{test,spec}.{ts,tsx}` with `environment: "node"` — **there is no DOM**. Tests assert over data, not rendered output.
- The `@` alias resolves to `app/src`.
- Conventional Commits, lowercase scope. End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## File Structure

**Created**

| path | responsibility |
| --- | --- |
| `app/vendor-provider-marks.mjs` | the generator; run by hand, kept so the vendoring can be repeated or refreshed. Sits beside `prerender.mjs`, the existing app-level script. |
| `app/src/components/site/provider-marks.ts` | generated path data for the eleven providers. Committed. Never hand-edited. |
| `app/src/components/site/provider-mark.tsx` | draws one provider mark. Knows nothing else. |
| `app/src/components/site/providers.ts` | the provider list, moved out of `home.tsx` so a node test can import it without pulling in a page component |
| `app/src/components/site/provider-mark.test.ts` | the art is well-formed, and every provider on the page has art |
| `THIRD-PARTY-NOTICES.md` | LobeHub's MIT notice, which the licence requires to travel with the copied path data |

**Modified**

| path | change |
| --- | --- |
| `app/src/pages/home.tsx` | imports `PROVIDERS` from its new module; the grid draws `ProviderMark` instead of `BrandIcon` |

**Deliberately untouched:** `app/src/components/site/brand-icon.tsx`, `app/src/components/site/nav.tsx`, `package.json`.

---

## Task 1: Vendor the art

**Files:**
- Create: `app/vendor-provider-marks.mjs`
- Create: `app/src/components/site/provider-marks.ts` (by running the generator)
- Create: `THIRD-PARTY-NOTICES.md`
- Test: `app/src/components/site/provider-mark.test.ts`

**Interfaces:**
- Produces: `PROVIDER_MARKS: Record<string, MarkPath[]>` and `interface MarkPath { d: string; fill?: string; fillRule?: string; clipRule?: string }`, both exported from `app/src/components/site/provider-marks.ts`. Task 2 renders them. A path with no `fill` inherits the caller's colour.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/site/provider-mark.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PROVIDER_MARKS } from "./provider-marks";

const EXPECTED = [
  "anthropic", "openai", "google", "groq", "mistral", "deepseek",
  "xai", "openrouter", "together", "cerebras", "ollama",
];

describe("the vendored provider art", () => {
  it("carries every provider we list", () => {
    expect(Object.keys(PROVIDER_MARKS).sort()).toEqual([...EXPECTED].sort());
  });

  it("gives every path a d", () => {
    const bad = Object.entries(PROVIDER_MARKS)
      .flatMap(([slug, paths]) => paths.map((p, i) => ({ slug, i, d: p.d })))
      .filter((p) => !p.d || p.d.length < 8)
      .map((p) => `${p.slug}[${p.i}]`);
    expect(bad).toEqual([]);
  });

  it("leaves the monochrome brands without a fill, so they inherit colour", () => {
    // These five ship as currentColor in the source set: their owners' marks
    // are monochrome by design. A hex here would be one we invented.
    for (const slug of ["anthropic", "openai", "groq", "xai", "ollama"]) {
      const fills = PROVIDER_MARKS[slug]!.map((p) => p.fill).filter(Boolean);
      expect(fills, slug).toEqual([]);
    }
  });

  it("keeps the real brand colours on the marks that have them", () => {
    expect(PROVIDER_MARKS.google!.map((p) => p.fill)).toEqual([
      "#4285F4", "#34A853", "#FBBC05", "#EB4335",
    ]);
    expect(PROVIDER_MARKS.deepseek![0]!.fill).toBe("#4D6BFE");
    expect(PROVIDER_MARKS.openrouter![0]!.fill).toBe("#C8FF00");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run app/src/components/site/provider-mark.test.ts
```

Expected: FAIL — `Failed to resolve import "./provider-marks"`.

- [ ] **Step 3: Write the generator**

Create `app/vendor-provider-marks.mjs`:

```js
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Reads @lobehub/icons-static-svg's SVGs and emits one TypeScript file of path
// data. Run by hand — see the header of the file it writes. The package is
// never installed; see docs/superpowers/plans/2026-08-07-provider-marks.md.
const SRC = process.argv[2];
const OUT = process.argv[3];

// [our slug, their file]. The -color files are the six marks that are genuinely
// multi-colour; the rest are monochrome by their owners' design and ship as
// currentColor, with no -color variant in the set at all.
const MARKS = [
  ["anthropic", "anthropic"],
  ["openai", "openai"],
  ["google", "google-color"],
  ["groq", "groq"],
  ["mistral", "mistral-color"],
  ["deepseek", "deepseek-color"],
  ["xai", "xai"],
  ["openrouter", "openrouter-color"],
  ["together", "together-color"],
  ["cerebras", "cerebras-color"],
  ["ollama", "ollama"],
];

const attr = (s, name) => {
  const m = new RegExp(`${name}="([^"]*)"`).exec(s);
  return m ? m[1] : undefined;
};

const out = [];
for (const [slug, file] of MARKS) {
  const svg = readFileSync(join(SRC, `${file}.svg`), "utf8");
  // fill-rule and clip-rule sit on the root <svg> in several of these and must
  // be carried down, or evenodd shapes fill solid.
  const root = svg.slice(0, svg.indexOf(">") + 1);
  const rootFillRule = attr(root, "fill-rule");
  const rootClipRule = attr(root, "clip-rule");
  const paths = [...svg.matchAll(/<path\b([^>]*)\/?>/g)].map((m) => m[1]);
  if (!paths.length) throw new Error(`${file}: no paths`);
  const rec = paths.map((p) => {
    const d = attr(p, "d");
    if (!d) throw new Error(`${file}: path without d`);
    const fill = attr(p, "fill");
    const fillRule = attr(p, "fill-rule") ?? rootFillRule;
    const clipRule = attr(p, "clip-rule") ?? rootClipRule;
    const parts = [`d: ${JSON.stringify(d)}`];
    if (fill && fill !== "currentColor") parts.push(`fill: ${JSON.stringify(fill)}`);
    if (fillRule) parts.push(`fillRule: ${JSON.stringify(fillRule)}`);
    if (clipRule) parts.push(`clipRule: ${JSON.stringify(clipRule)}`);
    return `    { ${parts.join(", ")} },`;
  });
  out.push(`  ${slug}: [\n${rec.join("\n")}\n  ],`);
}

writeFileSync(
  OUT,
  `// Generated by app/vendor-provider-marks.mjs. Do not hand-edit.
//
// Path data vendored from @lobehub/icons-static-svg v1.94.0 (MIT). The notice
// that licence requires lives in THIRD-PARTY-NOTICES.md at the repository root.
//
// Vendored rather than installed for the same reason brand-icon.tsx names its
// imports one by one: an icon package ships a whole catalogue, and none of it
// belongs in this bundle.
//
// A path with no \`fill\` inherits the mark's colour from the caller. That is how
// the five brands that are monochrome by their owners' own design — anthropic,
// openai, groq, xai, ollama — render, and why there is no branch here between
// "coloured" and "monochrome".

export interface MarkPath {
  d: string;
  fill?: string;
  fillRule?: string;
  clipRule?: string;
}

export const PROVIDER_MARKS: Record<string, MarkPath[]> = {
${out.join("\n")}
};
`,
  "utf8",
);
console.log(`wrote ${OUT}`);
```

- [ ] **Step 4: Fetch the source set and generate**

Run from the repository root. The tarball goes to a temporary directory and is not committed:

```bash
mkdir -p .tmp-icons && cd .tmp-icons && npm pack @lobehub/icons-static-svg@1.94.0 --silent >/dev/null && tar -xzf lobehub-icons-static-svg-1.94.0.tgz && cd .. && node app/vendor-provider-marks.mjs .tmp-icons/package/icons app/src/components/site/provider-marks.ts && rm -rf .tmp-icons
```

Expected: `wrote app/src/components/site/provider-marks.ts`, roughly 11.5 KB.

- [ ] **Step 5: Run the test and watch it pass**

```bash
npx vitest run app/src/components/site/provider-mark.test.ts
```

Expected: PASS, 4 tests.

If the fourth test fails on a colour, do **not** edit the generated file. The upstream art changed; pin the version you actually fetched and update the expected hexes in the test to match the new art.

- [ ] **Step 6: Write the notice**

Create `THIRD-PARTY-NOTICES.md` at the repository root:

```markdown
# Third-party notices

TermCoder is MIT licensed. It also carries material from the projects below,
whose notices are reproduced as their licences require.

## @lobehub/icons-static-svg

The provider marks in `app/src/components/site/provider-marks.ts` are path data
vendored from `@lobehub/icons-static-svg` v1.94.0.

    MIT License

    Copyright (c) LobeHub <i@lobehub.com>
    https://github.com/lobehub/lobe-icons

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

The marks themselves are the trademarks of their respective owners and are used
to identify those companies' services.
```

- [ ] **Step 7: Confirm nothing was installed**

```bash
git status --porcelain package.json app/package.json pnpm-lock.yaml
```

Expected: no output. If any of those three appear, the package was installed by mistake — revert them.

- [ ] **Step 8: Commit**

```bash
git add app/vendor-provider-marks.mjs app/src/components/site/provider-marks.ts app/src/components/site/provider-mark.test.ts THIRD-PARTY-NOTICES.md
git commit -m "feat(site): vendor the provider marks

simple-icons carries seven of our twelve rows. The other five were
withdrawn at the trademark owners' request and will not return, so the
grid could never be even from that source. The art now comes from
@lobehub/icons-static-svg, copied in rather than installed, with the
notice its licence requires.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Draw the marks on the page

**Files:**
- Create: `app/src/components/site/providers.ts`
- Create: `app/src/components/site/provider-mark.tsx`
- Modify: `app/src/pages/home.tsx:18-35` (the `PROVIDERS` const moves out) and `app/src/pages/home.tsx:182-193` (the grid's icon)
- Test: `app/src/components/site/provider-mark.test.ts` (append)

**Interfaces:**
- Consumes: `PROVIDER_MARKS` and `MarkPath` from `./provider-marks`.
- Produces: `PROVIDERS: [string, string, string, string][]` from `app/src/components/site/providers.ts`, the tuple being `[name, slug, mono label, one line]`; and `ProviderMark({ slug, size?, className?, fallback? })` from `app/src/components/site/provider-mark.tsx`.

- [ ] **Step 1: Write the failing test**

In `app/src/components/site/provider-mark.test.ts`, add the import beside the existing ones at the top of the file — not at the bottom next to the new block, where oxlint will flag it:

```ts
import { PROVIDERS } from "./providers";
```

Then append the block:

```ts
describe("the provider grid", () => {
  it("has a mark for every provider it lists", () => {
    // termcoderfree is ours, not a third party: the page draws its own Mark.
    const missing = PROVIDERS
      .map(([, slug]) => slug)
      .filter((slug) => slug !== "termcoderfree")
      .filter((slug) => !PROVIDER_MARKS[slug]);
    expect(missing).toEqual([]);
  });

  it("still lists twelve rows", () => {
    expect(PROVIDERS).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run app/src/components/site/provider-mark.test.ts
```

Expected: FAIL — `Failed to resolve import "./providers"`.

- [ ] **Step 3: Move the provider list into its own module**

Create `app/src/components/site/providers.ts` with the array exactly as it stands in `home.tsx` today, only exported and re-commented:

```ts
// [name, slug, mono label, one line]. The marks live in provider-marks.ts;
// provider-mark.test.ts fails if a row here has no art, which is how the grid
// stops silently falling back to a monogram again.
export const PROVIDERS: [string, string, string, string][] = [
  ["Anthropic", "anthropic", "sonnet · haiku", "Claude through your own key, on the tier you pay for."],
  ["OpenAI", "openai", "gpt-4o · 4o-mini", "The models most tooling assumes, straight from your account."],
  ["Google", "google", "gemini-2.5 pro · flash", "Pro for the hard turns, Flash for everything else."],
  ["Groq", "groq", "llama · fast", "Open models answered quickly enough to feel local."],
  ["Mistral", "mistral", "large · codestral", "Codestral is built for the completion half of the job."],
  ["DeepSeek", "deepseek", "chat · coder", "A budget-priced reasoning and coding pair, hosted for you."],
  ["xAI", "xai", "grok", "Grok, if that is the key you already hold."],
  ["OpenRouter", "openrouter", "anything", "One key in front of nearly every model on the market."],
  ["Together", "together", "open models", "Open weights, hosted, without you renting a GPU."],
  ["Cerebras", "cerebras", "very fast", "Open models served on custom inference silicon, not GPUs."],
  ["Ollama", "ollama", "local · private", "Whatever you have pulled. Nothing leaves the machine."],
  ["termcoderfree", "termcoderfree", "free · no key", "Pick termcoder/auto and you are on it. No card, no account, no key."],
];
```

Then in `app/src/pages/home.tsx`, delete the comment on lines 18-21 and the `const PROVIDERS` block on lines 22-35, and add to the imports:

```tsx
import { PROVIDERS } from "@/components/site/providers";
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run app/src/components/site/provider-mark.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the component**

Create `app/src/components/site/provider-mark.tsx`:

```tsx
import { PROVIDER_MARKS } from "./provider-marks";

// Separate from BrandIcon on purpose. BrandIcon draws a monochrome mark that
// follows the surrounding text colour, which is what the GitHub link in the
// navigation wants. This one draws a provider's real mark in its own colours.
// One component doing both jobs would be one conditional nobody can read later.
//
// The five monochrome brands have no fill on their paths, so they take the
// colour from `--provider-mark`, which falls back to whatever colour is
// inherited. A dark theme would set that property once, here, and be done.
export function ProviderMark({
  slug, size = 20, className, fallback = null,
}: { slug: string; size?: number; className?: string; fallback?: React.ReactNode }) {
  const paths = PROVIDER_MARKS[slug];
  if (!paths) return fallback;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ color: "var(--provider-mark, currentColor)" }}
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill ?? "currentColor"}
          fillRule={p.fillRule as "evenodd" | "nonzero" | undefined}
          clipRule={p.clipRule as "evenodd" | "nonzero" | undefined}
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 6: Draw it on the page**

In `app/src/pages/home.tsx`, replace the `BrandIcon` in the provider grid (lines 184-192) with `ProviderMark`, keeping the surrounding `IconTile` and the `termcoderfree` fallback exactly as they are:

```tsx
                    <ProviderMark
                      slug={slug}
                      size={15}
                      fallback={
                        slug === "termcoderfree"
                          ? <Mark size={14} />
                          : <span className="font-mono text-[12px] leading-none">{name.slice(0, 1).toUpperCase()}</span>
                      }
                    />
```

Add the import, and remove the now-unused `BrandIcon` import from this file only — `nav.tsx` still uses it:

```tsx
import { ProviderMark } from "@/components/site/provider-mark";
```

- [ ] **Step 7: Typecheck, lint, build**

```bash
cd app && npx tsc -b --force && npx oxlint && npx vite build
```

Expected: no type errors, no lint errors, a successful build. `tsc` will fail if the unused `BrandIcon` import was left behind.

- [ ] **Step 8: Run the whole app suite**

```bash
npx vitest run app/src
```

Expected: PASS. `gist.test.ts` and `theme.test.ts` must still pass — they are untouched by this work, and a failure there means something unrelated broke.

- [ ] **Step 9: Look at it**

```bash
cd app && npx vite dev
```

Open the provider grid and check, at a wide and a narrow breakpoint:
- Twelve marks. The only monogram left is `termcoderfree`'s own `Mark`.
- Google, Mistral, DeepSeek, OpenRouter, Together and Cerebras are in their brand colours.
- Anthropic, OpenAI, Groq, xAI and Ollama are legible on the card's background.
- The marks are optically the same size as each other in the 8×8 tile — some brands draw to the edge of the 24×24 box and some do not, so if one looks oversized next to its neighbours, say so in the report rather than fixing it by eye; it is a `size` decision for the whole grid, not a per-mark patch.
- The GitHub mark in the top navigation is unchanged and still follows the text colour.

- [ ] **Step 10: Commit**

```bash
git add app/src/components/site/providers.ts app/src/components/site/provider-mark.tsx app/src/components/site/provider-mark.test.ts app/src/pages/home.tsx
git commit -m "feat(site): the provider grid shows real marks

Twelve rows, twelve marks. The list moved out of the page so a test can
walk it and fail when a provider arrives without art — the gap this
fixes was invisible to every test and only showed up by looking.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Not in this plan

- Any change to the provider grid's copy, layout, card design or order.
- A dark theme for the site. `--provider-mark` exists so that day is one declaration; setting it is not this work.
- Replacing `simple-icons`, or touching `brand-icon.tsx` or `nav.tsx`.
- Marks for providers not already on the list.
- The desktop app. It has its own provider UI, and it is not part of this project.
