import { useState, useEffect } from "react";
import { useI18n } from "./i18n";
import {
  IconPlus,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
  IconUndo,
  IconShare,
  IconCopy,
  IconTrash,
  IconAlertTriangle,
} from "./Icons";

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  branch?: string;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  remote?: string;
}

export interface GitStash {
  id: string;
  branch: string;
  message: string;
  date: string;
}

interface GitGUIProps {
  commits: GitCommit[];
  branches: GitBranch[];
  stashes: GitStash[];
  onCommit: (message: string) => Promise<void>;
  onCreateBranch: (name: string) => Promise<void>;
  onSwitchBranch: (name: string) => Promise<void>;
  onDeleteBranch: (name: string) => Promise<void>;
  onMerge: (branch: string) => Promise<void>;
  onRebase: (branch: string) => Promise<void>;
  onStash: (message: string) => Promise<void>;
  onStashPop: (id: string) => Promise<void>;
  onStashDrop: (id: string) => Promise<void>;
  onBlame: (filePath: string, line: number) => Promise<void>;
  onFetch: () => Promise<void>;
  onPull: () => Promise<void>;
  onPush: () => Promise<void>;
  onRefresh: () => Promise<void>;
  currentBranch?: string;
  status?: {
    staged: string[];
    unstaged: string[];
    untracked: string[];
  };
}

