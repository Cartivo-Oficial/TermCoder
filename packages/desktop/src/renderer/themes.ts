export interface ColorTheme {
  id: string;
  name: string;
  dark: boolean;
  accent: string;
  /** Structural palette overrides (accent is handled separately). */
  vars: Record<string, string>;
}

/** The structural CSS variables a color theme can override. */
export const THEME_VARS = ["--bg", "--panel", "--panel2", "--elev", "--elev2", "--border", "--text", "--muted", "--faint"];

export const COLOR_THEMES: ColorTheme[] = [
  { id: "default", name: "Ember", dark: true, accent: "#FF7A45", vars: {} },
  {
    id: "mono",
    name: "Mono",
    dark: true,
    accent: "#e6e6e7",
    vars: { "--bg": "#0b0b0c", "--panel": "#0e0e0f", "--panel2": "#0c0c0d", "--elev": "#161617", "--elev2": "#1d1d1f", "--border": "#1c1c1f", "--text": "#e6e6e7", "--muted": "#8a8a90", "--faint": "#57575d" },
  },
  {
    id: "midnight",
    name: "Midnight",
    dark: true,
    accent: "#6ea8fe",
    vars: { "--bg": "#0a0e1a", "--panel": "#0d1324", "--panel2": "#0b0f1d", "--elev": "#141b30", "--elev2": "#1b2440", "--border": "#1b2238", "--text": "#e6ebf5", "--muted": "#8792ac", "--faint": "#565f78" },
  },
  {
    id: "ocean",
    name: "Ocean",
    dark: true,
    accent: "#38bdf8",
    vars: { "--bg": "#08131a", "--panel": "#0a1a24", "--panel2": "#081620", "--elev": "#0f2531", "--elev2": "#123141", "--border": "#123040", "--text": "#e2f1f7", "--muted": "#7fa0ac", "--faint": "#4f6b76" },
  },
  {
    id: "forest",
    name: "Forest",
    dark: true,
    accent: "#67d98b",
    vars: { "--bg": "#0a140e", "--panel": "#0d1a12", "--panel2": "#0a160f", "--elev": "#132419", "--elev2": "#173021", "--border": "#173020", "--text": "#e4f2e8", "--muted": "#88a894", "--faint": "#546e5d" },
  },
  {
    id: "sunset",
    name: "Sunset",
    dark: true,
    accent: "#fb923c",
    vars: { "--bg": "#160f0c", "--panel": "#1c130f", "--panel2": "#170f0b", "--elev": "#291a13", "--elev2": "#35211a", "--border": "#35211a", "--text": "#f7ece4", "--muted": "#b39a88", "--faint": "#6e5a4c" },
  },
  {
    id: "rose",
    name: "Rosé",
    dark: true,
    accent: "#f472b6",
    vars: { "--bg": "#160a11", "--panel": "#1c0e17", "--panel2": "#170a12", "--elev": "#291526", "--elev2": "#351a30", "--border": "#351a2e", "--text": "#f7e4ef", "--muted": "#b388a4", "--faint": "#6e546a" },
  },
  {
    id: "nord",
    name: "Nord",
    dark: true,
    accent: "#88c0d0",
    vars: { "--bg": "#2e3440", "--panel": "#2b303b", "--panel2": "#2e3440", "--elev": "#3b4252", "--elev2": "#434c5e", "--border": "#3b4252", "--text": "#e5e9f0", "--muted": "#9aa4ba", "--faint": "#6b7488" },
  },
  {
    id: "paper",
    name: "Paper",
    dark: false,
    accent: "#E8632C",
    vars: { "--bg": "#faf9f6", "--panel": "#f2f0ea", "--panel2": "#f7f5f0", "--elev": "#eceae3", "--elev2": "#e2dfd6", "--border": "#e2dfd6", "--text": "#20201c", "--muted": "#6b6a63", "--faint": "#a2a096" },
  },
];
