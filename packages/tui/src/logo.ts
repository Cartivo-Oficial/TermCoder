// A compact block-letter wordmark + a deterministic starfield, for the
// welcome splash. Kept dependency-free and small so it renders instantly.

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

/** Render a word as 5 rows of block characters. Unknown chars become blanks. */
export function wordLines(word: string): string[] {
  const rows = ["", "", "", "", ""];
  for (const ch of word.toUpperCase()) {
    const g = GLYPHS[ch] ?? BLANK;
    for (let r = 0; r < 5; r++) rows[r] += `${g[r]} `;
  }
  return rows.map((r) => r.replace(/\s+$/, ""));
}

/**
 * A sparse, deterministic starfield of `rows` lines, `width` wide. Same seed →
 * same field, so it's stable across renders (and testable).
 */
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

/** A star at a fixed position with a twinkle phase offset. */
export interface Star {
  r: number;
  c: number;
  phase: number;
}

/** Scatter `count` stars over a `width`×`rows` grid, deterministically. */
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

// Intensity cycle — stars stay in place but pulse dim→bright→dim as the frame
// advances, giving a gentle twinkle.
const TWINKLE = ["·", "·", "+", "✦", "*", "✦", "+", "·"];

/** Render stars into `rows` lines for a given animation frame. */
export function renderStars(stars: Star[], width: number, rows: number, frame: number): string[] {
  const grid: string[][] = Array.from({ length: rows }, () => new Array<string>(width).fill(" "));
  for (const st of stars) {
    if (st.r < rows && st.c < width) {
      grid[st.r]![st.c] = TWINKLE[(frame + st.phase) % TWINKLE.length]!;
    }
  }
  return grid.map((row) => row.join(""));
}
