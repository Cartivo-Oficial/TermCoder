import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Extension } from "@codemirror/state";

interface Palette {
  dark: boolean;
  bg: string;
  fg: string;
  caret: string;
  selection: string;
  gutter: string;
  activeLine: string;
  keyword: string;
  string: string;
  comment: string;
  func: string;
  number: string;
  type: string;
  prop: string;
}

function build(p: Palette): Extension {
  const theme = EditorView.theme(
    {
      "&": { color: p.fg, backgroundColor: p.bg },
      ".cm-content": { caretColor: p.caret },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: p.caret },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: p.selection,
      },
      ".cm-gutters": { backgroundColor: p.bg, color: p.gutter, border: "none" },
      ".cm-activeLine": { backgroundColor: p.activeLine },
      ".cm-activeLineGutter": { backgroundColor: p.activeLine, color: p.fg },
      ".cm-lineNumbers .cm-gutterElement": { color: p.gutter },
    },
    { dark: p.dark },
  );
  const highlight = HighlightStyle.define([
    { tag: t.keyword, color: p.keyword },
    { tag: [t.controlKeyword, t.moduleKeyword], color: p.keyword },
    { tag: [t.string, t.special(t.string)], color: p.string },
    { tag: [t.comment, t.lineComment, t.blockComment], color: p.comment, fontStyle: "italic" },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: p.func },
    { tag: [t.number, t.bool, t.null], color: p.number },
    { tag: [t.typeName, t.className, t.namespace], color: p.type },
    { tag: [t.propertyName, t.attributeName], color: p.prop },
    { tag: [t.definition(t.variableName), t.variableName], color: p.fg },
    { tag: [t.operator, t.punctuation, t.bracket], color: p.fg },
    { tag: [t.tagName], color: p.keyword },
    { tag: [t.meta], color: p.comment },
  ]);
  return [theme, syntaxHighlighting(highlight)];
}

const light = build({
  dark: false,
  bg: "#ffffff",
  fg: "#1f2328",
  caret: "#1f2328",
  selection: "#b3d4ff",
  gutter: "#8c959f",
  activeLine: "#f2f4f6",
  keyword: "#cf222e",
  string: "#0a3069",
  comment: "#6e7781",
  func: "#8250df",
  number: "#0550ae",
  type: "#953800",
  prop: "#0550ae",
});

const dracula = build({
  dark: true,
  bg: "#282a36",
  fg: "#f8f8f2",
  caret: "#f8f8f0",
  selection: "#44475a",
  gutter: "#6272a4",
  activeLine: "#31333f",
  keyword: "#ff79c6",
  string: "#f1fa8c",
  comment: "#6272a4",
  func: "#50fa7b",
  number: "#bd93f9",
  type: "#8be9fd",
  prop: "#66d9ef",
});

const github = build({
  dark: true,
  bg: "#0d1117",
  fg: "#e6edf3",
  caret: "#e6edf3",
  selection: "#264f78",
  gutter: "#6e7681",
  activeLine: "#161b22",
  keyword: "#ff7b72",
  string: "#a5d6ff",
  comment: "#8b949e",
  func: "#d2a8ff",
  number: "#79c0ff",
  type: "#ffa657",
  prop: "#79c0ff",
});

export const EDITOR_THEMES: Array<{ id: string; name: string; ext: Extension }> = [
  { id: "one-dark", name: "One Dark", ext: oneDark },
  { id: "github-dark", name: "GitHub Dark", ext: github },
  { id: "dracula", name: "Dracula", ext: dracula },
  { id: "light", name: "Light", ext: light },
];

export function editorTheme(id: string): Extension {
  return (EDITOR_THEMES.find((th) => th.id === id) ?? EDITOR_THEMES[0]!).ext;
}
