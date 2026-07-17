import { CACHE_KEY as LICENSE_CACHE_KEY } from "@/lib/license";

const SESSION_KEY = "tc-session";

export interface Session {
  provider: string;
  name: string;
  email: string;
  avatar: string;
  token: string;
  sub?: string;
  session?: string;
}

export function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function signOut(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LICENSE_CACHE_KEY);
  location.href = "login.html";
}

declare global {
  interface Window {
    TC_AUTH?: { workerUrl?: string };
  }
}
