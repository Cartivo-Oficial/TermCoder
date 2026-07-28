import { useState, useRef, useEffect } from "react";
import { useI18n } from "./i18n";
import { IconX, IconCopy, IconPlus } from "./Icons";

export interface CodeSelection {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  code: string;
  language: string;
}

interface CodeContextProps {
  selections: CodeSelection[];
  onAddSelection: (selection: CodeSelection) => void;
  onRemoveSelection: (id: string) => void;
  onClearAll: () => void;
  onInsertToChat: (text: string) => void;
}

export function CodeContext({
  selections,
  onAddSelection,
  onRemoveSelection,
  onClearAll,
  onInsertToChat,
}: CodeContextProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const handleInsert = (selection: CodeSelection) => {
    const contextText = `@${selection.filePath}:${selection.startLine}-${selection.endLine}\n\`\`\`${selection.language}\n${selection.code}\n\`\`\``;
    onInsertToChat(contextText);
  };

  return (
    <div className="code-context">
      <div
        className="code-context-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="code-context-title">
          <span className="code-context-icon">🎯</span>
          <span>Code Context</span>
          <span className="code-context-count">{selections.length}</span>
        </div>
        <div className="code-context-actions">
          {selections.length > 0 && (
            <button
              className="code-context-btn"
              title="Clear all"
              onClick={(e) => {
                e.stopPropagation();
                onClearAll();
              }}
            >
              <IconX />
            </button>
          )}
          <span className="code-context-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>
      {expanded && (
        <div className="code-context-body">
          {selections.length === 0 ? (
            <div className="code-context-empty">
              <p>Select code in the editor to add context</p>
              <p className="muted">Use Ctrl+Shift+C to add selection</p>
            </div>
          ) : (
            <div className="code-context-list">
              {selections.map((selection) => (
                <div key={selection.id} className="code-context-item">
                  <div className="code-context-item-header">
                    <span className="code-context-file">
                      {selection.filePath}
                    </span>
                    <span className="code-context-lines">
                      Lines {selection.startLine}-{selection.endLine}
                    </span>
                    <button
                      className="code-context-item-btn"
                      title="Remove"
                      onClick={() => onRemoveSelection(selection.id)}
                    >
                      <IconX />
                    </button>
                  </div>
                  <pre className="code-context-code">
                    <code>{selection.code}</code>
                  </pre>
                  <div className="code-context-item-actions">
                    <button
                      className="code-context-action-btn"
                      onClick={() => handleInsert(selection)}
                    >
                      <IconPlus />
                      Insert to Chat
                    </button>
                    <button
                      className="code-context-action-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(selection.code);
                      }}
                    >
                      <IconCopy />
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook to manage code selections from editor
export function useCodeSelection() {
  const [selections, setSelections] = useState<CodeSelection[]>([]);

  const addSelection = (selection: Omit<CodeSelection, "id">) => {
    const id = `${selection.filePath}-${selection.startLine}-${Date.now()}`;
    setSelections((prev) => [...prev, { ...selection, id }]);
  };

  const removeSelection = (id: string) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
  };

  const clearAll = () => {
    setSelections([]);
  };

  return {
    selections,
    addSelection,
    removeSelection,
    clearAll,
  };
}
