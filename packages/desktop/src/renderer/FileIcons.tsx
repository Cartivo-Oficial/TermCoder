import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  SiTypescript,
  SiJavascript,
  SiReact,
  SiPython,
  SiHtml5,
  SiCss,
  SiSass,
  SiMarkdown,
  SiYaml,
  SiToml,
  SiGo,
  SiRust,
  SiGnubash,
  SiVite,
  SiVitest,
  SiEslint,
  SiPrettier,
  SiTailwindcss,
  SiPostcss,
  SiNextdotjs,
  SiDocker,
  SiGit,
  SiNpm,
  SiPnpm,
  SiYarn,
  SiDotenv,
  SiCplusplus,
  SiC,
  SiRuby,
  SiPhp,
  SiVuedotjs,
  SiSvelte,
  SiJson,
  SiGraphql,
} from "react-icons/si";
import {
  FaImage,
  FaLock,
  FaFile,
  FaFileAlt,
  FaBook,
  FaAward,
  FaFolder,
  FaFolderOpen,
  FaDatabase,
} from "react-icons/fa";

/* Real brand logos (Simple Icons via react-icons) for common file types, plus
   filled FontAwesome glyphs for folders/generic files so every icon shares the
   same visual weight. Brand colors on file types; folders use muted tones. */

const NEUTRAL = "#8b8b93";

/** Blend a brand hex toward neutral gray so nothing screams on the dark tree. */
function mute(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const g = 0x8b;
  const blend = (c: number) => Math.round(c * 0.72 + g * 0.28);
  const r = blend((n >> 16) & 0xff);
  const gg = blend((n >> 8) & 0xff);
  const b = blend(n & 0xff);
  return `#${((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1)}`;
}

function readable(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum <= 0.62) return hex;
  const k = 0.62 / lum;
  const d = (c: number) => Math.round(c * k);
  return `#${((1 << 24) | (d(r) << 16) | (d(g) << 8) | d(b)).toString(16).slice(1)}`;
}

const ico =
  (Icon: IconType, color?: string): (() => ReactNode) =>
  () =>
    <Icon size={15} color={color ? readable(color) : color} />;

const FOLDER_COLOR: Record<string, string> = {
  node_modules: "#6b6b72",
  ".git": "#f05032",
  ".github": "#6e7681",
  ".vscode": "#3b82f6",
  src: "#54aeff",
  dist: "#e3b341",
  out: "#e3b341",
  build: "#e3b341",
  release: "#e3b341",
  public: "#39c5cf",
  assets: "#39c5cf",
  images: "#a371f7",
  components: "#54aeff",
  ".termcoder": "#b794f6",
  packages: "#56d364",
  ".next": NEUTRAL,
};

export function folderIcon(name: string, open: boolean): ReactNode {
  const color = mute(FOLDER_COLOR[name] ?? "#7d8590");
  return open ? <FaFolderOpen size={14} color={color} /> : <FaFolder size={14} color={color} />;
}

const GenericFile = () => <FaFile size={14} color="var(--muted)" />;

const EXACT: Record<string, () => ReactNode> = {
  "package.json": ico(SiNpm, "#cb3837"),
  "package-lock.json": ico(SiNpm, "#cb3837"),
  "pnpm-lock.yaml": ico(SiPnpm, "#f69220"),
  "pnpm-workspace.yaml": ico(SiPnpm, "#f69220"),
  "yarn.lock": ico(SiYarn, "#2c8ebb"),
  ".gitignore": ico(SiGit, "#f05032"),
  ".gitattributes": ico(SiGit, "#f05032"),
  ".gitmodules": ico(SiGit, "#f05032"),
  license: ico(FaAward, "#e3b341"),
  "license.md": ico(FaAward, "#e3b341"),
};

