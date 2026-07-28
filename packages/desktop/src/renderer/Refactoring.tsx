import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconEdit,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconPlus,
} from "./Icons";

export interface RefactoringOperation {
  id: string;
  type: "extract_function" | "rename" | "inline" | "extract_variable";
  name: string;
  filePath: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  newName?: string;
  preview?: string;
}

interface RefactoringPanelProps {
  operations: RefactoringOperation[];
  onApplyRefactoring: (operation: RefactoringOperation) => Promise<void>;
  onDiscardRefactoring: (id: string) => void;
  onPreviewRefactoring: (operation: RefactoringOperation) => Promise<string>;
  onExtractFunction: (filePath: string, startLine: number, endLine: number, functionName: string) => void;
  onRename: (filePath: string, line: number, character: number, newName: string) => void;
  onExtractVariable: (filePath: string, line: number, character: number, variableName: string) => void;
  currentFile?: string;
}

export function RefactoringPanel({
  operations,
  onApplyRefactoring,
  onDiscardRefactoring,
  onPreviewRefactoring,
  onExtractFunction,
  onRename,
  onExtractVariable,
  currentFile,
}: RefactoringPanelProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<RefactoringOperation | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handlePreview = async (operation: RefactoringOperation) => {
    setSelectedOperation(operation);
    const previewText = await onPreviewRefactoring(operation);
    setPreview(previewText);
  };

  const handleApply = async (operation: RefactoringOperation) => {
    await onApplyRefactoring(operation);
    setPreview(null);
    setSelectedOperation(null);
  };

  const getOperationIcon = (type: RefactoringOperation["type"]) => {
    const icons = {
      extract_function: "⚡",
      rename: "✏️",
      inline: "📝",
      extract_variable: "📦",
    };
    return icons[type];
  };

  const getOperationLabel = (type: RefactoringOperation["type"]) => {
    const labels = {
      extract_function: "Extract Function",
      rename: "Rename",
      inline: "Inline",
      extract_variable: "Extract Variable",
    };
    return labels[type];
  };

  return (
    <div className="refactoring-panel">
      <div className="refactoring-header" onClick={() => setExpanded(!expanded)}>
        <div className="refactoring-title">
          <span className="refactoring-icon">🔧</span>
          <span>Refactoring</span>
          {operations.length > 0 && (
            <span className="refactoring-count">{operations.length}</span>
          )}
        </div>
        <div className="refactoring-actions">
          <button
            className="refactoring-btn"
            title="Quick Actions"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickActions(!showQuickActions);
            }}
          >
            <IconPlus />
          </button>
          <span className="refactoring-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="refactoring-body">
          {showQuickActions && (
            <div className="refactoring-quick-actions">
              <button
                className="refactoring-quick-btn"
                onClick={() => {
                  // Trigger extract function dialog
                  console.log("Extract function");
                }}
              >
                <span className="refactoring-quick-icon">⚡</span>
                Extract Function
              </button>
              <button
                className="refactoring-quick-btn"
                onClick={() => {
                  // Trigger rename dialog
                  console.log("Rename");
                }}
              >
                <span className="refactoring-quick-icon">✏️</span>
                Rename Symbol
              </button>
              <button
                className="refactoring-quick-btn"
                onClick={() => {
                  // Trigger extract variable dialog
                  console.log("Extract variable");
                }}
              >
                <span className="refactoring-quick-icon">📦</span>
                Extract Variable
              </button>
            </div>
          )}

          {operations.length === 0 ? (
            <div className="refactoring-empty">
              <p>No refactorings pending</p>
              <p className="muted">Select code to see refactoring options</p>
            </div>
          ) : (
            <div className="refactoring-list">
              {operations.map((operation) => (
                <div key={operation.id} className="refactoring-item">
                  <div className="refactoring-item-main">
                    <span className="refactoring-item-icon">
                      {getOperationIcon(operation.type)}
                    </span>
                    <div className="refactoring-item-info">
                      <div className="refactoring-item-type">
                        {getOperationLabel(operation.type)}
                      </div>
                      <div className="refactoring-item-name">
                        {operation.name}
                      </div>
                      <div className="refactoring-item-location">
                        {operation.filePath.split("/").pop()}:
                        {operation.range.start.line + 1}
                      </div>
                    </div>
                  </div>
                  <div className="refactoring-item-actions">
                    <button
                      className="refactoring-item-btn"
                      title="Preview"
                      onClick={() => handlePreview(operation)}
                    >
                      <IconChevronRight />
                    </button>
                    <button
                      className="refactoring-item-btn primary"
                      title="Apply"
                      onClick={() => handleApply(operation)}
                    >
                      <IconEdit />
                    </button>
                    <button
                      className="refactoring-item-btn danger"
                      title="Discard"
                      onClick={() => onDiscardRefactoring(operation.id)}
                    >
                      <IconX />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedOperation && preview && (
            <div className="refactoring-preview">
              <div className="refactoring-preview-header">
                <span>Preview: {selectedOperation.name}</span>
                <button
                  className="refactoring-preview-close"
                  onClick={() => {
                    setPreview(null);
                    setSelectedOperation(null);
                  }}
                >
                  <IconX />
                </button>
              </div>
              <pre className="refactoring-preview-content">
                <code>{preview}</code>
              </pre>
              <div className="refactoring-preview-actions">
                <button
                  className="refactoring-btn"
                  onClick={() => {
                    setPreview(null);
                    setSelectedOperation(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="refactoring-btn primary"
                  onClick={() => handleApply(selectedOperation)}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook to manage refactoring state
export function useRefactoring() {
  const [operations, setOperations] = useState<RefactoringOperation[]>([]);

  const addOperation = (operation: Omit<RefactoringOperation, "id">) => {
    setOperations((prev) => [
      ...prev,
      { ...operation, id: `refactor-${Date.now()}` },
    ]);
  };

  const applyRefactoring = async (operation: RefactoringOperation) => {
    // In real implementation, this would apply the refactoring to the file
    console.log("Applying refactoring:", operation);
    setOperations((prev) => prev.filter((op) => op.id !== operation.id));
  };

  const discardRefactoring = (id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));
  };

  const previewRefactoring = async (operation: RefactoringOperation): Promise<string> => {
    // In real implementation, this would generate a preview of the refactoring
    return `// Preview of ${operation.name}\n// This would show the changes that will be applied`;
  };

  const extractFunction = (
    filePath: string,
    startLine: number,
    endLine: number,
    functionName: string
  ) => {
    addOperation({
      type: "extract_function",
      name: functionName,
      filePath,
      range: {
        start: { line: startLine, character: 0 },
        end: { line: endLine, character: 0 },
      },
    });
  };

  const rename = (
    filePath: string,
    line: number,
    character: number,
    newName: string
  ) => {
    addOperation({
      type: "rename",
      name: newName,
      filePath,
      range: {
        start: { line, character },
        end: { line, character },
      },
      newName,
    });
  };

  const extractVariable = (
    filePath: string,
    line: number,
    character: number,
    variableName: string
  ) => {
    addOperation({
      type: "extract_variable",
      name: variableName,
      filePath,
      range: {
        start: { line, character },
        end: { line, character },
      },
    });
  };

  return {
    operations,
    addOperation,
    applyRefactoring,
    discardRefactoring,
    previewRefactoring,
    extractFunction,
    rename,
    extractVariable,
  };
}
