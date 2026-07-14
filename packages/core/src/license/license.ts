import { createPublicKey, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { configFile } from "../util/paths";

export const PRO_PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MCowBQYDK2VwAyEAJysWJNL0V46+EV+YufYiMOOULa+UjmnmFLs/xPkOHHE=\n" +
  "-----END PUBLIC KEY-----\n";

export interface LicenseInfo {
  active: boolean;
  tier?: "pro";
  email?: string;
  name?: string;
  expires?: number;
  reason?: string;
}

interface LicensePayload {
  email: string;
  tier: "pro";
  issued: number;
  expires?: number;
  name?: string;
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function verifyLicenseKey(key: string, publicKeyPem: string = PRO_PUBLIC_KEY): LicenseInfo {
  try {
    const trimmed = (key ?? "").trim();
    const dot = trimmed.indexOf(".");
    if (dot <= 0 || dot >= trimmed.length - 1) return { active: false, reason: "malformed key" };
    const payloadBytes = b64urlDecode(trimmed.slice(0, dot));
    const sig = b64urlDecode(trimmed.slice(dot + 1));
    const ok = verify(null, payloadBytes, createPublicKey(publicKeyPem), sig);
    if (!ok) return { active: false, reason: "bad signature" };
    const payload = JSON.parse(payloadBytes.toString("utf8")) as LicensePayload;
    if (payload.tier !== "pro" || !payload.email) return { active: false, reason: "bad payload" };
    if (payload.expires && Date.now() > payload.expires) {
      return { active: false, tier: "pro", email: payload.email, expires: payload.expires, reason: "expired" };
    }
    return { active: true, tier: "pro", email: payload.email, name: payload.name, expires: payload.expires };
  } catch {
    return { active: false, reason: "invalid key" };
  }
}

function licensePath(env: NodeJS.ProcessEnv): string {
  return configFile("license.json", env);
}

export function licenseStatus(
  env: NodeJS.ProcessEnv = process.env,
  publicKeyPem: string = PRO_PUBLIC_KEY,
): LicenseInfo {
  try {
    const path = licensePath(env);
    if (!existsSync(path)) return { active: false };
    const { key } = JSON.parse(readFileSync(path, "utf8")) as { key?: string };
    if (!key) return { active: false };
    return verifyLicenseKey(key, publicKeyPem);
  } catch {
    return { active: false };
  }
}

export function saveLicenseKey(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
  publicKeyPem: string = PRO_PUBLIC_KEY,
): LicenseInfo {
  const info = verifyLicenseKey(key, publicKeyPem);
  if (!info.active) return info;
  const path = licensePath(env);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ key: key.trim() }, null, 2), "utf8");
  return info;
}

export function clearLicense(env: NodeJS.ProcessEnv = process.env): void {
  try {
    rmSync(licensePath(env));
  } catch {
    void 0;
  }
}
