import { useState, useRef, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconPlay,
  IconStop,
  IconRefresh,
  IconPlus,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconForward,
  IconBack,
  IconBug,
} from "./Icons";

export interface Breakpoint {
  id: string;
  filePath: string;
  line: number;
  enabled: boolean;
  condition?: string;
}

export interface DebugSession {
  id: string;
  state: "running" | "paused" | "stopped";
  currentFile?: string;
  currentLine?: number;
  callStack: Array<{ file: string; line: number; function: string }>;
  variables: Record<string, any>;
  watchExpressions: string[];
}

interface DebuggerProps {
  breakpoints: Breakpoint[];
  onToggleBreakpoint: (filePath: string, line: number) => void;
  onRemoveBreakpoint: (id: string) => void;
  onEditBreakpoint: (id: string, condition: string) => void;
  onStartDebug: () => void;
  onStopDebug: () => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onContinue: () => void;
  session: DebugSession | null;
  onAddWatch: (expression: string) => void;
  onRemoveWatch: (expression: string) => void;
  onEvaluate: (expression: string) => any;
}

export function Debugger({
  breakpoints,
  onToggleBreakpoint,
  onRemoveBreakpoint,
  onEditBreakpoint,
  onStartDebug,
  onStopDebug,
  onStepOver,
  onStepInto,
  onStepOut,
  onContinue,
  session,
  onAddWatch,
  onRemoveWatch,
  onEvaluate,
}: DebuggerProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"breakpoints" | "callstack" | "variables" | "watch">("breakpoints");
  const [newWatch, setNewWatch] = useState("");
  const [editingBreakpoint, setEditingBreakpoint] = useState<string | null>(null);
  const [breakpointCondition, setBreakpointCondition] = useState("");

  const handleAddWatch = () => {
    if (newWatch.trim()) {
      onAddWatch(newWatch.trim());
      setNewWatch("");
    }
  };

  const handleEditBreakpoint = (id: string, currentCondition?: string) => {
    setEditingBreakpoint(id);
    setBreakpointCondition(currentCondition || "");
  };

  const handleSaveBreakpoint = () => {
    if (editingBreakpoint) {
      onEditBreakpoint(editingBreakpoint, breakpointCondition);
      setEditingBreakpoint(null);
      setBreakpointCondition("");
    }
  };

  return (
    <div className="debugger">
      <div className="debugger-header" onClick={() => setExpanded(!expanded)}>
        <div className="debugger-title">
          <span className="debugger-icon">
            <IconBug />
          </span>
          <span>Debugger</span>
          {session && (
            <span className={`debugger-status ${session.state}`}>
              {session.state}
            </span>
          )}
        </div>
        <div className="debugger-actions">
          {!session ? (
            <button
              className="debugger-btn primary"
              title="Start Debugging"
              onClick={(e) => {
                e.stopPropagation();
                onStartDebug();
              }}
            >
              <IconPlay />
              Start
            </button>
          ) : (
            <>
              <button
                className="debugger-btn"
                title={session.state === "paused" ? "Continue" : "Pause"}
                onClick={(e) => {
                  e.stopPropagation();
                  onContinue();
                }}
              >
                <IconPlay />
              </button>
              <button
                className="debugger-btn"
                title="Step Over"
                onClick={(e) => {
                  e.stopPropagation();
                  onStepOver();
                }}
                disabled={session.state !== "paused"}
              >
                <IconForward />
              </button>
              <button
                className="debugger-btn"
                title="Step Into"
                onClick={(e) => {
                  e.stopPropagation();
                  onStepInto();
                }}
                disabled={session.state !== "paused"}
              >
                <IconChevronRight />
              </button>
              <button
                className="debugger-btn"
                title="Step Out"
                onClick={(e) => {
                  e.stopPropagation();
                  onStepOut();
                }}
                disabled={session.state !== "paused"}
              >
                <IconBack />
              </button>
              <button
                className="debugger-btn danger"
                title="Stop Debugging"
                onClick={(e) => {
                  e.stopPropagation();
                  onStopDebug();
                }}
              >
                <IconStop />
              </button>
            </>
          )}
          <span className="debugger-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="debugger-body">
          <div className="debugger-tabs">
            <button
              className={`debugger-tab ${activeTab === "breakpoints" ? "active" : ""}`}
              onClick={() => setActiveTab("breakpoints")}
            >
              Breakpoints ({breakpoints.length})
            </button>
            {session && (
              <>
                <button
                  className={`debugger-tab ${activeTab === "callstack" ? "active" : ""}`}
                  onClick={() => setActiveTab("callstack")}
                >
                  Call Stack ({session.callStack.length})
                </button>
                <button
                  className={`debugger-tab ${activeTab === "variables" ? "active" : ""}`}
                  onClick={() => setActiveTab("variables")}
                >
                  Variables ({Object.keys(session.variables).length})
                </button>
                <button
                  className={`debugger-tab ${activeTab === "watch" ? "active" : ""}`}
                  onClick={() => setActiveTab("watch")}
                >
                  Watch ({session.watchExpressions.length})
                </button>
              </>
            )}
          </div>

          <div className="debugger-content">
            {activeTab === "breakpoints" && (
              <div className="debugger-section">
                {breakpoints.length === 0 ? (
                  <div className="debugger-empty">
                    <p>No breakpoints set</p>
                    <p className="muted">Click on line numbers in the editor to add breakpoints</p>
                  </div>
                ) : (
                  <div className="debugger-list">
                    {breakpoints.map((bp) => (
                      <div key={bp.id} className="debugger-item">
                        <div className="debugger-item-main">
                          <button
                            className={`debugger-bp-toggle ${bp.enabled ? "enabled" : ""}`}
                            onClick={() => onToggleBreakpoint(bp.filePath, bp.line)}
                          >
                            ●
                          </button>
                          <div className="debugger-bp-info">
                            <div className="debugger-bp-file">
                              {bp.filePath.split("/").pop()}
                            </div>
                            <div className="debugger-bp-line">Line {bp.line}</div>
                          </div>
                          {bp.condition && (
                            <div className="debugger-bp-condition">
                              {bp.condition}
                            </div>
                          )}
                        </div>
                        <div className="debugger-item-actions">
                          <button
                            className="debugger-item-btn"
                            title="Edit Condition"
                            onClick={() => handleEditBreakpoint(bp.id, bp.condition)}
                          >
                            ✏️
                          </button>
                          <button
                            className="debugger-item-btn danger"
                            title="Remove"
                            onClick={() => onRemoveBreakpoint(bp.id)}
                          >
                            <IconX />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "callstack" && session && (
              <div className="debugger-section">
                {session.callStack.length === 0 ? (
                  <div className="debugger-empty">
                    <p>Call stack is empty</p>
                  </div>
                ) : (
                  <div className="debugger-list">
                    {session.callStack.map((frame, i) => (
                      <div key={i} className="debugger-item">
                        <div className="debugger-frame-info">
                          <div className="debugger-frame-function">{frame.function}</div>
                          <div className="debugger-frame-location">
                            {frame.file}:{frame.line}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "variables" && session && (
              <div className="debugger-section">
                {Object.keys(session.variables).length === 0 ? (
                  <div className="debugger-empty">
                    <p>No variables in scope</p>
                  </div>
                ) : (
                  <div className="debugger-list">
                    {Object.entries(session.variables).map(([name, value]) => (
                      <div key={name} className="debugger-item">
                        <div className="debugger-var-name">{name}</div>
                        <div className="debugger-var-value">
                          {typeof value === "object"
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "watch" && session && (
              <div className="debugger-section">
                <div className="debugger-watch-input">
                  <input
                    type="text"
                    placeholder="Add watch expression..."
                    value={newWatch}
                    onChange={(e) => setNewWatch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddWatch();
                    }}
                  />
                  <button
                    className="debugger-btn sm"
                    onClick={handleAddWatch}
                  >
                    <IconPlus />
                  </button>
                </div>
                {session.watchExpressions.length === 0 ? (
                  <div className="debugger-empty">
                    <p>No watch expressions</p>
                  </div>
                ) : (
                  <div className="debugger-list">
                    {session.watchExpressions.map((expr) => (
                      <div key={expr} className="debugger-item">
                        <div className="debugger-watch-expr">{expr}</div>
                        <div className="debugger-watch-value">
                          {String(onEvaluate(expr))}
                        </div>
                        <button
                          className="debugger-item-btn danger"
                          onClick={() => onRemoveWatch(expr)}
                        >
                          <IconX />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {editingBreakpoint && (
        <div className="debugger-modal">
          <div className="debugger-modal-content">
            <h3>Edit Breakpoint Condition</h3>
            <input
              type="text"
              placeholder="Condition (e.g., x > 10)"
              value={breakpointCondition}
              onChange={(e) => setBreakpointCondition(e.target.value)}
              autoFocus
            />
            <div className="debugger-modal-actions">
              <button
                className="debugger-btn"
                onClick={() => {
                  setEditingBreakpoint(null);
                  setBreakpointCondition("");
                }}
              >
                Cancel
              </button>
              <button
                className="debugger-btn primary"
                onClick={handleSaveBreakpoint}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to manage debugger state
export function useDebugger() {
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [session, setSession] = useState<DebugSession | null>(null);

  const toggleBreakpoint = (filePath: string, line: number) => {
    const existing = breakpoints.find(
      (bp) => bp.filePath === filePath && bp.line === line
    );
    if (existing) {
      setBreakpoints(
        breakpoints.map((bp) =>
          bp.id === existing.id
            ? { ...bp, enabled: !bp.enabled }
            : bp
        )
      );
    } else {
      setBreakpoints([
        ...breakpoints,
        {
          id: `${filePath}-${line}-${Date.now()}`,
          filePath,
          line,
          enabled: true,
        },
      ]);
    }
  };

  const removeBreakpoint = (id: string) => {
    setBreakpoints(breakpoints.filter((bp) => bp.id !== id));
  };

  const editBreakpoint = (id: string, condition: string) => {
    setBreakpoints(
      breakpoints.map((bp) =>
        bp.id === id ? { ...bp, condition } : bp
      )
    );
  };

  const startDebug = () => {
    setSession({
      id: `debug-${Date.now()}`,
      state: "running",
      callStack: [],
      variables: {},
      watchExpressions: [],
    });
  };

  const stopDebug = () => {
    setSession(null);
  };

  const addWatch = (expression: string) => {
    if (session) {
      setSession({
        ...session,
        watchExpressions: [...session.watchExpressions, expression],
      });
    }
  };

  const removeWatch = (expression: string) => {
    if (session) {
      setSession({
        ...session,
        watchExpressions: session.watchExpressions.filter((e) => e !== expression),
      });
    }
  };

  const evaluate = (expression: string): any => {
    if (session) {
      try {
        // Simple evaluation - in real implementation would use the debug session
        return eval(expression);
      } catch {
        return "<error>";
      }
    }
    return undefined;
  };

  return {
    breakpoints,
    session,
    toggleBreakpoint,
    removeBreakpoint,
    editBreakpoint,
    startDebug,
    stopDebug,
    addWatch,
    removeWatch,
    evaluate,
  };
}
