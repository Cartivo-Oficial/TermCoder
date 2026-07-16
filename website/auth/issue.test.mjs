import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { signSession } from "./session.mjs";
import { issueLicense } from "./issue.mjs";
import { verifyLicenseKey } from "../../packages/core/src/license/license";

const SECRET = "session-secret";
let env;
let publicPem;

beforeAll(() => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  env = {
    SESSION_SECRET: SECRET,
    PADDLE_API_KEY: "k",
    PADDLE_PRICE_ID: "pri_test",
    PRO_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
});

const session = () => signSession({ sub: "github:1", email: "a@b.com", name: "A", provider: "github" }, SECRET);

describe("issueLicense", () => {
  it("issues a verifiable key for a real purchase, expiring a year after billing", async () => {
    const billedAt = Date.parse("2026-03-01T00:00:00Z");
    const deps = { findPurchase: async () => ({ billedAt, email: "paddle@example.com" }) };
    const res = await issueLicense({ session: await session() }, env, deps);

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    expect(res.body.expires).toBe(billedAt + 365 * 24 * 60 * 60 * 1000);

    const info = verifyLicenseKey(res.body.key, publicPem);
    expect(info.active).toBe(true);
    expect(info.email).toBe("a@b.com");
  });

  it("reports no purchase rather than an error", async () => {
    const deps = { findPurchase: async () => null };
    const res = await issueLicense({ session: await session() }, env, deps);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ active: false, reason: "no-purchase" });
  });

  it("rejects a forged session", async () => {
    const bad = await signSession({ sub: "github:1", email: "a@b.com" }, "other-secret");
    const res = await issueLicense({ session: bad }, env, { findPurchase: async () => null });
    expect(res.status).toBe(401);
  });

  it("falls back to the Paddle email when the session has none", async () => {
    const noEmail = await signSession({ sub: "github:1", email: "", name: "A", provider: "github" }, SECRET);
    const deps = { findPurchase: async () => ({ billedAt: Date.now(), email: "paddle@example.com" }) };
    const res = await issueLicense({ session: noEmail }, env, deps);
    expect(res.status).toBe(200);
    expect(verifyLicenseKey(res.body.key, publicPem).email).toBe("paddle@example.com");
  });

  it("refuses to mint an unusable key when no email exists anywhere", async () => {
    const noEmail = await signSession({ sub: "github:1", email: "", provider: "github" }, SECRET);
    const deps = { findPurchase: async () => ({ billedAt: Date.now(), email: "" }) };
    const res = await issueLicense({ session: noEmail }, env, deps);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ active: false, reason: "no-email" });
  });

  it("says the service is unreachable rather than unpaid when Paddle fails", async () => {
    const deps = { findPurchase: async () => { throw new Error("paddle_500"); } };
    const res = await issueLicense({ session: await session() }, env, deps);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("paddle_unreachable");
  });

  it("reports misconfiguration distinctly", async () => {
    const res = await issueLicense({ session: await session() }, { SESSION_SECRET: SECRET }, {
      findPurchase: async () => null,
    });
    expect(res.status).toBe(503);
  });
});
