const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const enc = new TextEncoder();

export function b64url(bytes) {
  let s = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(claims, secret) {
  const now = Date.now();
  const payload = { ...claims, iat: now, exp: now + TTL_MS };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token, secret, now = Date.now()) {
  try {
    const trimmed = (token ?? "").trim();
    const dot = trimmed.indexOf(".");
    if (dot <= 0 || dot >= trimmed.length - 1) return null;
    const body = trimmed.slice(0, dot);
    const sig = b64urlDecode(trimmed.slice(dot + 1));
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, enc.encode(body));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!claims.sub || !claims.exp || now > claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
