import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "./session.mjs";

const SECRET = "test-secret-value";
const CLAIMS = { sub: "github:12345", email: "a@b.com", name: "A B", provider: "github" };

describe("session", () => {
  it("round-trips claims", async () => {
    const token = await signSession(CLAIMS, SECRET);
    const out = await verifySession(token, SECRET);
    expect(out.sub).toBe("github:12345");
    expect(out.email).toBe("a@b.com");
    expect(out.provider).toBe("github");
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession(CLAIMS, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...CLAIMS, sub: "github:99" }), "utf8")
      .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await verifySession(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession(CLAIMS, SECRET);
    expect(await verifySession(token, "different-secret")).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSession(CLAIMS, SECRET);
    const thirtyOneDays = Date.now() + 31 * 24 * 60 * 60 * 1000;
    expect(await verifySession(token, SECRET, thirtyOneDays)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifySession("nonsense", SECRET)).toBeNull();
    expect(await verifySession("", SECRET)).toBeNull();
  });
});
