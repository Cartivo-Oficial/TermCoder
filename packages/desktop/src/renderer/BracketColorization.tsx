import { Extension } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";

interface BracketPair {
  open: string;
  close: string;
  color: string;
}

const bracketPairs: BracketPair[] = [
  { open: "(", close: ")", color: "#ff79c6" },
  { open: "[", close: "]", color: "#8be9fd" },
  { open: "{", close: "}", color: "#50fa7b" },
  { open: "<", close: ">", color: "#f1fa8c" },
];

function findMatchingBrackets(state: EditorState): DecorationSet {
  const decorations: any[] = [];
  const text = state.doc.toString();

  for (let i = 0; i < text.length; i++) {
    for (const pair of bracketPairs) {
      if (text[i] === pair.open) {
        const closeIndex = findMatchingClose(text, i, pair.open, pair.close);
        if (closeIndex !== -1) {
          decorations.push(
            Decoration.mark({ class: "bracket-open", attributes: { style: `color: ${pair.color}` } }).range(i, i + 1)
          );
          decorations.push(
            Decoration.mark({ class: "bracket-close", attributes: { style: `color: ${pair.color}` } }).range(closeIndex, closeIndex + 1)
          );
        }
      }
    }
  }

  return Decoration.set(decorations);
}

function findMatchingClose(text: string, openIndex: number, open: string, close: string): number {
  let depth = 1;
  for (let i = openIndex + 1; i < text.length; i++) {
    if (text[i] === open) depth++;
    if (text[i] === close) depth--;
    if (depth === 0) return i;
  }
  return -1;
}

const bracketColorizationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = findMatchingBrackets(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = findMatchingBrackets(update.state);
      }
    }
  },
  {
    decorations: (v: any) => v.decorations,
  }
);

export function bracketColorization(): Extension {
  return [bracketColorizationPlugin];
}
