import { useEffect, useState } from "react";
import { IconChevron, IconFile } from "./Icons";
import { fileIcon, folderIcon } from "./FileIcons";

interface Entry {
  name: string;
  dir: boolean;
}

interface TreeProps {
  root: string | null;
  status: Record<string, string>;
  onOpen: (path: string) => void;
  onContextMenu?: (path: string, isDir: boolean, e: React.MouseEvent) => void;
  onInlineRename?: (path: string, isDir: boolean) => void;
  inlineRename?: { path: string; oldName: string; isDir: boolean } | null;
  renameName?: string;
  onRenameCommit?: (path: string, newName: string) => void;
  onRenameCancel?: () => void;
  refreshNonce?: number;
}

function statusColor(letter: string): string {
  return letter === "A" ? "var(--ok)" : letter === "D" ? "var(--bad)" : "var(--warn)";
}

function rel(root: string, path: string): string {
  return path.slice(root.length + 1).split("\\").join("/");
}

function TreeNode({
  root,
  path,
  name,
  dir,
  depth,
  status,
  onOpen,
  onContextMenu,
  onInlineRename,
  inlineRename,
  renameName,
  onRenameCommit,
  onRenameCancel,
}: {
  root: string;
  path: string;
  name: string;
  dir: boolean;
  depth: number;
  status: Record<string, string>;
  onOpen: (path: string) => void;
  onContextMenu?: (path: string, isDir: boolean, e: React.MouseEvent) => void;
  onInlineRename?: (path: string, isDir: boolean) => void;
  inlineRename?: { path: string; oldName: string; isDir: boolean } | null;
  renameName?: string;
  onRenameCommit?: (path: string, newName: string) => void;
  onRenameCancel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Entry[] | null>(null);
  const isRenaming = inlineRename?.path === path;

  const r = rel(root, path);
  const fileStatus = !dir ? status[r] : undefined;
  const folderChanged = dir && Object.keys(status).some((k) => k.startsWith(`${r}/`));

  async function activate() {
    if (dir) {
      if (children === null) setChildren(await window.api!.listDir(path));
      setOpen((o) => !o);
    } else {
      onOpen(path);
    }
  }

  return (
    <div>
      <div
        className={`tree-row${open ? " tree-row-open" : ""}`}
        style={{ paddingLeft: depth * 12 + 6 }}
        onClick={() => !isRenaming && activate()}
        onDoubleClick={(e) => {
          if (dir) {
            e.preventDefault();
            e.stopPropagation();
            void activate();
          }
        }}
        onContextMenu={(e) => onContextMenu?.(path, !!dir, e)}
      >
        <span className={`caret ${dir && open ? "expanded" : ""}`}>
          {dir ? <IconChevron style={{ transform: open ? "rotate(90deg)" : "none" }} /> : null}
        </span>
        <span className="ficon">{dir ? folderIcon(name, open) : fileIcon(name)}</span>
        {isRenaming ? (
          <input
            className="tree-rename-input"
            autoFocus
            value={renameName ?? name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRenameCommit?.(path, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRenameCommit?.(path, (e.target as HTMLInputElement).value);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onRenameCancel?.();
              }
            }}
            onBlur={(e) => {
              if (isRenaming) onRenameCommit?.(path, e.target.value);
            }}
          />
        ) : (
          <span
            className="fname"
            onDoubleClick={(e) => {
              if (onInlineRename) {
                e.preventDefault();
                e.stopPropagation();
                onInlineRename(path, !!dir);
              }
            }}
          >
            {name}
          </span>
        )}
        {folderChanged ? <span className="changed-dot" /> : null}
        {fileStatus ? (
          <span className="git-badge" style={{ color: statusColor(fileStatus) }}>
            {fileStatus}
          </span>
        ) : null}
      </div>
      {open && children
        ? children.map((c) => (
            <TreeNode
              key={c.name}
              root={root}
              path={`${path}/${c.name}`}
              name={c.name}
              dir={c.dir}
              depth={depth + 1}
              status={status}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
              onInlineRename={onInlineRename}
              inlineRename={inlineRename}
              renameName={renameName}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
            />
          ))
        : null}
    </div>
  );
}

export function FileTree(props: TreeProps) {
  const { root, status, onOpen, onContextMenu, onInlineRename, inlineRename, renameName, onRenameCommit, onRenameCancel, refreshNonce } = props;
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    if (root) void window.api?.listDir(root).then(setEntries);
    else setEntries([]);
  }, [root, refreshNonce]);

  if (!root)
    return (
      <div className="muted tree-empty">
        <IconFile style={{ opacity: 0.6 }} /> No folder open
      </div>
    );
  return (
    <div className="tree">
      {entries.map((e) => (
        <TreeNode
          key={e.name}
          root={root}
          path={`${root}/${e.name}`}
          name={e.name}
          dir={e.dir}
          depth={0}
          status={status}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          onInlineRename={onInlineRename}
          inlineRename={inlineRename}
          renameName={renameName}
          onRenameCommit={onRenameCommit}
          onRenameCancel={onRenameCancel}
        />
      ))}
    </div>
  );
}
