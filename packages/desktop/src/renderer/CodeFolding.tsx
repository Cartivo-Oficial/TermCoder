import { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, Decoration, DecorationSet } from "@codemirror/view";
import { EditorState } from "@codemirror/state";

interface FoldedRegion {
  from: number;
  to: number;
  collapsed: boolean;
}

const codeFoldingPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    foldedRegions: Map<string, FoldedRegion> = new Map();

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: any) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const decorations: any[] = [];
      const text = view.state.doc.toString();
      const lines = text.split("\n");

      lines.forEach((line, index) => {
        const lineStart = view.state.doc.line(index + 1).from;
        
        // Detect foldable blocks (functions, classes, if statements, etc.)
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        
        if (openBraces > closeBraces) {
          // This line opens a block
          const regionId = `${index}-${openBraces}`;
          const existing = this.foldedRegions.get(regionId);
          
          if (existing?.collapsed) {
            // Add collapsed decoration
            decorations.push(
              Decoration.line({
                class: "cm-folded-line",
                attributes: { "data-folded": "true" }
              }).range(lineStart)
            );
          } else {
            // Add fold marker
            decorations.push(
              Decoration.widget({
                widget: new FoldWidget(index, () => this.toggleFold(view, regionId, index)),
              }).range(lineStart)
            );
          }
        }
      });

      return Decoration.set(decorations);
    }

    toggleFold(view: EditorView, regionId: string, lineIndex: number) {
      const existing = this.foldedRegions.get(regionId);
      
      if (existing) {
        this.foldedRegions.delete(regionId);
      } else {
        // Find matching closing brace
        const line = view.state.doc.line(lineIndex + 1);
        const text = view.state.doc.toString();
        let braceCount = 1;
        let closeIndex = lineIndex + 1;
        
        for (let i = lineIndex + 1; i < text.split("\n").length && braceCount > 0; i++) {
          const lineText = text.split("\n")[i];
          if (lineText) {
            braceCount += (lineText.match(/{/g) || []).length;
            braceCount -= (lineText.match(/}/g) || []).length;
          }
          
          if (braceCount === 0) {
            closeIndex = i;
            break;
          }
        }
        
        this.foldedRegions.set(regionId, {
          from: line.from,
          to: view.state.doc.line(closeIndex + 1).to,
          collapsed: true,
        });
      }
      
      this.decorations = this.buildDecorations(view);
    }
  },
  {
    decorations: (v: any) => v.decorations,
  }
);

class FoldWidget {
  constructor(
    private lineIndex: number,
    private onToggle: () => void
  ) {}

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-fold-marker";
    span.textContent = "▼";
    span.onclick = (e) => {
      e.preventDefault();
      this.onToggle();
    };
    return span;
  }

  ignoreEvent() {
    return false;
  }

  eq(other: any) {
    return other instanceof FoldWidget && other.lineIndex === this.lineIndex;
  }

  updateDOM() {
    return false;
  }

  estimatedHeight = 16;

  lineBreaks = 0;

  coordsAt(dom: any) {
    return null;
  }

  destroy() {
    // Cleanup if needed
  }
}

export function codeFolding(): Extension {
  return [codeFoldingPlugin];
}
