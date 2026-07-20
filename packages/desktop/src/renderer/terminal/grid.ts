export function gridColumns(n: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(0, n))));
}

export function equalTracks(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, () => 1 / count);
}

export function gridRowCount(count: number): number {
  if (count <= 0) return 0;
  return Math.ceil(count / gridColumns(count));
}

export function resizeTracks(
  tracks: number[],
  boundary: number,
  deltaFraction: number,
  minFraction: number,
): number[] {
  if (boundary < 0 || boundary >= tracks.length - 1) return tracks.slice();
  const a = tracks[boundary]!;
  const b = tracks[boundary + 1]!;
  const lo = minFraction - a;
  const hi = b - minFraction;
  if (lo > hi) return tracks.slice();
  const delta = Math.max(lo, Math.min(hi, deltaFraction));
  const next = tracks.slice();
  next[boundary] = a + delta;
  next[boundary + 1] = b - delta;
  return next;
}

export function layoutStorageKey(count: number): string {
  return `tc-term-grid-${count}`;
}

export function parseLayout(
  count: number,
  raw: string | null,
): { cols: number[]; rows: number[] } {
  const fallback = { cols: equalTracks(gridColumns(count)), rows: equalTracks(gridRowCount(count)) };
  if (!raw) return fallback;
  const valid = (arr: unknown, len: number): arr is number[] =>
    Array.isArray(arr) &&
    arr.length === len &&
    arr.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0);
  try {
    const parsed = JSON.parse(raw) as { cols?: unknown; rows?: unknown };
    if (valid(parsed.cols, gridColumns(count)) && valid(parsed.rows, gridRowCount(count))) {
      return { cols: parsed.cols, rows: parsed.rows };
    }
    return fallback;
  } catch {
    return fallback;
  }
}
