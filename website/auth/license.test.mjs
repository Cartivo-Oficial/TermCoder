import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { signLicenseKey } from "./license.mjs";
import { verifyLicenseKey } from "../../packages/core/src/license/license";

let privatePem;
let publicPem;

beforeAll(() => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
});

describe("signLicenseKey", () => {
  it("mints a key the product's verifier accepts", async () => {
    const issued = Date.now();
    const expires = issued + 365 * 24 * 60 * 60 * 1000;
    const key = await signLicenseKey({ email: "buyer@example.com", name: "Buyer", issued, expires }, privatePem);

    const info = verifyLicenseKey(key, publicPem);
    expect(info.active).toBe(true);
    expect(info.tier).toBe("pro");
    expect(info.email).toBe("buyer@example.com");
    expect(info.name).toBe("Buyer");
    expect(info.expires).toBe(expires);
  });

  it("mints a key that reads as expired once its year is up", async () => {
    const issued = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
    const expires = issued + 365 * 24 * 60 * 60 * 1000;
    const key = await signLicenseKey({ email: "old@example.com", issued, expires }, privatePem);

    const info = verifyLicenseKey(key, publicPem);
    expect(info.active).toBe(false);
    expect(info.reason).toBe("expired");
  });

  it("is rejected by a different public key", async () => {
    const other = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
    const key = await signLicenseKey({ email: "a@b.com", issued: Date.now(), expires: Date.now() + 1000 }, privatePem);
    expect(verifyLicenseKey(key, other).active).toBe(false);
  });

  it("refuses to sign an empty email", async () => {
    await expect(
      signLicenseKey({ email: "", issued: Date.now(), expires: Date.now() + 1000 }, privatePem),
    ).rejects.toThrow("email required");
  });
});
