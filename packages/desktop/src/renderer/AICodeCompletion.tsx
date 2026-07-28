import { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, Decoration, DecorationSet } from "@codemirror/view";
import { EditorState } from "@codemirror/state";

interface CompletionSuggestion {
  text: string;
  position: number;
}

const aiCodeCompletionPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    currentSuggestion: CompletionSuggestion | null = null;
    suggestionWidget: HTMLElement | null = null;

    constructor(view: EditorView) {
      this.decorations = Decoration.set([]);
    }

    update(update: any) {
      if (update.docChanged || update.selectionSet) {
        this.handleCompletion(update.view);
      }
    }

    async handleCompletion(view: EditorView) {
      const pos = view.state.selection.main.head;
      const line = view.state.doc.lineAt(pos);
      const textBeforeCursor = line.text.slice(0, pos - line.from);

      // Trigger completion after typing a space or after a short delay
      if (textBeforeCursor.length > 2) {
        const suggestion = await this.getSuggestion(textBeforeCursor);
        if (suggestion) {
          this.currentSuggestion = {
            text: suggestion,
            position: pos,
          };
          this.showSuggestion(view, suggestion, pos);
        } else {
          this.hideSuggestion();
        }
      } else {
        this.hideSuggestion();
      }
    }

    async getSuggestion(context: string): Promise<string | null> {
      // In real implementation, this would call the AI backend
      // For now, return a simple suggestion based on context
      const suggestions: Record<string, string> = {
        "function": "() {\n  \n}",
        "const": " = ",
        "if": " (condition) {\n  \n}",
        "for": " (let i = 0; i < length; i++) {\n  \n}",
        "class": " {\n  constructor() {\n    \n  }\n}",
        "import": " from ",
        "export": " default ",
      };

      for (const [prefix, suggestion] of Object.entries(suggestions)) {
        if (context.endsWith(prefix)) {
          return suggestion;
        }
      }

      return null;
    }

    showSuggestion(view: EditorView, suggestion: string, pos: number) {
      this.hideSuggestion();

      const widget = document.createElement("div");
      widget.className = "ai-completion-widget";
      widget.textContent = suggestion;

      const coords = view.coordsAtPos(pos);
      if (coords) {
        widget.style.position = "absolute";
        widget.style.left = `${coords.left}px`;
        widget.style.top = `${coords.bottom + 4}px`;
        widget.style.zIndex = "1000";
      }

      view.dom.appendChild(widget);
      this.suggestionWidget = widget;

      // Add click handler to accept suggestion
      widget.addEventListener("click", () => {
        this.acceptSuggestion(view);
      });
    }

    hideSuggestion() {
      if (this.suggestionWidget) {
        this.suggestionWidget.remove();
        this.suggestionWidget = null;
      }
      this.currentSuggestion = null;
    }

    acceptSuggestion(view: EditorView) {
      if (this.currentSuggestion) {
        view.dispatch({
          changes: {
            from: this.currentSuggestion.position,
            to: this.currentSuggestion.position,
            insert: this.currentSuggestion.text,
          },
        });
        this.hideSuggestion();
      }
    }

    destroy() {
      this.hideSuggestion();
    }
  },
  {
    decorations: (v: any) => v.decorations,
  }
);

export function aiCodeCompletion(): Extension {
  return [aiCodeCompletionPlugin];
}

// Hook to manage AI code completion state
export function useAICodeCompletion() {
  const getSuggestion = async (context: string): Promise<string | null> => {
    // In real implementation, this would call the AI backend
    console.log("Get AI completion for:", context);
    return null;
  };

  const acceptSuggestion = (suggestion: string) => {
    // In real implementation, this would apply the suggestion
    console.log("Accept suggestion:", suggestion);
  };

  const dismissSuggestion = () => {
    // In real implementation, this would dismiss the current suggestion
    console.log("Dismiss suggestion");
  };

  return {
    getSuggestion,
    acceptSuggestion,
    dismissSuggestion,
  };
}
