import { lookup } from "node:dns/promises";

export function isBlockedHost(ip: string): boolean {
  const addr = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (addr === "::1" || addr === "::") return true;
  if (addr.startsWith("fc") || addr.startsWith("fd") || addr.startsWith("fe80")) return true;
  const v4 = addr.startsWith("::ffff:") ? addr.slice(7) : addr;
  const parts = v4.split(".");
  if (parts.length !== 4) return false;
  const n = parts.map((p) => Number(p));
  if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a, b] = n as [number, number, number, number];
  if (a === 127 || a === 0) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export async function assertFetchAllowed(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Only http and https URLs are allowed: ${url}`);
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHost(host)) {
    throw new Error(`Refusing to fetch a private or loopback address: ${parsed.hostname}`);
  }
  let resolved: Array<{ address: string }>;
  try {
    resolved = await lookup(host, { all: true });
  } catch {
    return;
  }
  for (const entry of resolved) {
    if (isBlockedHost(entry.address)) {
      throw new Error(`Refusing to fetch a private or loopback address: ${parsed.hostname}`);
    }
  }
}
