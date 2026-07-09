export interface Theme {
  primary: string;
  accent: string;
  user: string;
  assistant: string;
  tool: string;
  code: string;
  running: string;
  success: string;
  error: string;
  muted: string;
  border: string;
}

const mono: Theme = {
  primary: "#eceff6",
  accent: "#7aa2f7",
  user: "#e8e8ea",
  assistant: "#c8c8cd",
  tool: "#b6b6bc",
  code: "#9a9aa0",
  running: "#e0af68",
  success: "#7bd88f",
  error: "#f7768e",
  muted: "#6f6f77",
  border: "#2a2a2e",
};

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

function accented(accent: string, running: string): Theme {
  return { ...mono, primary: "#eceff6", accent, running };
}

export const themes: Record<string, Theme> = {
  default: mono,
  mono,
  vivid,
  warm: { ...vivid, primary: "#e3b341", accent: "#ff7b72", code: "#ffa657" },
  ember: accented("#ff7a45", "#e0af68"),
  ocean: accented("#38bdf8", "#22d3ee"),
  forest: accented("#4ade80", "#a3e635"),
  rose: accented("#fb7185", "#f472b6"),
  amber: accented("#fbbf24", "#f59e0b"),
  violet: accented("#a78bfa", "#c084fc"),
  nord: accented("#88c0d0", "#81a1c1"),
};

export function getTheme(name: string): Theme {
  return themes[name] ?? themes.default!;
}
