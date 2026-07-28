import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconChevronDown,
  IconChevronRight,
} from "./Icons";

export interface GraphCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  branch?: string;
  parents: string[];
  children: string[];
}

interface SourceControlGraphProps {
  commits: GraphCommit[];
  currentBranch?: string;
  onCommitClick: (hash: string) => void;
}

export function SourceControlGraph({
  commits,
  currentBranch,
  onCommitClick,
}: SourceControlGraphProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);

  // Build a tree structure from commits
  const buildTree = () => {
    const commitMap = new Map<string, GraphCommit>();
    commits.forEach((commit) => commitMap.set(commit.hash, commit));

    const roots = commits.filter((c) => c.parents.length === 0);
    return { roots, commitMap };
  };

  const { roots, commitMap } = buildTree();

  const renderCommitNode = (commit: GraphCommit, depth: number = 0) => {
    const isSelected = selectedCommit === commit.hash;
    const isCurrentBranch = commit.branch === currentBranch;

    return (
      <div key={commit.hash} className="graph-commit" style={{ marginLeft: `${depth * 24}px` }}>
        <div
          className={`graph-commit-node ${isSelected ? "selected" : ""} ${isCurrentBranch ? "current" : ""}`}
          onClick={() => {
            setSelectedCommit(commit.hash);
            onCommitClick(commit.hash);
          }}
        >
          <div className="graph-commit-connector">
            {commit.parents.length > 0 && <div className="graph-commit-line-up" />}
            {commit.children.length > 0 && <div className="graph-commit-line-down" />}
          </div>
          <div className="graph-commit-dot" />
          <div className="graph-commit-info">
            <div className="graph-commit-hash">{commit.hash.substring(0, 7)}</div>
            <div className="graph-commit-message">{commit.message}</div>
            <div className="graph-commit-meta">
              <span className="graph-commit-author">{commit.author}</span>
              <span className="graph-commit-date">{commit.date}</span>
            </div>
          </div>
        </div>
        {commit.children.map((childHash) => {
          const child = commitMap.get(childHash);
          return child ? renderCommitNode(child, depth + 1) : null;
        })}
      </div>
    );
  };

  return (
    <div className="source-control-graph">
      <div className="graph-header" onClick={() => setExpanded(!expanded)}>
        <div className="graph-title">
          <span className="graph-icon">🌳</span>
          <span>Source Control Graph</span>
          {currentBranch && (
            <span className="graph-branch-badge">{currentBranch}</span>
          )}
        </div>
        <div className="graph-actions">
          <span className="graph-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="graph-body">
          {commits.length === 0 ? (
            <div className="graph-empty">
              <p>No commits found</p>
              <p className="muted">Start committing to see the graph</p>
            </div>
          ) : (
            <div className="graph-tree">
              {roots.map((root) => renderCommitNode(root))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook to manage source control graph state
export function useSourceControlGraph(cwd?: string) {
  const [commits, setCommits] = useState<GraphCommit[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | undefined>();

  const refresh = async () => {
    // In real implementation, this would fetch Git history
    console.log("Refreshing source control graph");
  };

  const handleCommitClick = (hash: string) => {
    // In real implementation, this would show commit details
    console.log("Commit clicked:", hash);
  };

  return {
    commits,
    currentBranch,
    refresh,
    handleCommitClick,
  };
}
