export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10) + "k";
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return Math.round(ms) + "ms";
  const s = ms / 1000;
  if (s < 60) return Math.round(s * 10) / 10 + "s";
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return m + "m " + String(rem).padStart(2, "0") + "s";
}
