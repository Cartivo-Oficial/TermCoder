export interface ProviderHealth {
  ok: boolean;
  error?: string;
  until: number;
}

export const HEALTH_TTL_MS = 300_000;

const HEALTH = new Map<string, ProviderHealth>();

export function markProvider(id: string, ok: boolean, error?: string, ttlMs = HEALTH_TTL_MS): void {
  HEALTH.set(id, { ok, error, until: Date.now() + ttlMs });
}

export function providerMarkedBad(id: string): boolean {
  const h = HEALTH.get(id);
  if (!h) return false;
  if (Date.now() > h.until) {
    HEALTH.delete(id);
    return false;
  }
  return !h.ok;
}

export function providerHealthSnapshot(): Record<string, ProviderHealth> {
  const out: Record<string, ProviderHealth> = {};
  for (const [k, v] of HEALTH) out[k] = v;
  return out;
}

export function clearProviderHealth(): void {
  HEALTH.clear();
}
