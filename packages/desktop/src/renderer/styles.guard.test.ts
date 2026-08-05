import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Selector prefixes not yet swept onto the scale. Each sweep task deletes its
// own entries; the final task empties the array and the guard then covers the
// whole file permanently.
const UNSWEPT: string[] = [
  ".xterm", ".term", ".deck",
  ".settings", ".set-", ".srow",
  ".side", ".recipe", ".classroom", ".model-", ".study",
  ".palette", ".preview", ".ide-", ".scm-", ".editor-", ".test-",
];

const SPACING = new Set([0, 2, 4, 6, 8, 12, 16, 24, 32, 48]);
const FONT_SIZES = new Set([11, 12, 13, 15, 18, 24, 32]);
const SHADOW_TOKENS = ["var(--sh-flat)", "var(--sh-raised)", "var(--sh-float)", "var(--sh-modal)", "none"];

// import.meta.url, not __dirname: these tests run as ESM, where __dirname does
// not exist and the guard would throw before asserting anything.
const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

// Walk the file line by line, tracking which selector block we are inside, so a
// violation can be attributed to a surface and skipped while that surface is
// still on the allowlist.
interface Line { n: number; text: string; selector: string }

function lines(): Line[] {
  const out: Line[] = [];
  let selector = "";
  css.split("\n").forEach((text, i) => {
    const open = text.indexOf("{");
    if (open > 0) selector = text.slice(0, open).trim();
    out.push({ n: i + 1, text, selector });
  });
  return out;
}

const unswept = (selector: string) => UNSWEPT.some((p) => selector.includes(p));
const exempt = (text: string) => /\/\*\s*off-scale:\s*\S+/.test(text);

describe("styles.css stays on the scale", () => {
  it("uses only spacing-scale values for padding, margin and gap", () => {
    const bad: string[] = [];
    for (const { n, text, selector } of lines()) {
      if (unswept(selector) || exempt(text)) continue;
      const decl = /^\s*(padding|margin|gap|row-gap|column-gap)[a-z-]*\s*:([^;]+);/.exec(text);
      if (!decl) continue;
      for (const px of decl[2]!.matchAll(/(\d+)px/g)) {
        const v = Number(px[1]);
        if (!SPACING.has(v)) bad.push(`${n}: ${selector} — ${v}px in ${decl[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("uses only type-scale font sizes", () => {
    const bad: string[] = [];
    for (const { n, text, selector } of lines()) {
      if (unswept(selector) || exempt(text)) continue;
      // Decimals and rem are caught too: `font-size: 12.5px` is exactly the kind
      // of value a scale exists to eliminate, and an integer-only pattern would
      // wave it through.
      const decl = /^\s*font-size\s*:\s*([\d.]+)(px|rem)/.exec(text);
      if (!decl) continue;
      const px = decl[2] === "rem" ? Number(decl[1]) * 16 : Number(decl[1]);
      if (!FONT_SIZES.has(px)) bad.push(`${n}: ${selector} — ${decl[1]}${decl[2]}`);
    }
    expect(bad).toEqual([]);
  });

  it("uses only the four shadow tokens", () => {
    const bad: string[] = [];
    for (const { n, text, selector } of lines()) {
      if (unswept(selector) || exempt(text)) continue;
      if (selector === ":root") continue; // the tokens are declared here
      const decl = /^\s*box-shadow\s*:([^;]+);/.exec(text);
      if (decl && !SHADOW_TOKENS.some((t) => decl[1]!.includes(t))) bad.push(`${n}: ${selector}`);
    }
    expect(bad).toEqual([]);
  });

  it("routes every focus outline through --ring", () => {
    const bad: string[] = [];
    for (const { n, text, selector } of lines()) {
      if (unswept(selector) || exempt(text)) continue;
      // `none` is NOT allowed. Every outline declaration in this file is
      // currently `outline: none`, so blessing it would let the guard pass
      // forever on an app with no visible focus anywhere. Killing the default
      // ring is legitimate only when the element defines its own :focus-visible
      // ring from --ring; anything else needs a written reason.
      const decl = /^\s*outline\s*:([^;]+);/.exec(text);
      if (decl && !decl[1]!.includes("var(--ring)")) bad.push(`${n}: ${selector} — ${decl[1]!.trim()}`);
    }
    expect(bad).toEqual([]);
  });
});
