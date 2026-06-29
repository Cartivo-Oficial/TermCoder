import type { ReactNode } from "react";

/* Authentic-looking, hand-drawn SVG logos for common file types. */

const Tile = ({ bg, label, fg = "#fff" }: { bg: string; label: string; fg?: string }) => {
  const fs = label.length >= 3 ? 5 : label.length === 2 ? 7 : 9;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect width="16" height="16" rx="3" fill={bg} />
      <text x="8" y={label.length >= 3 ? 10.5 : 11} fontSize={fs} fontWeight="800" fill={fg} textAnchor="middle" fontFamily="Segoe UI, system-ui, sans-serif">
        {label}
      </text>
    </svg>
  );
};

const React_ = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="2" fill="#61dafb" />
    <g stroke="#61dafb" strokeWidth="1.1" fill="none">
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </g>
  </svg>
);

const Git = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#f05133">
    <path d="M23 11 13 1a1.6 1.6 0 0 0-2.3 0L8.6 3.1l2.6 2.6a1.9 1.9 0 0 1 2.4 2.4l2.5 2.5a1.9 1.9 0 1 1-1.1 1l-2.3-2.3v6a1.9 1.9 0 1 1-1.6-.1V8.9a1.9 1.9 0 0 1-1-2.5L8.5 3.8 1 11.3a1.6 1.6 0 0 0 0 2.3l10 10a1.6 1.6 0 0 0 2.3 0L23 13.3a1.6 1.6 0 0 0 0-2.3Z" />
  </svg>
);

const Markdown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="1.6">
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M5 15V9l3 3 3-3v6" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M16 9v6m0 0 2-2m-2 2-2-2" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

const Html = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path d="M4 3h16l-1.5 16L12 21l-6.5-2L4 3Z" fill="#e34c26" />
    <path d="M12 5v14l5-1.5L18 6Z" fill="#ef652a" />
    <path d="M8 8h8l-.3 3H9.2l.15 2H15l-.3 3.2L12 17l-2.5-.7-.15-1.6" fill="#fff" />
  </svg>
);

const Css = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path d="M4 3h16l-1.5 16L12 21l-6.5-2L4 3Z" fill="#1572b6" />
    <path d="M12 5v14l5-1.5L18 6Z" fill="#33a9dc" />
    <path d="M8 8h8l-.3 3H9.2l.15 2H15l-.3 3.2L12 17l-2.5-.7-.15-1.6" fill="#fff" />
  </svg>
);

const Python = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path d="M12 2c-4 0-3.7 1.7-3.7 1.7v1.8h3.8v.6H6.6S4 5.9 4 10s2.3 3.9 2.3 3.9h1.3v-1.9s-.07-2.3 2.2-2.3h3.8s2.1 0 2.1-2.1V4S16.1 2 12 2ZM9.9 3.2a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Z" fill="#3572a5" />
    <path d="M12 22c4 0 3.7-1.7 3.7-1.7v-1.8h-3.8v-.6h5.5S20 18.1 20 14s-2.3-3.9-2.3-3.9h-1.3v1.9s.07 2.3-2.2 2.3H10.4s-2.1 0-2.1 2.1V20S7.9 22 12 22Zm2.1-1.2a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Z" fill="#ffd43b" />
  </svg>
);

const Vite = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path d="M22 5 12.5 22a.6.6 0 0 1-1 0L2 5a.6.6 0 0 1 .6-.9l9.4 1.7 9.4-1.7a.6.6 0 0 1 .6.9Z" fill="#41d1ff" />
    <path d="M16.5 2 9.7 3.3a.3.3 0 0 0-.25.3l-.4 7 2-.4-.55 2.6 2.9-5.6-2 .4.55-2.7-1 .2Z" fill="#bd34fe" />
  </svg>
);

const Eslint = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 2 21 7v10l-9 5-9-5V7Z" fill="#4b32c3" />
    <path d="M12 6.5 16.5 9v6L12 17.5 7.5 15V9Z" fill="none" stroke="#8080f2" strokeWidth="1.2" />
    <circle cx="12" cy="12" r="1.6" fill="#fff" />
  </svg>
);

const Image = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a371f7" strokeWidth="1.6">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9" r="1.5" fill="#a371f7" stroke="none" />
    <path d="m4 17 5-5 4 4 3-3 4 4" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

const Lock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a9aa2" strokeWidth="1.7">
    <rect x="5" y="10" width="14" height="10" rx="2" fill="#9a9aa2" fillOpacity="0.15" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const License = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e3b341" strokeWidth="1.5">
    <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5" />
    <circle cx="12" cy="13" r="2.2" />
    <path d="M10.5 15 9 19l3-1.5L15 19l-1.5-4" strokeLinejoin="round" />
  </svg>
);

