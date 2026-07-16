const SESSION_KEY = "tc-session";

export interface Session {
  provider: string;
  name: string;
  email: string;
  avatar: string;
  token: string;
  sub: string;
  session: string;
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
  location.href = "login.html";
}