export function GitGUI({
  commits,
  branches,
  stashes,
  onCommit,
  onCreateBranch,
  onSwitchBranch,
  onDeleteBranch,
  onMerge,
  onRebase,
  onStash,
  onStashPop,
  onStashDrop,
  onBlame,
  onFetch,
  onPull,
  onPush,
  onRefresh,
  currentBranch,
  status,
}: GitGUIProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"commits" | "branches" | "stashes" | "status">("commits");
  const [showCommitForm, setShowCommitForm] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [selectedCommits, setSelectedCommits] = useState<Set<string>>(new Set());

  const handleCommit = async () => {
    if (commitMessage.trim()) {
      await onCommit(commitMessage.trim());
      setCommitMessage("");
      setShowCommitForm(false);
    }
  };

  const handleCreateBranch = async () => {
    if (newBranchName.trim()) {
      await onCreateBranch(newBranchName.trim());
      setNewBranchName("");
      setShowBranchForm(false);
    }
  };

  const toggleCommitSelection = (hash: string) => {
    setSelectedCommits((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  };

  return (
    <div className="git-gui">
      <div className="git-header" onClick={() => setExpanded(!expanded)}>
        <div className="git-title">
          <span className="git-icon">📦</span>
          <span>Git</span>
          {currentBranch && (
            <span className="git-branch-badge">{currentBranch}</span>
          )}
        </div>
        <div className="git-actions">
          <button
            className="git-btn"
            title="Refresh"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
          >
            <IconRefresh />
          </button>
          <button
            className="git-btn"
            title="Pull"
            onClick={(e) => {
              e.stopPropagation();
              onPull();
            }}
          >
            <IconUndo />
          </button>
          <button
            className="git-btn"
            title="Push"
            onClick={(e) => {
              e.stopPropagation();
              onPush();
            }}
          >
            <IconShare />
          </button>
          <span className="git-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="git-body">
          <div className="git-tabs">
            <button
              className={`git-tab ${activeTab === "commits" ? "active" : ""}`}
              onClick={() => setActiveTab("commits")}
            >
              Commits ({commits.length})
            </button>
            <button
              className={`git-tab ${activeTab === "branches" ? "active" : ""}`}
              onClick={() => setActiveTab("branches")}
            >
              Branches ({branches.length})
            </button>
            <button
              className={`git-tab ${activeTab === "stashes" ? "active" : ""}`}
              onClick={() => setActiveTab("stashes")}
            >
              Stashes ({stashes.length})
            </button>
            {status && (
              <button
                className={`git-tab ${activeTab === "status" ? "active" : ""}`}
                onClick={() => setActiveTab("status")}
              >
                Status
              </button>
            )}
          </div>

          <div className="git-content">
            {activeTab === "commits" && (
              <div className="git-section">
                <div className="git-section-header">
                  <button
                    className="git-btn sm"
                    onClick={() => setShowCommitForm(!showCommitForm)}
                  >
                    <IconPlus />
                    Commit
                  </button>
                  {selectedCommits.size > 0 && (
                    <div className="git-bulk-actions">
                      <button
                        className="git-btn sm"
                        onClick={() => {/* Cherry pick */}}
                      >
                        Cherry Pick
                      </button>
                      <button
                        className="git-btn sm"
                        onClick={() => {/* Revert */}}
                      >
                        Revert
                      </button>
                    </div>
                  )}
                </div>
                {showCommitForm && (
                  <div className="git-commit-form">
                    <textarea
                      placeholder="Commit message..."
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      className="git-commit-input"
                      rows={3}
                    />
                    <div className="git-commit-actions">
                      <button
                        className="git-btn"
                        onClick={() => {
                          setShowCommitForm(false);
                          setCommitMessage("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="git-btn primary"
                        onClick={handleCommit}
                      >
                        Commit
                      </button>
                    </div>
                  </div>
                )}
                <div className="git-commits-list">
                  {commits.map((commit) => (
                    <div
                      key={commit.hash}
                      className={`git-commit ${selectedCommits.has(commit.hash) ? "selected" : ""}`}
                      onClick={() => toggleCommitSelection(commit.hash)}
                    >
                      <div className="git-commit-main">
                        <input
                          type="checkbox"
                          checked={selectedCommits.has(commit.hash)}
                          onChange={() => toggleCommitSelection(commit.hash)}
                          className="git-commit-checkbox"
                        />
                        <div className="git-commit-info">
                          <div className="git-commit-hash">
                            {commit.hash.substring(0, 7)}
                          </div>
                          <div className="git-commit-message">
                            {commit.message}
                          </div>
                          <div className="git-commit-meta">
                            <span className="git-commit-author">{commit.author}</span>
                            <span className="git-commit-date">{commit.date}</span>
                          </div>
                        </div>
                      </div>
                      <div className="git-commit-actions">
                        <button
                          className="git-commit-btn"
                          title="Blame"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBlame("", 0);
                          }}
                        >
                          <IconAlertTriangle />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "branches" && (
              <div className="git-section">
                <div className="git-section-header">
                  <button
                    className="git-btn sm"
                    onClick={() => setShowBranchForm(!showBranchForm)}
                  >
                    <IconPlus />
                    New Branch
                  </button>
                </div>
                {showBranchForm && (
                  <div className="git-branch-form">
                    <input
                      type="text"
                      placeholder="Branch name..."
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className="git-branch-input"
                    />
                    <div className="git-branch-actions">
                      <button
                        className="git-btn"
                        onClick={() => {
                          setShowBranchForm(false);
                          setNewBranchName("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="git-btn primary"
                        onClick={handleCreateBranch}
                      >
                        Create
                      </button>
                    </div>
                  </div>
                )}
                <div className="git-branches-list">
                  {branches.map((branch) => (
                    <div
                      key={branch.name}
                      className="git-branch"
                      style={branch.isCurrent ? { borderColor: "var(--ok)" } : {}}
                    >
                      <div className="git-branch-main">
                        {branch.isCurrent && (
                          <span className="git-branch-current">●</span>
                        )}
                        <span className="git-branch-name">{branch.name}</span>
                        {branch.remote && (
                          <span className="git-branch-remote">{branch.remote}</span>
                        )}
                      </div>
                      <div className="git-branch-actions">
                        {!branch.isCurrent && (
                          <button
                            className="git-branch-btn"
                            title="Switch"
                            onClick={() => onSwitchBranch(branch.name)}
                          >
                            <IconChevronRight />
                          </button>
                        )}
                        <button
                          className="git-branch-btn"
                          title="Merge"
                          onClick={() => onMerge(branch.name)}
                        >
                          <IconCopy />
                        </button>
                        <button
                          className="git-branch-btn"
                          title="Rebase"
                          onClick={() => onRebase(branch.name)}
                        >
                          <IconUndo />
                        </button>
                        {!branch.isCurrent && (
                          <button
                            className="git-branch-btn danger"
                            title="Delete"
                            onClick={() => onDeleteBranch(branch.name)}
                          >
                            <IconTrash />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "stashes" && (
              <div className="git-section">
                <div className="git-section-header">
                  <button
                    className="git-btn sm"
                    onClick={() => {/* Stash current changes */}}
                  >
                    <IconPlus />
                    Stash
                  </button>
                </div>
                {stashes.length === 0 ? (
                  <div className="git-empty">
                    <p>No stashes</p>
                  </div>
                ) : (
                  <div className="git-stashes-list">
                    {stashes.map((stash) => (
                      <div key={stash.id} className="git-stash">
                        <div className="git-stash-info">
                          <div className="git-stash-id">{stash.id.substring(0, 7)}</div>
                          <div className="git-stash-message">{stash.message}</div>
                          <div className="git-stash-meta">
                            <span className="git-stash-branch">{stash.branch}</span>
                            <span className="git-stash-date">{stash.date}</span>
                          </div>
                        </div>
                        <div className="git-stash-actions">
                          <button
                            className="git-stash-btn"
                            title="Pop"
                            onClick={() => onStashPop(stash.id)}
                          >
                            <IconChevronRight />
                          </button>
                          <button
                            className="git-stash-btn danger"
                            title="Drop"
                            onClick={() => onStashDrop(stash.id)}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "status" && status && (
              <div className="git-section">
                <div className="git-status-section">
                  <div className="git-status-header">Staged</div>
                  {status.staged.length === 0 ? (
                    <div className="git-status-empty">No staged files</div>
                  ) : (
                    <div className="git-status-list">
                      {status.staged.map((file) => (
                        <div key={file} className="git-status-item">
                          <span className="git-status-file">{file}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="git-status-section">
                  <div className="git-status-header">Unstaged</div>
                  {status.unstaged.length === 0 ? (
                    <div className="git-status-empty">No unstaged files</div>
                  ) : (
                    <div className="git-status-list">
                      {status.unstaged.map((file) => (
                        <div key={file} className="git-status-item">
                          <span className="git-status-file">{file}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="git-status-section">
                  <div className="git-status-header">Untracked</div>
                  {status.untracked.length === 0 ? (
                    <div className="git-status-empty">No untracked files</div>
                  ) : (
                    <div className="git-status-list">
                      {status.untracked.map((file) => (
                        <div key={file} className="git-status-item">
                          <span className="git-status-file">{file}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to manage Git GUI state
export function useGitGUI(cwd?: string) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [stashes, setStashes] = useState<GitStash[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | undefined>();
  const [status, setStatus] = useState<{
    staged: string[];
    unstaged: string[];
    untracked: string[];
  } | undefined>();

  const refresh = async () => {
    // In real implementation, this would fetch Git status
    console.log("Refreshing Git status");
  };

  const commit = async (message: string) => {
    // In real implementation, this would create a Git commit
    console.log("Commit:", message);
    await refresh();
  };

  const createBranch = async (name: string) => {
    // In real implementation, this would create a Git branch
    console.log("Create branch:", name);
    await refresh();
  };

  const switchBranch = async (name: string) => {
    // In real implementation, this would switch Git branch
    console.log("Switch to branch:", name);
    await refresh();
  };

  const deleteBranch = async (name: string) => {
    // In real implementation, this would delete Git branch
    console.log("Delete branch:", name);
    await refresh();
  };

  const merge = async (branch: string) => {
    // In real implementation, this would merge branch
    console.log("Merge branch:", branch);
    await refresh();
  };

  const rebase = async (branch: string) => {
    // In real implementation, this would rebase onto branch
    console.log("Rebase onto:", branch);
    await refresh();
  };

  const stash = async (message: string) => {
    // In real implementation, this would stash changes
    console.log("Stash:", message);
    await refresh();
  };

  const stashPop = async (id: string) => {
    // In real implementation, this would pop stash
    console.log("Pop stash:", id);
    await refresh();
  };

  const stashDrop = async (id: string) => {
    // In real implementation, this would drop stash
    console.log("Drop stash:", id);
    await refresh();
  };

  const blame = async (filePath: string, line: number) => {
    // In real implementation, this would show blame info
    console.log("Blame:", filePath, line);
  };

  const fetch = async () => {
    // In real implementation, this would fetch from remote
    console.log("Fetch");
    await refresh();
  };

  const pull = async () => {
    // In real implementation, this would pull from remote
    console.log("Pull");
    await refresh();
  };

  const push = async () => {
    // In real implementation, this would push to remote
    console.log("Push");
    await refresh();
  };

  return {
    commits,
    branches,
    stashes,
    currentBranch,
    status,
    refresh,
    commit,
    createBranch,
    switchBranch,
    deleteBranch,
    merge,
    rebase,
    stash,
    stashPop,
    stashDrop,
    blame,
    fetch,
    pull,
    push,
  };
}
