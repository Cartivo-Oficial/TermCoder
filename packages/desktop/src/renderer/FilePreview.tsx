import { useState } from "react";
import { useI18n } from "./i18n";
import {
  IconFile,
  IconFolder,
  IconCopy,
  IconEdit,
  IconEye,
  IconChevronDown,
  IconChevronRight,
  IconX,
} from "./Icons";

interface FilePreviewProps {
  path: string;
  content?: string;
  language?: string;
  isFolder?: boolean;
  children?: FilePreviewProps[];
  onOpen?: (path: string) => void;
  onEdit?: (path: string, content: string) => void;
  cwd?: string;
}

export function FilePreview({
  path,
  content,
  language,
  isFolder = false,
  children,
  onOpen,
  onEdit,
  cwd,
}: FilePreviewProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content || "");

  const relPath = cwd && path.startsWith(cwd) 
    ? path.slice(cwd.length).replace(/^[\\/]+/, "")
    : path;

  const getFileIcon = (filePath: string) => {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      ts: "📘",
      tsx: "⚛️",
      js: "📜",
      jsx: "⚛️",
      py: "🐍",
      html: "🌐",
      css: "🎨",
      json: "📋",
      md: "📝",
      txt: "📄",
      png: "🖼️",
      jpg: "🖼️",
      jpeg: "🖼️",
      svg: "🎨",
    };
    return iconMap[ext || ""] || "📄";
  };

  const handleSave = () => {
    onEdit?.(path, editContent);
    setEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content || "");
  };

  if (isFolder) {
    return (
      <div className="file-preview folder">
        <div
          className="file-preview-header folder"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="folder-icon">
            {expanded ? <IconChevronDown /> : <IconChevronRight />}
          </span>
          <span className="folder-emoji">📁</span>
          <span className="file-name">{relPath}</span>
          <span className="file-count">{children?.length || 0} items</span>
        </div>
        {expanded && children && (
          <div className="folder-children">
            {children.map((child, i) => (
              <FilePreview
                key={i}
                {...child}
                onOpen={onOpen}
                onEdit={onEdit}
                cwd={cwd}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="file-preview file">
      <div className="file-preview-header">
        <span className="file-emoji">{getFileIcon(path)}</span>
        <span className="file-name">{relPath}</span>
        <div className="file-actions">
          {onOpen && (
            <button
              className="file-action-btn"
              title="Open in editor"
              onClick={() => onOpen(path)}
            >
              <IconEye />
            </button>
          )}
          {onEdit && content && (
            <button
              className="file-action-btn"
              title="Edit file"
              onClick={() => setEditing(!editing)}
            >
              <IconEdit />
            </button>
          )}
          {content && (
            <button
              className="file-action-btn"
              title="Copy content"
              onClick={handleCopy}
            >
              <IconCopy />
            </button>
          )}
        </div>
      </div>
      {content && (editing || expanded) && (
        <div className="file-content">
          {editing ? (
            <div className="file-editor">
              <textarea
                className="file-edit-area"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                spellCheck={false}
              />
              <div className="file-edit-actions">
                <button
                  className="file-edit-btn cancel"
                  onClick={() => {
                    setEditing(false);
                    setEditContent(content || "");
                  }}
                >
                  Cancel
                </button>
                <button className="file-edit-btn save" onClick={handleSave}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <pre className={`file-code language-${language || "text"}`}>
              <code>{content}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

interface FileCardProps {
  path: string;
  content?: string;
  language?: string;
  lineCount?: number;
  onOpen?: (path: string) => void;
  onEdit?: (path: string, content: string) => void;
  cwd?: string;
}

export function FileCard({
  path,
  content,
  language,
  lineCount,
  onOpen,
  onEdit,
  cwd,
}: FileCardProps) {
  const relPath = cwd && path.startsWith(cwd)
    ? path.slice(cwd.length).replace(/^[\\/]+/, "")
    : path;

  const ext = path.split(".").pop()?.toLowerCase();
  const getFileColor = (extension?: string) => {
    const colors: Record<string, string> = {
      ts: "#3178c6",
      tsx: "#61dafb",
      js: "#f7df1e",
      jsx: "#61dafb",
      py: "#3776ab",
      html: "#e34f26",
      css: "#1572b6",
      json: "#292929",
      md: "#083fa1",
    };
    return colors[extension || ""] || "#6b7280";
  };

  return (
    <div className="file-card">
      <div className="file-card-header">
        <div className="file-card-icon" style={{ backgroundColor: getFileColor(ext) }}>
          {ext?.toUpperCase() || "FILE"}
        </div>
        <div className="file-card-info">
          <div className="file-card-path">{relPath}</div>
          <div className="file-card-meta">
            {language && <span className="file-lang">{language}</span>}
            {lineCount && <span className="file-lines">{lineCount} lines</span>}
          </div>
        </div>
        <div className="file-card-actions">
          {onOpen && (
            <button className="file-card-btn" title="Open" onClick={() => onOpen(path)}>
              <IconEye />
            </button>
          )}
          {onEdit && onOpen && (
            <button className="file-card-btn" title="Edit" onClick={() => onOpen(path)}>
              <IconEdit />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
