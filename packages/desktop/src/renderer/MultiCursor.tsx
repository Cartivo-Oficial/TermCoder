import { Extension, EditorSelection } from "@codemirror/state";
import { EditorView, keymap, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Prec } from "@codemirror/state";

interface MultiCursorState {
  cursors: Array<{ from: number; to: number }>;
}

const multiCursorPlugin = ViewPlugin.fromClass(
  class {
    state: MultiCursorState;

    constructor(view: EditorView) {
      this.state = {
        cursors: [],
      };
    }

    update(update: ViewUpdate) {
      // Update cursor positions on selection changes
      if (update.selectionSet) {
        const selections = update.state.selection.ranges;
        if (selections.length > 1) {
          this.state.cursors = selections.map((sel) => ({
            from: sel.from,
            to: sel.to,
          }));
        } else {
          this.state.cursors = [];
        }
      }
    }

    addCursor(view: EditorView, pos: number) {
      const currentSelection = view.state.selection.main;
      view.dispatch({
        selection: {
          anchor: pos,
          head: pos,
        },
      });
    }

    removeLastCursor(view: EditorView) {
      if (this.state.cursors.length > 1) {
        const lastCursor = this.state.cursors[this.state.cursors.length - 1];
        if (lastCursor) {
          view.dispatch({
            selection: {
              anchor: lastCursor.from,
              head: lastCursor.to,
            },
          });
          this.state.cursors = this.state.cursors.slice(0, -1);
        }
      }
    }

    clearCursors(view: EditorView) {
      view.dispatch({
        selection: {
          anchor: view.state.selection.main.from,
          head: view.state.selection.main.from,
        },
      });
      this.state.cursors = [];
    }
  },
  {}
);

const multiCursorKeymap = keymap.of([
  {
    key: "Alt-Click",
    run: (view: EditorView) => {
      const pos = view.posAtCoords({ x: 0, y: 0 }) || 0;
      const plugin = view.plugin(multiCursorPlugin);
      if (plugin) {
        plugin.addCursor(view, pos);
      }
      return true;
    },
  },
  {
    key: "Ctrl-Alt-Down",
    run: (view: EditorView) => {
      const currentSelection = view.state.selection.main;
      const line = view.state.doc.line(currentSelection.to);
      const nextLine = view.state.doc.line(line.number + 1);
      
      if (nextLine) {
        const offset = currentSelection.to - line.from;
        const newPos = Math.min(nextLine.from + offset, nextLine.to);
        
        const newRanges = [
          ...view.state.selection.ranges,
          EditorSelection.range(newPos, newPos),
        ];
        view.dispatch({
          selection: EditorSelection.create(newRanges),
        });
      }
      return true;
    },
  },
  {
    key: "Ctrl-Alt-Up",
    run: (view: EditorView) => {
      const currentSelection = view.state.selection.main;
      const line = view.state.doc.line(currentSelection.to);
      const prevLine = view.state.doc.line(line.number - 1);
      
      if (prevLine) {
        const offset = currentSelection.to - line.from;
        const newPos = Math.min(prevLine.from + offset, prevLine.to);
        
        const newRanges = [
          ...view.state.selection.ranges,
          EditorSelection.range(newPos, newPos),
        ];
        view.dispatch({
          selection: EditorSelection.create(newRanges),
        });
      }
      return true;
    },
  },
  {
    key: "Escape",
    run: (view: EditorView) => {
      const plugin = view.plugin(multiCursorPlugin);
      if (plugin && plugin.state.cursors.length > 0) {
        plugin.clearCursors(view);
        return true;
      }
      return false;
    },
  },
]);

export function multiCursor(): Extension {
  return [Prec.highest(multiCursorKeymap), multiCursorPlugin];
}
