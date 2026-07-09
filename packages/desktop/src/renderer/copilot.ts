import { Prec, StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

const setSuggestion = StateEffect.define<{ text: string; pos: number } | null>();

const suggestionField = StateField.define<{ text: string; pos: number } | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setSuggestion)) return e.value;
    if (tr.docChanged || tr.selection) return null;
    return value;
  },
});

class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: GhostWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ghost";
    span.textContent = this.text;
    return span;
  }
}

const ghostDecorations = EditorView.decorations.compute([suggestionField], (state): DecorationSet => {
  const s = state.field(suggestionField);
  if (!s || !s.text) return Decoration.none;
  const pos = Math.min(s.pos, state.doc.length);
  return Decoration.set([Decoration.widget({ widget: new GhostWidget(s.text), side: 1 }).range(pos)]);
});

function acceptSuggestion(view: EditorView): boolean {
  const s = view.state.field(suggestionField);
  if (!s || !s.text) return false;
  view.dispatch({
    changes: { from: s.pos, insert: s.text },
    selection: { anchor: s.pos + s.text.length },
    effects: setSuggestion.of(null),
  });
  return true;
}

export function inlineCompletion(
  fetchCompletion: (prefix: string, suffix: string) => Promise<string>,
  enabled: { current: boolean },
): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | null = null;
      update(u: ViewUpdate) {
        if (!enabled.current || !u.docChanged) return;
        if (this.timer) clearTimeout(this.timer);
        const view = u.view;
        this.timer = setTimeout(() => {
          const state = view.state;
          const pos = state.selection.main.head;
          const prefix = state.doc.sliceString(Math.max(0, pos - 2000), pos);
          const suffix = state.doc.sliceString(pos, Math.min(state.doc.length, pos + 500));
          void fetchCompletion(prefix, suffix).then((text) => {
            if (text && view.state.selection.main.head === pos && !view.state.doc.sliceString(pos, pos + 1).trim()) {
              view.dispatch({ effects: setSuggestion.of({ text, pos }) });
            }
          });
        }, 700);
      }
      destroy() {
        if (this.timer) clearTimeout(this.timer);
      }
    },
  );

  const keys = Prec.highest(
    keymap.of([
      { key: "Tab", run: acceptSuggestion },
      {
        key: "Escape",
        run: (v) => {
          if (v.state.field(suggestionField)) {
            v.dispatch({ effects: setSuggestion.of(null) });
            return true;
          }
          return false;
        },
      },
    ]),
  );

  return [suggestionField, ghostDecorations, plugin, keys];
}
