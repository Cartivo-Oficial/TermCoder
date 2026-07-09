
const GLYPHS: Record<string, string[]> = {
  T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  R: ["████ ", "█   █", "████ ", "█  █ ", "█   █"],
  M: ["█   █", "██ ██", "█ █ █", "█   █", "█   █"],
  C: [" ████", "█    ", "█    ", "█    ", " ████"],
  O: [" ███ ", "█   █", "█   █", "█   █", " ███ "],
  D: ["████ ", "█   █", "█   █", "█   █", "████ "],
  X: ["█   █", " █ █ ", "  █  ", " █ █ ", "█   █"],
  P: ["████ ", "█   █", "████ ", "█    ", "█    "],
  L: ["█    ", "█    ", "█    ", "█    ", "█████"],
};
const BLANK = ["     ", "     ", "     ", "     ", "     "];

export function wordLines(word: string): string[] {
  const rows = ["", "", "", "", ""];
  for (const ch of word.toUpperCase()) {
    const g = GLYPHS[ch] ?? BLANK;
    for (let r = 0; r < 5; r++) rows[r] += `${g[r]} `;
  }
  return rows.map((r) => r.replace(/\s+$/, ""));
}

export function starfield(width: number, rows: number, seed = 1): string[] {
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const glyphs = "·+✦*";
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < width; c++) {
      line += rand() < 0.05 ? glyphs[Math.floor(rand() * glyphs.length)] : " ";
    }
    out.push(line);
  }
  return out;
}

export interface Star {
  r: number;
  c: number;
  phase: number;
}

export function makeStars(width: number, rows: number, count: number, seed = 1): Star[] {
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      r: Math.floor(rand() * rows),
      c: Math.floor(rand() * width),
      phase: Math.floor(rand() * TWINKLE.length),
    });
  }
  return stars;
}

const TWINKLE = ["·", "·", "+", "✦", "*", "✦", "+", "·"];

export function renderStars(stars: Star[], width: number, rows: number, frame: number): string[] {
  const grid: string[][] = Array.from({ length: rows }, () => new Array<string>(width).fill(" "));
  for (const st of stars) {
    if (st.r < rows && st.c < width) {
      grid[st.r]![st.c] = TWINKLE[(frame + st.phase) % TWINKLE.length]!;
    }
  }
  return grid.map((row) => row.join(""));
}
