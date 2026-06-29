import { useEffect, useState } from "react";
import { IconChevron } from "./Icons";
import { fileIcon, folderIcon } from "./FileIcons";

interface Entry {
  name: string;
  dir: boolean;
}

interface TreeProps {
  root: string | null;
  status: Record<string, string>;
  onOpen: (path: string) => void;
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
}: {
  root: string;
  path: string;
  name: string;
  dir: boolean;
  depth: number;
  status: Record<string, string>;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Entry[] | null>(null);

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
      <div className="tree-row" style={{ paddingLeft: depth * 12 + 6 }} onClick={activate}>
        <span className="caret">
          {dir ? <IconChevron style={{ transform: open ? "rotate(90deg)" : "none" }} /> : null}
        </span>
        <span className="ficon">{dir ? folderIcon(name, open) : fileIcon(name)}</span>
        <span className="fname">{name}</span>
        {folderChanged ? <span className="changed-dot" /> : null}
        {fileStatus ? <span className="git-badge" style={{ color: statusColor(fileStatus) }}>{fileStatus}</span> : null}
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
            />
          ))
        : null}
    </div>
  );
}

export function FileTree({ root, status, onOpen }: TreeProps) {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (root) void window.api?.listDir(root).then(setEntries);
    else setEntries([]);
  }, [root]);

  if (!root) return <div className="muted tree-empty">No folder open</div>;
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
        />
      ))}
    </div>
  );
}
