import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearLicense, licenseStatus, saveLicenseKey, verifyLicenseKey } from "./license";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" }).toString();

const b64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function issue(payload: Record<string, unknown>): string {
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const s = sign(null, bytes, privateKey);
  return `${b64url(bytes)}.${b64url(s)}`;
}

describe("verifyLicenseKey", () => {
  it("accepts a well-formed pro key", () => {
    const key = issue({ email: "t@x.edu", tier: "pro", issued: 1 });
    const info = verifyLicenseKey(key, PUB);
    expect(info.active).toBe(true);
    expect(info.email).toBe("t@x.edu");
    expect(info.tier).toBe("pro");
  });

  it("rejects a tampered signature", () => {
    const key = issue({ email: "t@x.edu", tier: "pro", issued: 1 });
    const info = verifyLicenseKey(key.slice(0, -4) + "AAAA", PUB);
    expect(info.active).toBe(false);
    expect(info.reason).toBe("bad signature");
  });

  it("rejects a key signed by a different private key", () => {
    const other = generateKeyPairSync("ed25519");
    const bytes = Buffer.from(JSON.stringify({ email: "t@x.edu", tier: "pro", issued: 1 }), "utf8");
    const s = sign(null, bytes, other.privateKey);
    const key = `${b64url(bytes)}.${b64url(s)}`;
    expect(verifyLicenseKey(key, PUB).active).toBe(false);
  });

  it("rejects an expired key", () => {
    const key = issue({ email: "t@x.edu", tier: "pro", issued: 1, expires: 1000 });
    const info = verifyLicenseKey(key, PUB);
    expect(info.active).toBe(false);
    expect(info.reason).toBe("expired");
  });

  it("accepts a key that expires in the future", () => {
    const key = issue({ email: "t@x.edu", tier: "pro", issued: 1, expires: Date.now() + 1_000_000 });
    expect(verifyLicenseKey(key, PUB).active).toBe(true);
  });

  it("rejects a non-pro payload", () => {
    const key = issue({ email: "t@x.edu", tier: "free", issued: 1 });
    expect(verifyLicenseKey(key, PUB).active).toBe(false);
  });

  it("never throws on garbage input", () => {
    for (const bad of ["", "no-dot", ".", "a.", ".b", "x.y.z", "not a key"]) {
      expect(verifyLicenseKey(bad, PUB).active).toBe(false);
    }
  });
});

describe("license storage", () => {
  let dir: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-license-"));
    env = { XDG_CONFIG_HOME: dir };
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("has no license by default", () => {
    expect(licenseStatus(env, PUB).active).toBe(false);
  });

  it("saves a valid key and reads it back", () => {
    const key = issue({ email: "teacher@school.edu", tier: "pro", issued: 1 });
    const saved = saveLicenseKey(key, env, PUB);
    expect(saved.active).toBe(true);
    expect(licenseStatus(env, PUB)).toMatchObject({ active: true, email: "teacher@school.edu" });
  });

  it("refuses to store an invalid key", () => {
    const info = saveLicenseKey("garbage", env, PUB);
    expect(info.active).toBe(false);
    expect(licenseStatus(env, PUB).active).toBe(false);
  });

  it("clears a stored license", () => {
    saveLicenseKey(issue({ email: "t@x.edu", tier: "pro", issued: 1 }), env, PUB);
    clearLicense(env);
    expect(licenseStatus(env, PUB).active).toBe(false);
  });
});
