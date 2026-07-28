import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconAlertTriangle,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconFilter,
} from "./Icons";
import { LSPManager, type LSPDiagnostic, useLSP } from "./LSPManager";

export interface Problem {
  id: string;
  filePath: string;
  diagnostic: LSPDiagnostic;
  resolved: boolean;
}

interface ProblemsPanelProps {
  problems: Problem[];
  onResolveProblem: (id: string) => void;
  onGoToProblem: (filePath: string, line: number) => void;
  onClearAll: () => void;
  filter: "all" | "errors" | "warnings" | "info";
  onFilterChange: (filter: "all" | "errors" | "warnings" | "info") => void;
}

export function ProblemsPanel({
  problems,
  onResolveProblem,
  onGoToProblem,
  onClearAll,
  filter,
  onFilterChange,
}: ProblemsPanelProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  const filteredProblems = problems.filter((p) => {
    if (filter === "all") return !p.resolved;
    if (filter === "errors") return !p.resolved && p.diagnostic.severity === 1;
    if (filter === "warnings") return !p.resolved && p.diagnostic.severity === 2;
    if (filter === "info") return !p.resolved && p.diagnostic.severity >= 3;
    return !p.resolved;
  });

  const errorCount = problems.filter((p) => !p.resolved && p.diagnostic.severity === 1).length;
  const warningCount = problems.filter((p) => !p.resolved && p.diagnostic.severity === 2).length;
  const infoCount = problems.filter((p) => !p.resolved && p.diagnostic.severity >= 3).length;

  const getSeverityIcon = (severity: number) => {
    if (severity === 1) return "❌";
    if (severity === 2) return "⚠️";
    return "ℹ️";
  };

  const getSeverityColor = (severity: number) => {
    if (severity === 1) return "var(--bad)";
    if (severity === 2) return "var(--warn)";
    return "var(--accent)";
  };

  const getSeverityLabel = (severity: number) => {
    if (severity === 1) return "Error";
    if (severity === 2) return "Warning";
    return "Info";
  };

  return (
    <div className="problems-panel">
      <div className="problems-header" onClick={() => setExpanded(!expanded)}>
        <div className="problems-title">
          <span className="problems-icon">🔍</span>
          <span>Problems</span>
          <span className="problems-count">{filteredProblems.length}</span>
        </div>
        <div className="problems-actions">
          <div className="problems-filters">
            <button
              className={`problems-filter ${filter === "all" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange("all");
              }}
            >
              All
            </button>
            <button
              className={`problems-filter ${filter === "errors" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange("errors");
              }}
            >
              Errors ({errorCount})
            </button>
            <button
              className={`problems-filter ${filter === "warnings" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange("warnings");
              }}
            >
              Warnings ({warningCount})
            </button>
            <button
              className={`problems-filter ${filter === "info" ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange("info");
              }}
            >
              Info ({infoCount})
            </button>
          </div>
          {filteredProblems.length > 0 && (
            <button
              className="problems-btn"
              title="Clear All"
              onClick={(e) => {
                e.stopPropagation();
                onClearAll();
              }}
            >
              <IconX />
            </button>
          )}
          <span className="problems-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="problems-body">
          {filteredProblems.length === 0 ? (
            <div className="problems-empty">
              <p>No problems detected</p>
              <p className="muted">Your code looks good!</p>
            </div>
          ) : (
            <div className="problems-list">
              {filteredProblems.map((problem) => (
                <div
                  key={problem.id}
                  className="problem-item"
                  style={{ borderLeftColor: getSeverityColor(problem.diagnostic.severity) }}
                >
                  <div className="problem-item-main">
                    <span className="problem-severity">
                      {getSeverityIcon(problem.diagnostic.severity)}
                    </span>
                    <div className="problem-info">
                      <div className="problem-message">
                        {problem.diagnostic.message}
                      </div>
                      <div className="problem-location">
                        {problem.filePath.split("/").pop()}:
                        {problem.diagnostic.range.start.line + 1}:
                        {problem.diagnostic.range.start.character + 1}
                      </div>
                      {problem.diagnostic.source && (
                        <div className="problem-source">
                          {problem.diagnostic.source}
                          {problem.diagnostic.code && `: ${problem.diagnostic.code}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="problem-item-actions">
                    <button
                      className="problem-item-btn"
                      title="Go to Problem"
                      onClick={() =>
                        onGoToProblem(
                          problem.filePath,
                          problem.diagnostic.range.start.line
                        )
                      }
                    >
                      <IconChevronRight />
                    </button>
                    <button
                      className="problem-item-btn"
                      title="Resolve"
                      onClick={() => onResolveProblem(problem.id)}
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
    </div>
  );
}

// Hook to manage problems panel state
export function useProblemsPanel() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [filter, setFilter] = useState<"all" | "errors" | "warnings" | "info">("all");
  const { lsp, ready } = useLSP();

  const updateProblems = async (filePath: string, content: string) => {
    if (!lsp || !ready) return;

    const diagnostics = await lsp.getDiagnostics(filePath, content);

    const newProblems: Problem[] = diagnostics.map((diagnostic, index) => ({
      id: `${filePath}-${index}`,
      filePath,
      diagnostic,
      resolved: false,
    }));

    setProblems((prev) => {
      // Remove old problems for this file
      const filtered = prev.filter((p) => p.filePath !== filePath);
      return [...filtered, ...newProblems];
    });
  };

  const resolveProblem = (id: string) => {
    setProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, resolved: true } : p))
    );
  };

  const goToProblem = (filePath: string, line: number) => {
    // In real implementation, this would open the file and navigate to the line
    console.log(`Go to ${filePath}:${line}`);
  };

  const clearAll = () => {
    setProblems([]);
  };

  return {
    problems,
    filter,
    setFilter,
    updateProblems,
    resolveProblem,
    goToProblem,
    clearAll,
  };
}
