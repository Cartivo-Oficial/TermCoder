import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Selector prefixes not yet swept onto the scale. Each sweep task deletes its
// own entries; the final task empties the array and the guard then covers the
// whole file permanently.
const UNSWEPT: string[] = [
  ".side", ".recipe", ".classroom", ".model-", ".study",
  ".palette", ".preview", ".ide-", ".scm-", ".editor-", ".test-",
];

const SPACING = new Set([0, 2, 4, 6, 8, 12, 16, 24, 32, 48]);
const FONT_SIZES = new Set([11, 12, 13, 15, 18, 24, 32]);
const SHADOW_TOKENS = ["var(--sh-flat)", "var(--sh-raised)", "var(--sh-float)", "var(--sh-modal)", "none"];

// import.meta.url, not __dirname: these tests run as ESM, where __dirname does
// not exist and the guard would throw before asserting anything.
const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

// Walk the file declaration by declaration, tracking which selector block we are
// inside, so a violation can be attributed to a surface and skipped while that
// surface is still on the allowlist.
//
// Per declaration, not per line: most rules in this file are written on a single
// line, so anchoring the property patterns to the start of a line made the guard
// blind to every declaration after the first. It read 128 violations while 267
// more sat past the first semicolon of a one-line rule.
interface Decl { n: number; text: string; selector: string; prop: string; value: string }

function decls(): Decl[] {
  const out: Decl[] = [];
  let selector = "";
  css.split("\n").forEach((text, i) => {
    const open = text.indexOf("{");
    if (open > 0) selector = text.slice(0, open).trim();
    for (const m of text.matchAll(/(?:^|[{;])\s*([a-z-]+)\s*:\s*([^;{}]*)/g)) {
      out.push({ n: i + 1, text, selector, prop: m[1]!, value: m[2]! });
    }
  });
  return out;
}

const unswept = (selector: string) => UNSWEPT.some((p) => selector.includes(p));
const exempt = (text: string) => /\/\*\s*off-scale:\s*\S+/.test(text);

describe("styles.css stays on the scale", () => {
  it("uses only spacing-scale values for padding, margin and gap", () => {
    const bad: string[] = [];
    for (const { n, text, selector, prop, value } of decls()) {
      if (unswept(selector) || exempt(text)) continue;
      if (!/^(padding|margin|gap|row-gap|column-gap)/.test(prop)) continue;
      for (const px of value.matchAll(/(\d+)px/g)) {
        const v = Number(px[1]);
        if (!SPACING.has(v)) bad.push(`${n}: ${selector} — ${v}px in ${prop}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("uses only type-scale font sizes", () => {
    const bad: string[] = [];
    for (const { n, text, selector, prop, value } of decls()) {
      if (unswept(selector) || exempt(text)) continue;
      if (prop !== "font-size") continue;
      // Decimals and rem are caught too: `font-size: 12.5px` is exactly the kind
      // of value a scale exists to eliminate, and an integer-only pattern would
      // wave it through.
      const decl = /^\s*([\d.]+)(px|rem)/.exec(value);
      if (!decl) continue;
      const px = decl[2] === "rem" ? Number(decl[1]) * 16 : Number(decl[1]);
      if (!FONT_SIZES.has(px)) bad.push(`${n}: ${selector} — ${decl[1]}${decl[2]}`);
    }
    expect(bad).toEqual([]);
  });

  it("uses only the four shadow tokens", () => {
    const bad: string[] = [];
    for (const { n, text, selector, prop, value } of decls()) {
      if (unswept(selector) || exempt(text)) continue;
      if (selector === ":root") continue; // the tokens are declared here
      if (prop !== "box-shadow") continue;
      if (!SHADOW_TOKENS.some((t) => value.includes(t))) bad.push(`${n}: ${selector}`);
    }
    expect(bad).toEqual([]);
  });

  it("routes every focus outline through --ring", () => {
    const bad: string[] = [];
    for (const { n, text, selector, prop, value } of decls()) {
      if (unswept(selector) || exempt(text)) continue;
      // `none` is NOT allowed. Every outline declaration in this file is
      // currently `outline: none`, so blessing it would let the guard pass
      // forever on an app with no visible focus anywhere. Killing the default
      // ring is legitimate only when the element defines its own :focus-visible
      // ring from --ring; anything else needs a written reason.
      if (prop !== "outline") continue;
      if (!value.includes("var(--ring)")) bad.push(`${n}: ${selector} — ${value.trim()}`);
    }
    expect(bad).toEqual([]);
  });
});
