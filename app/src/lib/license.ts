import type { Session } from "@/lib/session";

const CACHE_KEY = "tc-license";

export type LicenseState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "active"; key: string; email: string; expires: number }
  | { status: "error"; message: string };

export function cachedLicense(): LicenseState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as LicenseState) : null;
  } catch {
    return null;
  }
}

export function cacheLicense(state: LicenseState): void {
  if (state.status !== "active") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(state));
}

export async function fetchLicense(session: Session): Promise<LicenseState> {
  const worker = window.TC_AUTH?.workerUrl;
  if (!worker) return { status: "error", message: "Sign-in isn't configured yet." };
  if (!session.session) return { status: "error", message: "Please sign in again to see your licence." };

  try {
    const res = await fetch(worker.replace(/\/$/, "") + "/license", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: session.session }),
    });
    const body = await res.json();

    if (res.status === 401) return { status: "error", message: "Please sign in again to see your licence." };
    if (res.status === 503) return { status: "error", message: "Checkout isn't switched on yet." };
    if (!res.ok) return { status: "error", message: "Couldn't reach the licence service — your key still works offline." };
    if (!body.active) return { status: "none" };

    const state: LicenseState = { status: "active", key: body.key, email: body.email, expires: body.expires };
    cacheLicense(state);
    return state;
  } catch {
    return { status: "error", message: "Couldn't reach the licence service — your key still works offline." };
  }
}
