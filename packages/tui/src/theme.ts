/** A terminal color palette. Values are hex (truecolor) or named colors. */
export interface Theme {
  /** Brand + interactive accent. */
  primary: string;
  /** Assistant / signature accent (also code keywords). */
  accent: string;
  user: string;
  assistant: string;
  tool: string;
  /** Inline code / values. */
  code: string;
  running: string;
  success: string;
  error: string;
  muted: string;
  /** Hairlines and box borders. */
  border: string;
}

// Clean monochrome: grayscale chrome, semantic color only for diffs/status.
const mono: Theme = {
  primary: "#ffffff",
  accent: "#ffffff",
  user: "#e8e8ea",
  assistant: "#c8c8cd",
  tool: "#b6b6bc",
  code: "#9a9aa0",
  running: "#7a7a80",
  success: "#4ade80",
  error: "#f87171",
  muted: "#7a7a80",
  border: "#2a2a2e",
};

// Optional colorful palettes (use `/theme vivid`).
const vivid: Theme = {
  primary: "#58a6ff",
  accent: "#b794f6",
  user: "#7ee787",
  assistant: "#e6edf3",
  tool: "#e3b341",
  code: "#79c0ff",
  running: "#58a6ff",
  success: "#56d364",
  error: "#f85149",
  muted: "#8b949e",
  border: "#30363d",
};

export const themes: Record<string, Theme> = {
  default: mono,
  mono,
  vivid,
  warm: { ...vivid, primary: "#e3b341", accent: "#ff7b72", code: "#ffa657" },
};

export function getTheme(name: string): Theme {
  return themes[name] ?? themes.default!;
}
