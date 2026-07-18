export function gridColumns(n: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(0, n))));
}
