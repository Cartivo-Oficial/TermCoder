export function relativeTime(then: number, now: number): string {
  const diff = now - then;
  const M = 60_000;
  const H = 60 * M;
  const D = 24 * H;
  if (diff < M) return "agora";
  if (diff < H) return `${Math.floor(diff / M)} min`;
  if (diff < D) return `${Math.floor(diff / H)} h`;
  if (diff < 2 * D) return "ontem";
  return `${Math.floor(diff / D)} d`;
}
