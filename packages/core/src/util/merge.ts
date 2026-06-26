type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Deep-merge plain objects. Later sources win. Arrays and scalars are replaced,
 * not merged. Used to layer config sources (defaults < global < project < env).
 */
export function deepMerge<T extends Plain>(...sources: Array<Partial<T> | undefined>): T {
  const out: Plain = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      const existing = out[key];
      if (isPlainObject(existing) && isPlainObject(value)) {
        out[key] = deepMerge(existing, value);
      } else {
        out[key] = value;
      }
    }
  }
  return out as T;
}