const STARTS: Array<[RegExp, () => ReactNode]> = [
  [/^readme/i, ico(FaBook, "#58a6ff")],
  [/^tsconfig.*\.json$/i, ico(SiTypescript, "#3178c6")],
  [/^vite\.config/i, ico(SiVite, "#646cff")],
  [/^vitest\.config/i, ico(SiVitest, "#6e9f18")],
  [/^eslint\.config|^\.eslintrc/i, ico(SiEslint, "#8884ff")],
  [/^postcss\.config/i, ico(SiPostcss, "#dd3a0a")],
  [/^tailwind\.config/i, ico(SiTailwindcss, "#06b6d4")],
  [/^next\.config|^next-env/i, ico(SiNextdotjs, NEUTRAL)],
  [/^\.env/i, ico(SiDotenv, "#ecd53f")],
  [/^dockerfile|^\.dockerignore/i, ico(SiDocker, "#2496ed")],
  [/^\.prettier/i, ico(SiPrettier, "#f7b93e")],
];

const EXT: Record<string, () => ReactNode> = {
  ts: ico(SiTypescript, "#3178c6"),
  mts: ico(SiTypescript, "#3178c6"),
  cts: ico(SiTypescript, "#3178c6"),
  tsx: ico(SiReact, "#61dafb"),
  jsx: ico(SiReact, "#61dafb"),
  js: ico(SiJavascript, "#f7df1e"),
  mjs: ico(SiJavascript, "#f7df1e"),
  cjs: ico(SiJavascript, "#f7df1e"),
  json: ico(SiJson, NEUTRAL),
  md: ico(SiMarkdown, NEUTRAL),
  mdx: ico(SiMarkdown, NEUTRAL),
  css: ico(SiCss, "#1572b6"),
  scss: ico(SiSass, "#cc6699"),
  sass: ico(SiSass, "#cc6699"),
  html: ico(SiHtml5, "#e34f26"),
  htm: ico(SiHtml5, "#e34f26"),
  vue: ico(SiVuedotjs, "#4fc08d"),
  svelte: ico(SiSvelte, "#ff3e00"),
  yml: ico(SiYaml, "#cb171e"),
  yaml: ico(SiYaml, "#cb171e"),
  toml: ico(SiToml, "#9c4121"),
  py: ico(SiPython, "#3776ab"),
  go: ico(SiGo, "#00add8"),
  rs: ico(SiRust, "#dea584"),
  rb: ico(SiRuby, "#cc342d"),
  php: ico(SiPhp, "#777bb4"),
  c: ico(SiC, "#a8b9cc"),
  h: ico(SiC, "#a8b9cc"),
  cpp: ico(SiCplusplus, "#00599c"),
  cc: ico(SiCplusplus, "#00599c"),
  cxx: ico(SiCplusplus, "#00599c"),
  hpp: ico(SiCplusplus, "#00599c"),
  sh: ico(SiGnubash, "#4eaa25"),
  bash: ico(SiGnubash, "#4eaa25"),
  zsh: ico(SiGnubash, "#4eaa25"),
  sql: ico(FaDatabase, "#e38c00"),
  java: ico(FaFileAlt, "#ea2d2e"),
  kt: ico(FaFileAlt, "#7f52ff"),
  swift: ico(FaFileAlt, "#f05138"),
  graphql: ico(SiGraphql, "#e10098"),
  svg: ico(FaImage, "#a371f7"),
  png: ico(FaImage, "#a371f7"),
  jpg: ico(FaImage, "#a371f7"),
  jpeg: ico(FaImage, "#a371f7"),
  gif: ico(FaImage, "#a371f7"),
  webp: ico(FaImage, "#a371f7"),
  ico: ico(FaImage, "#a371f7"),
  lock: ico(FaLock, "#9a9aa2"),
  txt: ico(FaFileAlt, "#9a9aa2"),
};

export function fileIcon(name: string): ReactNode {
  const lower = name.toLowerCase();
  if (EXACT[lower]) return EXACT[lower]!();
  for (const [re, fn] of STARTS) if (re.test(lower)) return fn();
  if (lower.endsWith(".d.ts")) return ico(SiTypescript, "#3178c6")();
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  return (EXT[ext] ?? GenericFile)();
}
