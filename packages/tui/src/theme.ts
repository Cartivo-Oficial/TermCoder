/** A terminal color palette. Values are hex (truecolor) or named colors. */
export interface Theme {
  /** Brand + interactive accent. */
  primary: string;
  /** Assistant / signature accent. */
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

const base: Theme = {
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
  default: base,
  // A warmer signature: amber brand, coral accent.
  warm: { ...base, primary: "#e3b341", accent: "#ff7b72", user: "#7ee787", code: "#ffa657" },
  // A cooler, mono-leaning take.
  cool: { ...base, primary: "#39c5cf", accent: "#56d4dd", tool: "#39c5cf", code: "#39c5cf" },
};

export function getTheme(name: string): Theme {
  return themes[name] ?? themes.default!;
}
