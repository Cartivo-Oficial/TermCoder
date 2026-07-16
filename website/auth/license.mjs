import { b64url, b64urlDecode } from "./session.mjs";

const enc = new TextEncoder();

function pemToPkcs8(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  return b64urlDecode(body.replace(/\+/g, "-").replace(/\//g, "_"));
}

export async function signLicenseKey(claims, privateKeyPem) {
  if (!claims.email) throw new Error("email required");
  const payload = { email: claims.email, tier: "pro", issued: claims.issued };
  if (claims.name) payload.name = claims.name;
  if (claims.expires) payload.expires = claims.expires;

  const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(privateKeyPem), { name: "Ed25519" }, false, ["sign"]);
  const bytes = enc.encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("Ed25519", key, bytes);
  return `${b64url(bytes)}.${b64url(sig)}`;
}
