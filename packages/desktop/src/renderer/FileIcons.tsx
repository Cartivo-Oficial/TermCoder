import type { ReactNode } from "react";

/** A rounded badge with a short label — a clean stand-in for a file-type logo. */
function Badge({ color, label, fg = "#ffffff" }: { color: string; label: string; fg?: string }) {
  const fs = label.length >= 3 ? 5 : label.length === 2 ? 6.5 : 8;
  return (
    <svg width={16} height={16} viewBox="0 0 16 16">
      <rect width="16" height="16" rx="3.5" fill={color} />
      <text
        x="8"
        y={label.length >= 3 ? 10.4 : 11}
        fontSize={fs}
        fontWeight={800}
        fill={fg}
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

function FolderGlyph({ color, open }: { color: string; open: boolean }) {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round">
      {open ? (
        <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2H6.5a2 2 0 0 0-1.9 1.4L3 17Z" fill={color} fillOpacity={0.12} />
      ) : (
        <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill={color} fillOpacity={0.12} />
      )}
    </svg>
  );
}

function GenericFile() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M14 3v5h5" />
      <path d="M6 3h8l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

const FOLDER_COLOR: Record<string, string> = {
  node_modules: "#6b6b72",
  ".git": "#f1502f",
  ".github": "#9a9aa2",
  ".vscode": "#3b82f6",
  src: "#58a6ff",
  dist: "#e3b341",
  out: "#e3b341",
  build: "#e3b341",
  public: "#39c5cf",
  assets: "#39c5cf",
  ".termcoder": "#b794f6",
  packages: "#56d364",
};

export function folderIcon(name: string, open: boolean): ReactNode {
  return <FolderGlyph color={FOLDER_COLOR[name] ?? "#8a8a90"} open={open} />;
}

const EXACT: Record<string, ReactNode> = {
  "package.json": <Badge color="#cb3837" label="npm" />,
  "package-lock.json": <Badge color="#5a5a61" label="LCK" />,
  "pnpm-lock.yaml": <Badge color="#f9ad00" label="pnpm" fg="#1a1a1d" />,
  "pnpm-workspace.yaml": <Badge color="#f9ad00" label="pnpm" fg="#1a1a1d" />,
  "yarn.lock": <Badge color="#2188b6" label="yarn" />,
  ".gitignore": <Badge color="#f1502f" label="git" />,
  ".gitattributes": <Badge color="#f1502f" label="git" />,
  license: <Badge color="#e3b341" label="©" fg="#1a1a1d" />,
  "components.json": <Badge color="#9a9aa2" label="UI" fg="#1a1a1d" />,
};

const STARTS: Array<[RegExp, ReactNode]> = [
  [/^readme/i, <Badge color="#58a6ff" label="i" />],
  [/^tsconfig.*\.json$/i, <Badge color="#3178c6" label="TS" />],
  [/^vite\.config/i, <Badge color="#646cff" label="V" />],
  [/^vitest\.config/i, <Badge color="#6cc24a" label="V" />],
  [/^eslint\.config|^\.eslintrc/i, <Badge color="#4b32c3" label="ES" />],
  [/^postcss\.config/i, <Badge color="#dd3a0a" label="PC" />],
  [/^tailwind\.config/i, <Badge color="#38bdf8" label="TW" fg="#1a1a1d" />],
  [/^next\.config|^next-env/i, <Badge color="#1a1a1d" label="N" fg="#ffffff" />],
  [/^\.env/i, <Badge color="#e3b341" label="ENV" fg="#1a1a1d" />],
  [/^dockerfile/i, <Badge color="#2496ed" label="DK" />],
];

const EXT: Record<string, ReactNode> = {
  ts: <Badge color="#3178c6" label="TS" />,
  mts: <Badge color="#3178c6" label="TS" />,
  cts: <Badge color="#3178c6" label="TS" />,
  tsx: <Badge color="#3178c6" label="TSX" />,
  js: <Badge color="#f7df1e" label="JS" fg="#1a1a1d" />,
  mjs: <Badge color="#f7df1e" label="JS" fg="#1a1a1d" />,
  cjs: <Badge color="#f7df1e" label="JS" fg="#1a1a1d" />,
  jsx: <Badge color="#f7df1e" label="JSX" fg="#1a1a1d" />,
  json: <Badge color="#e3b341" label="{}" fg="#1a1a1d" />,
  md: <Badge color="#58a6ff" label="MD" />,
  mdx: <Badge color="#fcb32c" label="MD" fg="#1a1a1d" />,
  css: <Badge color="#3b82f6" label="#" />,
  scss: <Badge color="#cf649a" label="#" />,
  html: <Badge color="#e34c26" label="<>" />,
  yml: <Badge color="#cb171e" label="Y" />,
  yaml: <Badge color="#cb171e" label="Y" />,
  toml: <Badge color="#9c4221" label="T" />,
  py: <Badge color="#3572a5" label="PY" />,
  go: <Badge color="#00add8" label="GO" />,
  rs: <Badge color="#dea584" label="RS" fg="#1a1a1d" />,
  sh: <Badge color="#4eaa25" label="SH" />,
  svg: <Badge color="#ffb13b" label="SVG" fg="#1a1a1d" />,
  png: <Badge color="#a371f7" label="IMG" />,
  jpg: <Badge color="#a371f7" label="IMG" />,
  jpeg: <Badge color="#a371f7" label="IMG" />,
  gif: <Badge color="#a371f7" label="IMG" />,
  webp: <Badge color="#a371f7" label="IMG" />,
  ico: <Badge color="#a371f7" label="IMG" />,
  lock: <Badge color="#5a5a61" label="LCK" />,
  txt: <Badge color="#8a8a90" label="TXT" />,
};

export function fileIcon(name: string): ReactNode {
  const lower = name.toLowerCase();
  if (EXACT[lower]) return EXACT[lower];
  for (const [re, node] of STARTS) if (re.test(lower)) return node;
  if (lower.endsWith(".d.ts")) return <Badge color="#3178c6" label="TS" />;
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  return EXT[ext] ?? <GenericFile />;
}
