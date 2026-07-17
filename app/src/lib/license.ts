import type { Session } from "@/lib/session";

export const CACHE_KEY = "tc-license";

export type LicenseState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "no-email" }
  | { status: "active"; key: string; email: string; expires: number }
  | { status: "error"; message: string };

interface CacheEntry {
  sub: string;
  state: LicenseState;
}

export function cachedLicense(sub: string): LicenseState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry || entry.sub !== sub) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.state;
  } catch {
    return null;
  }
}

export function cacheLicense(state: LicenseState, sub: string): void {
  if (state.status === "none") {
    localStorage.removeItem(CACHE_KEY);
    return;
  }
  if (state.status !== "active") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify({ sub, state } satisfies CacheEntry));
}

export async function fetchLicense(session: Session): Promise<LicenseState> {
  const worker = window.TC_AUTH?.workerUrl;
  if (!worker) return { status: "error", message: "Sign-in isn't configured yet." };
  if (!session.session) return { status: "error", message: "Please sign in again to see your licence." };

  const sub = session.sub ?? "";
  const unreachableMessage = (): string => {
    const cached = cachedLicense(sub);
    return cached && cached.status === "active"
      ? "Couldn't reach the licence service — your key still works offline."
      : "Couldn't reach the licence service.";
  };

  try {
    const res = await fetch(worker.replace(/\/$/, "") + "/license", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: session.session }),
    });

    if (res.status === 401) return { status: "error", message: "Please sign in again to see your licence." };
    if (res.status === 503) return { status: "error", message: "Checkout isn't switched on yet." };
    if (!res.ok) return { status: "error", message: unreachableMessage() };

    const body = await res.json();
    if (!body.active) {
      if (body.reason === "no-email") return { status: "no-email" };
      cacheLicense({ status: "none" }, sub);
      return { status: "none" };
    }

    const state: LicenseState = { status: "active", key: body.key, email: body.email, expires: body.expires };
    cacheLicense(state, sub);
    return state;
  } catch {
    return { status: "error", message: unreachableMessage() };
  }
}
