import { useEffect, useState } from "react";

interface Entry {
  name: string;
  dir: boolean;
}

const EXT_COLOR: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#e3b341",
  jsx: "#e3b341",
  mjs: "#e3b341",
  cjs: "#e3b341",
  json: "#e3b341",
  md: "#58a6ff",
  css: "#56d4dd",
  scss: "#56d4dd",
  html: "#ff7b72",
  py: "#3572A5",
  go: "#39c5cf",
  rs: "#ff7b72",
  yml: "#a371f7",
  yaml: "#a371f7",
  lock: "#8b949e",
  env: "#56d364",
};

function fileColor(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  return EXT_COLOR[ext] ?? "#8b949e";
}

function TreeNode({ path, name, dir, depth }: { path: string; name: string; dir: boolean; depth: number }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Entry[] | null>(null);

  async function toggle() {
    if (!dir) return;
    if (children === null) {
      const list = await window.api!.listDir(path);
      setChildren(list);
    }
    setOpen((o) => !o);
  }

  return (
    <div>
      <div className="tree-row" style={{ paddingLeft: depth * 12 + 8 }} onClick={toggle}>
        <span className="caret">{dir ? (open ? "▾" : "▸") : ""}</span>
        <span className="ficon" style={{ color: dir ? "#8b949e" : fileColor(name) }}>
          {dir ? "▣" : "▪"}
        </span>
        <span className="fname">{name}</span>
      </div>
      {open && children
        ? children.map((c) => (
            <TreeNode key={c.name} path={`${path}/${c.name}`} name={c.name} dir={c.dir} depth={depth + 1} />
          ))
        : null}
    </div>
  );
}

export function FileTree({ root }: { root: string | null }) {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (root) void window.api?.listDir(root).then(setEntries);
    else setEntries([]);
  }, [root]);

  if (!root) return <div className="muted tree-empty">No folder open</div>;
  return (
    <div className="tree">
      {entries.map((e) => (
        <TreeNode key={e.name} path={`${root}/${e.name}`} name={e.name} dir={e.dir} depth={0} />
      ))}
    </div>
  );
}
