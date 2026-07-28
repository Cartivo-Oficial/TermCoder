import { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from "@codemirror/view";
import { EditorState } from "@codemirror/state";

interface MinimapLine {
  text: string;
  height: number;
}

const minimapPlugin = ViewPlugin.fromClass(
  class {
    minimapElement: HTMLElement;
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.minimapElement = document.createElement("div");
      this.minimapElement.className = "cm-minimap";
      this.updateMinimap(view);
      this.decorations = Decoration.set([]);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.updateMinimap(update.view);
      }
    }

    updateMinimap(view: EditorView) {
      const text = view.state.doc.toString();
      const lines = text.split("\n");
      
      this.minimapElement.innerHTML = "";
      
      lines.forEach((line, index) => {
        const lineElement = document.createElement("div");
        lineElement.className = "cm-minimap-line";
        lineElement.textContent = line;
        lineElement.style.height = "3px";
        lineElement.style.fontSize = "2px";
        lineElement.style.lineHeight = "3px";
        lineElement.style.overflow = "hidden";
        lineElement.style.whiteSpace = "nowrap";
        this.minimapElement.appendChild(lineElement);
      });

      const scrollContainer = view.dom.querySelector(".cm-scroller");
      if (scrollContainer) {
        scrollContainer.appendChild(this.minimapElement);
      }
    }

    destroy() {
      this.minimapElement.remove();
    }
  },
  {
    decorations: (v: any) => v.decorations,
  }
);

export function minimap(): Extension {
  return [minimapPlugin];
}
