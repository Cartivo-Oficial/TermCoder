import { useState, useRef, useEffect } from "react";
import { CodeEditor, type CodeEditorHandle } from "./CodeEditor";
import { IconClose, IconSplitH, IconSplitV } from "./Icons";

export type SplitDirection = "horizontal" | "vertical";

export interface EditorPane {
  id: string;
  filePath: string;
  content: string;
}

interface SplitEditorProps {
  panes: EditorPane[];
  onPaneClose: (id: string) => void;
  onPaneChange: (id: string, content: string) => void;
  direction?: SplitDirection;
  onDirectionChange?: (direction: SplitDirection) => void;
}

export function SplitEditor({
  panes,
  onPaneClose,
  onPaneChange,
  direction = "horizontal",
  onDirectionChange,
}: SplitEditorProps) {
  const [sizes, setSizes] = useState<number[]>(panes.map(() => 100 / panes.length));
  const [isResizing, setIsResizing] = useState<number | null>(null);

  const handleResizeStart = (index: number) => {
    setIsResizing(index);
  };

  const handleResize = (e: MouseEvent) => {
    if (isResizing === null) return;

    const container = document.querySelector(".split-editor-container") as HTMLElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const totalSize = direction === "horizontal" ? rect.width : rect.height;

    const newSizes = [...sizes];
    const pos = direction === "horizontal" ? e.clientX : e.clientY;
    const relativePos = (pos - rect.left) / totalSize * 100;

    newSizes[isResizing] = Math.max(10, Math.min(90, relativePos));
    newSizes[isResizing + 1] = 100 - newSizes[isResizing];

    setSizes(newSizes);
  };

  const handleResizeEnd = () => {
    setIsResizing(null);
  };

  useEffect(() => {
    if (isResizing !== null) {
      window.addEventListener("mousemove", handleResize);
      window.addEventListener("mouseup", handleResizeEnd);
      return () => {
        window.removeEventListener("mousemove", handleResize);
        window.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [isResizing]);

  return (
    <div className="split-editor-container">
      <div className="split-editor-header">
        <button
          className="split-editor-btn"
          onClick={() => onDirectionChange?.(direction === "horizontal" ? "vertical" : "horizontal")}
          title="Toggle Split Direction"
        >
          {direction === "horizontal" ? <IconSplitV /> : <IconSplitH />}
        </button>
      </div>
      <div
        className={`split-editor split-editor-${direction}`}
        style={{
          flexDirection: direction === "horizontal" ? "row" : "column",
        }}
      >
        {panes.map((pane, index) => (
          <div
            key={pane.id}
            className="split-pane"
            style={{
              flex: sizes[index],
            }}
          >
            <div className="split-pane-header">
              <span className="split-pane-title">{pane.filePath.split("/").pop()}</span>
              <button
                className="split-pane-close"
                onClick={() => onPaneClose(pane.id)}
                title="Close Pane"
              >
                <IconClose />
              </button>
            </div>
            <div className="split-pane-content">
              <CodeEditor
                name={pane.filePath}
                value={pane.content}
                onChange={(content) => onPaneChange(pane.id, content)}
                onSave={() => {}}
                port={3000}
                aiSuggest={false}
                theme="dark"
              />
            </div>
            {index < panes.length - 1 && (
              <div
                className={`split-resizer split-resizer-${direction}`}
                onMouseDown={() => handleResizeStart(index)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook to manage split editor state
export function useSplitEditor() {
  const [panes, setPanes] = useState<EditorPane[]>([]);
  const [direction, setDirection] = useState<SplitDirection>("horizontal");

  const addPane = (filePath: string, content: string) => {
    const newPane: EditorPane = {
      id: `pane-${Date.now()}`,
      filePath,
      content,
    };
    setPanes((prev) => [...prev, newPane]);
  };

  const closePane = (id: string) => {
    setPanes((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePane = (id: string, content: string) => {
    setPanes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, content } : p))
    );
  };

  const toggleDirection = () => {
    setDirection((prev) => (prev === "horizontal" ? "vertical" : "horizontal"));
  };

  return {
    panes,
    direction,
    addPane,
    closePane,
    updatePane,
    toggleDirection,
  };
}
