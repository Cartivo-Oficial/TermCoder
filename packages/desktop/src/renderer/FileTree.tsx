import { useEffect, useState } from "react";
import { IconChevron, IconFile, IconFolder } from "./Icons";

interface Entry {
  name: string;
  dir: boolean;
}

interface TreeProps {
  root: string | null;
  status: Record<string, string>;
  onOpen: (path: string) => void;
}

const EXT_COLOR: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6", js: "#e3b341", jsx: "#e3b341", mjs: "#e3b341", cjs: "#e3b341",
  json: "#e3b341", md: "#58a6ff", css: "#56d4dd", scss: "#56d4dd", html: "#ff7b72",
  py: "#3572A5", go: "#39c5cf", rs: "#ff7b72", yml: "#cb9bff", yaml: "#cb9bff", env: "#56d364",
};

function fileColor(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  return EXT_COLOR[ext] ?? "var(--muted)";
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
        <span className="ficon" style={{ color: dir ? "var(--muted)" : fileColor(name) }}>
          {dir ? <IconFolder /> : <IconFile />}
        </span>
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