const Readme = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="1.5">
    <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H11v16H5.5A2.5 2.5 0 0 0 3 21.5Z" />
    <path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H13v16h5.5a2.5 2.5 0 0 1 2.5 2.5Z" />
  </svg>
);

const Cog = (c: string) => () =>
  (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );

const GenericFile = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M14 3v5h5" />
    <path d="M6 3h8l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
  </svg>
);

function FolderGlyph({ color, open }: { color: string; open: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={color} fillOpacity="0.85">
      {open ? (
        <path d="M3 7a2 2 0 0 1 2-2h3.6l1.7 2H19a2 2 0 0 1 2 2v.5H7.2a2 2 0 0 0-1.9 1.4L3 18Z" />
      ) : (
        <path d="M3 7a2 2 0 0 1 2-2h3.6l1.7 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      )}
    </svg>
  );
}

const FOLDER_COLOR: Record<string, string> = {
  node_modules: "#6b6b72",
  ".git": "#f05133",
  ".github": "#6e7681",
  ".vscode": "#3b82f6",
  src: "#54aeff",
  dist: "#e3b341",
  out: "#e3b341",
  build: "#e3b341",
  public: "#39c5cf",
  assets: "#39c5cf",
  components: "#54aeff",
  ".termcoder": "#b794f6",
  packages: "#56d364",
  ".next": "#888",
};

export function folderIcon(name: string, open: boolean): ReactNode {
  return <FolderGlyph color={FOLDER_COLOR[name] ?? "#7d8590"} open={open} />;
}

const EXACT: Record<string, () => ReactNode> = {
  "package.json": () => <Tile bg="#cb3837" label="npm" />,
  "package-lock.json": Lock,
  "pnpm-lock.yaml": Lock,
  "yarn.lock": Lock,
  ".gitignore": Git,
  ".gitattributes": Git,
  ".gitmodules": Git,
  license: License,
  "license.md": License,
  "components.json": Cog("#cbd5e1"),
};

const STARTS: Array<[RegExp, () => ReactNode]> = [
  [/^readme/i, Readme],
  [/^tsconfig.*\.json$/i, () => <Tile bg="#3178c6" label="TS" />],
  [/^vite\.config/i, Vite],
  [/^vitest\.config/i, () => <Tile bg="#6cc24a" label="V" />],
  [/^eslint\.config|^\.eslintrc/i, Eslint],
  [/^postcss\.config/i, () => <Tile bg="#dd3a0a" label="PC" />],
  [/^tailwind\.config/i, () => <Tile bg="#38bdf8" label="TW" fg="#06283d" />],
  [/^next\.config|^next-env/i, () => <Tile bg="#111" label="N" />],
  [/^\.env/i, Cog("#e3b341")],
  [/^dockerfile/i, () => <Tile bg="#2496ed" label="DK" />],
  [/^\.prettier/i, () => <Tile bg="#56b3b4" label="P" fg="#1a1a1d" />],
];

const EXT: Record<string, () => ReactNode> = {
  ts: () => <Tile bg="#3178c6" label="TS" />,
  mts: () => <Tile bg="#3178c6" label="TS" />,
  cts: () => <Tile bg="#3178c6" label="TS" />,
  tsx: React_,
  jsx: React_,
  js: () => <Tile bg="#f7df1e" label="JS" fg="#1a1a1d" />,
  mjs: () => <Tile bg="#f7df1e" label="JS" fg="#1a1a1d" />,
  cjs: () => <Tile bg="#f7df1e" label="JS" fg="#1a1a1d" />,
  json: () => <Tile bg="#e3b341" label="{}" fg="#1a1a1d" />,
  md: Markdown,
  mdx: Markdown,
  css: Css,
  scss: Css,
  html: Html,
  htm: Html,
  yml: () => <Tile bg="#cb171e" label="YML" />,
  yaml: () => <Tile bg="#cb171e" label="YML" />,
  toml: () => <Tile bg="#9c4221" label="TOML" />,
  py: Python,
  go: () => <Tile bg="#00add8" label="GO" />,
  rs: () => <Tile bg="#dea584" label="RS" fg="#1a1a1d" />,
  sh: () => <Tile bg="#4eaa25" label="SH" />,
  svg: Image,
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
  webp: Image,
  ico: Image,
  lock: Lock,
  txt: () => <Tile bg="#6b6b72" label="TXT" />,
};

export function fileIcon(name: string): ReactNode {
  const lower = name.toLowerCase();
  if (EXACT[lower]) return EXACT[lower]!();
  for (const [re, fn] of STARTS) if (re.test(lower)) return fn();
  if (lower.endsWith(".d.ts")) return <Tile bg="#3178c6" label="TS" />;
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  return (EXT[ext] ?? GenericFile)();
}
