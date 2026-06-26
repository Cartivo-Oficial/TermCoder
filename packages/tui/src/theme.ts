/** A terminal color palette. Values are any color Ink/chalk accepts. */
export interface Theme {
  primary: string;
  accent: string;
  user: string;
  assistant: string;
  toolTitle: string;
  running: string;
  success: string;
  error: string;
  muted: string;
}

const base: Theme = {
  primary: "cyan",
  accent: "magenta",
  user: "green",
  assistant: "white",
  toolTitle: "yellow",
  running: "cyan",
  success: "green",
  error: "red",
  muted: "gray",
};

export const themes: Record<string, Theme> = {
  default: base,
  dark: { ...base, primary: "blueBright", accent: "cyanBright" },
  warm: { ...base, primary: "yellow", accent: "redBright", user: "greenBright" },
};

export function getTheme(name: string): Theme {
  return themes[name] ?? themes.default!;
}
