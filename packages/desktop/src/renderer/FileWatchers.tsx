import { useState, useEffect, useCallback } from "react";
import { useI18n } from "./i18n";
import {
  IconRefresh,
  IconX,
  IconAlertTriangle,
} from "./Icons";

export interface FileWatcher {
  filePath: string;
  lastModified: number;
  hasChanges: boolean;
  autoReload: boolean;
}

interface FileWatchersProps {
  watchers: FileWatcher[];
  onReloadFile: (filePath: string) => void;
  onDismissChange: (filePath: string) => void;
  onToggleAutoReload: (filePath: string) => void;
  onAddWatcher: (filePath: string) => void;
  onRemoveWatcher: (filePath: string) => void;
}

export function FileWatchers({
  watchers,
  onReloadFile,
  onDismissChange,
  onToggleAutoReload,
  onAddWatcher,
  onRemoveWatcher,
}: FileWatchersProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");

  const handleAddWatcher = () => {
    if (newFilePath.trim()) {
      onAddWatcher(newFilePath.trim());
      setNewFilePath("");
      setShowAddForm(false);
    }
  };

  const changedFiles = watchers.filter((w) => w.hasChanges);

  return (
    <div className="file-watchers">
      <div className="file-watchers-header" onClick={() => setExpanded(!expanded)}>
        <div className="file-watchers-title">
          <span className="file-watchers-icon">👁️</span>
          <span>File Watchers</span>
          {changedFiles.length > 0 && (
            <span className="file-watchers-badge">{changedFiles.length}</span>
          )}
        </div>
        <div className="file-watchers-actions">
          <span className="file-watchers-caret">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="file-watchers-body">
          {changedFiles.length > 0 && (
            <div className="file-watchers-alerts">
              <div className="file-watchers-alert-header">
                <span className="file-watchers-alert-icon">
                  <IconAlertTriangle />
                </span>
                <span>Files Changed Externally</span>
              </div>
              {changedFiles.map((watcher) => (
                <div key={watcher.filePath} className="file-watchers-alert">
                  <div className="file-watchers-alert-info">
                    <span className="file-watchers-alert-path">
                      {watcher.filePath.split("/").pop()}
                    </span>
                    <span className="file-watchers-alert-time">
                      {new Date(watcher.lastModified).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="file-watchers-alert-actions">
                    <button
                      className="file-watchers-alert-btn primary"
                      onClick={() => onReloadFile(watcher.filePath)}
                    >
                      Reload
                    </button>
                    <button
                      className="file-watchers-alert-btn"
                      onClick={() => onDismissChange(watcher.filePath)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="file-watchers-list">
            <div className="file-watchers-list-header">
              <span>Watched Files</span>
              <button
                className="file-watchers-btn sm"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                Add
              </button>
            </div>

            {showAddForm && (
              <div className="file-watchers-add-form">
                <input
                  type="text"
                  placeholder="File path..."
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  className="file-watchers-input"
                />
                <div className="file-watchers-add-actions">
                  <button
                    className="file-watchers-btn"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewFilePath("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="file-watchers-btn primary"
                    onClick={handleAddWatcher}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {watchers.length === 0 ? (
              <div className="file-watchers-empty">
                <p>No files being watched</p>
                <p className="muted">Add files to watch for external changes</p>
              </div>
            ) : (
              watchers.map((watcher) => (
                <div key={watcher.filePath} className="file-watcher-item">
                  <div className="file-watcher-info">
                    <span className="file-watcher-path">
                      {watcher.filePath.split("/").pop()}
                    </span>
                    <span className="file-watcher-status">
                      {watcher.hasChanges ? "Changed" : "Up to date"}
                    </span>
                  </div>
                  <div className="file-watcher-actions">
                    <label className="file-watcher-toggle">
                      <input
                        type="checkbox"
                        checked={watcher.autoReload}
                        onChange={() => onToggleAutoReload(watcher.filePath)}
                      />
                      <span>Auto-reload</span>
                    </label>
                    <button
                      className="file-watcher-btn"
                      onClick={() => onReloadFile(watcher.filePath)}
                    >
                      <IconRefresh />
                    </button>
                    <button
                      className="file-watcher-btn danger"
                      onClick={() => onRemoveWatcher(watcher.filePath)}
                    >
                      <IconX />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to manage file watchers state
export function useFileWatchers() {
  const [watchers, setWatchers] = useState<FileWatcher[]>([]);

  const addWatcher = (filePath: string) => {
    setWatchers((prev) => [
      ...prev,
      {
        filePath,
        lastModified: Date.now(),
        hasChanges: false,
        autoReload: true,
      },
    ]);
  };

  const removeWatcher = (filePath: string) => {
    setWatchers((prev) => prev.filter((w) => w.filePath !== filePath));
  };

  const reloadFile = (filePath: string) => {
    // In real implementation, this would reload the file
    console.log("Reload file:", filePath);
    setWatchers((prev) =>
      prev.map((w) =>
        w.filePath === filePath
          ? { ...w, hasChanges: false, lastModified: Date.now() }
          : w
      )
    );
  };

  const dismissChange = (filePath: string) => {
    setWatchers((prev) =>
      prev.map((w) =>
        w.filePath === filePath ? { ...w, hasChanges: false } : w
      )
    );
  };

  const toggleAutoReload = (filePath: string) => {
    setWatchers((prev) =>
      prev.map((w) =>
        w.filePath === filePath ? { ...w, autoReload: !w.autoReload } : w
      )
    );
  };

  // Simulate file changes (in real implementation, this would use file system watchers)
  useEffect(() => {
    const interval = setInterval(() => {
      setWatchers((prev) =>
        prev.map((w) => {
          // Simulate random changes
          if (Math.random() < 0.1) {
            return { ...w, hasChanges: true, lastModified: Date.now() };
          }
          return w;
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Auto-reload enabled files
  useEffect(() => {
    watchers.forEach((watcher) => {
      if (watcher.hasChanges && watcher.autoReload) {
        reloadFile(watcher.filePath);
      }
    });
  }, [watchers]);

  return {
    watchers,
    addWatcher,
    removeWatcher,
    reloadFile,
    dismissChange,
    toggleAutoReload,
  };
}
