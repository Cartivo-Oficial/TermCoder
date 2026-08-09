import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The surfaces still off the scale. This is no longer a sweep-in-progress
// list: the finish pass swept Home, the composer and chat, the rail and
// sessions, the terminal, Settings and the side panels, and the canvas rebuild
// swept the run graph's node card (`.agent-node` and everything under it).
// What follows is the honest register of what was NOT done — 261 selectors
// the guard would otherwise fail on, listed exactly rather than by prefix so
// that a loose substring cannot silently un-guard swept work.
//
// To resume: delete a family from this list, sweep it onto the scale, and the
// guard tells you the moment you miss one. Roughly, by size: room 27,
// search 20, file tree 17, git 15, inline editor 14, chip 13,
// task runner 11, debugger 11, quick open 10, canvas inspector 10.
const UNSWEPT: string[] = [
  ".side-actions", ".side-head-row", ".side-head-title", ".model-item", ".model-list", ".palette",
  ".preview", ".ide-", ".scm-", ".editor-", ".test-", ".advanced-search-caret",
  ".advanced-search-header", ".agent-canvas-scroll", ".agent-canvas-tools", ".agent-form", ".agent-inspector", ".agent-inspector-metrics",
  ".agent-inspector-reasoning", ".agent-ro",
  ".agent-tool-copy", ".agent-tool-name", ".agent-tool-out", ".badge", ".bc-seg", ".breadcrumb-separator",
  ".call-dot", ".ch-title-edit", ".chip", ".chip-sm", ".cm-fold-marker", ".code-context-action-btn",
  ".code-context-caret", ".code-context-code", ".code-context-header", ".code-context-icon", ".code-context-item-actions", ".code-context-item-header",
  ".connector-card", ".connector-desc", ".connector-grid", ".connector-meta", ".crash-actions", ".crash-card",
  ".crash-msg", ".crash-title", ".ctx-badge", ".ctx-item", ".ctx-menu", ".ctx-shortcut",
  ".dash-chip", ".dash-mix", ".dash-stat", ".dashboard", ".debugger-bp-toggle", ".debugger-btn",
  ".debugger-caret", ".debugger-header", ".debugger-item", ".debugger-modal-content", ".debugger-status", ".debugger-watch-input",
  ".diff-base-badge", ".dirty-dot", ".dirty-tiny", ".explorer-foot", ".extension-btn", ".extension-version",
  ".extensions-caret", ".extensions-count", ".extensions-header", ".extensions-icon", ".extensions-search-input", ".eyebrow",
  ".file-card", ".file-card-header", ".file-card-icon", ".file-edit-area", ".file-emoji", ".file-preview-header",
  ".file-watcher-item", ".file-watcher-status", ".file-watchers-alert-time", ".file-watchers-badge", ".file-watchers-btn", ".file-watchers-caret",
  ".file-watchers-header", ".file-watchers-icon", ".file-watchers-input", ".folder-children", ".git-branch", ".git-branch-badge",
  ".git-branch-current", ".git-branch-input", ".git-branch-remote", ".git-btn", ".git-caret", ".git-commit",
  ".git-commit-hash", ".git-commit-input", ".git-header", ".git-icon", ".git-stash", ".git-stash-id",
  ".glass", ".goto-actions", ".goto-input-row", ".goto-modal", ".graph-branch-badge", ".graph-caret",
  ".graph-commit-hash", ".graph-header", ".graph-icon", ".hint", ".home", ".home-headline",
  ".home-recent", ".home-sess", ".home-sess-meta", ".home-sess-name", ".home-sess-when", ".home-stage",
  ".iac", ".iac-short", ".iac-title", ".img-strip", ".inline-ai-chat", ".inline-ai-chat-context-label",
  ".inline-ai-chat-header", ".inline-ai-chat-input", ".inline-ai-chat-quick-action", ".inline-ai-chat-response", ".inline-ai-chat-shortcut", ".inline-editor",
  ".kbd", ".kbd-btn", ".menu", ".menu-sep", ".mode-desc", ".mode-seg",
  ".mode-switch-wrap", ".output-log", ".output-wrap", ".perm-actions", ".perm-card", ".perm-detail",
  ".pro-actions", ".pro-badge", ".pro-err", ".pro-line", ".pro-status", ".prob-empty",
  ".prob-item", ".prob-summary", ".prob-where", ".problem-item", ".problem-severity", ".problem-source",
  ".problems-caret", ".problems-header", ".problems-icon", ".provider-key", ".quick-open-box", ".quick-open-hint",
  ".quick-open-input-row", ".quick-open-item", ".refactoring-btn", ".refactoring-caret", ".refactoring-header", ".refactoring-icon",
  ".refactoring-item", ".refactoring-item-icon", ".refactoring-item-location", ".refactoring-preview-content", ".refactoring-quick-icon", ".review-strip",
  ".review-strip-actions", ".review-strip-head", ".room-chip", ".room-control-bar", ".room-count", ".room-ctrl",
  ".room-head-right", ".room-invite-more", ".room-link", ".room-msg", ".room-name-edit", ".room-rail",
  ".room-share-btn", ".room-stage", ".room-stage-wrap", ".room-tag", ".room-tile", ".room-tile-name",
  ".room-view-body", ".room-view-head", ".sb-item", ".sb-sep", ".search-empty", ".search-glob-input",
  ".search-input", ".search-inputs", ".search-match", ".search-match-location", ".search-match-replace", ".search-replace-btn",
  ".search-result-header", ".search-row", ".search-row-sm", ".search-status", ".search-toggle-replace", ".search-toggles",
  ".seg", ".shortcuts", ".slider-val", ".sn-group", ".snippet-item", ".snippet-language",
  ".snippets-btn", ".snippets-caret", ".snippets-header", ".snippets-icon", ".snippets-input", ".snippets-search-input",
  ".snippets-select", ".snippets-textarea", ".sp-line", ".sp-row", ".spark", ".split-pane-header",
  ".sr-file-head", ".sr-hit", ".stepper", ".sub", ".suggest-chip", ".swatch",
  ".swatches", ".task-execution", ".task-execution-status", ".task-executions-header", ".task-icon", ".task-item",
  ".task-runner-btn", ".task-runner-caret", ".task-runner-header", ".task-runner-input", ".task-runner-running", ".task-runner-select",
  ".tb-right", ".theme-swatch", ".titlebar", ".toggle", ".tree-empty", ".tree-rename-input",
  ".tree-row", ".update-later", ".update-text", ".update-toast", ".viewer-body", ".viewer-card",
  ".vtab",
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
// A keyframe step is an animation frame, not a surface. Animating between two
// elevation tokens is not expressible, so `0%` and `50%` are not held to them.
const keyframeStep = (selector: string) => /^(from|to|-?[\d.]+%)/.test(selector);

describe("styles.css stays on the scale", () => {
  it("uses only spacing-scale values for padding, margin and gap", () => {
    const bad: string[] = [];
    for (const { n, text, selector, prop, value } of decls()) {
      if (unswept(selector) || keyframeStep(selector) || exempt(text)) continue;
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
      if (unswept(selector) || keyframeStep(selector) || exempt(text)) continue;
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
      if (unswept(selector) || keyframeStep(selector) || exempt(text)) continue;
      if (selector === ":root") continue; // the tokens are declared here
      if (prop !== "box-shadow") continue;
      if (!SHADOW_TOKENS.some((t) => value.includes(t))) bad.push(`${n}: ${selector}`);
    }
    expect(bad).toEqual([]);
  });

  it("routes every focus outline through --ring", () => {
    const bad: string[] = [];
    for (const { n, text, selector, prop, value } of decls()) {
      if (unswept(selector) || keyframeStep(selector) || exempt(text)) continue;
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
