import { Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";

export interface Definition {
  filePath: string;
  line: number;
  character: number;
  name: string;
}

export interface Reference {
  filePath: string;
  line: number;
  character: number;
  name: string;
}

interface GoToDefinitionOptions {
  onGoToDefinition: (position: { line: number; character: number }) => Promise<Definition | null>;
  onFindReferences: (position: { line: number; character: number }) => Promise<Reference[]>;
  onNavigateTo: (filePath: string, line: number, character: number) => void;
}

export function goToDefinition({
  onGoToDefinition,
  onFindReferences,
  onNavigateTo,
}: GoToDefinitionOptions): Extension {
  const goToDefinitionKeymap = keymap.of([
    {
      key: "F12",
      run: (view: EditorView) => {
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        const character = pos - line.from;

        void onGoToDefinition({ line: line.number, character }).then((definition) => {
          if (definition) {
            onNavigateTo(definition.filePath, definition.line, definition.character);
          }
        });
        return true;
      },
    },
    {
      key: "Shift-F12",
      run: (view: EditorView) => {
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        const character = pos - line.from;

        void onFindReferences({ line: line.number, character }).then((references) => {
          console.log("References:", references);
        });
        return true;
      },
    },
  ]);

  const goToDefinitionClick = EditorView.domEventHandlers({
    mousedown: (event, view) => {
      if (!event.ctrlKey && !event.metaKey) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const line = view.state.doc.lineAt(pos);
      const character = pos - line.from;

      void onGoToDefinition({ line: line.number, character }).then((definition) => {
        if (definition) {
          onNavigateTo(definition.filePath, definition.line, definition.character);
        }
      });
      return true;
    },
  });

  return [Prec.highest(goToDefinitionKeymap), goToDefinitionClick];
}

// Hook to manage go to definition state
export function useGoToDefinition() {
  const goToDefinition = async (position: { line: number; character: number }): Promise<Definition | null> => {
    // In real implementation, this would use LSP to find definition
    console.log("Go to definition:", position);
    return null;
  };

  const findReferences = async (position: { line: number; character: number }): Promise<Reference[]> => {
    // In real implementation, this would use LSP to find references
    console.log("Find references:", position);
    return [];
  };

  const navigateTo = (filePath: string, line: number, character: number) => {
    // In real implementation, this would navigate to the location
    console.log("Navigate to:", filePath, line, character);
  };

  return {
    goToDefinition,
    findReferences,
    navigateTo,
  };
}
