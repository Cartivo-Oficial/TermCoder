import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { beginClaudeLogin, pkce } from "./oauth";

describe("pkce", () => {
  it("produces a verifier and its S256 challenge", () => {
    const { verifier, challenge } = pkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(challenge).toBe(expected);
  });
});

describe("beginClaudeLogin", () => {
  it("builds an authorize URL carrying the challenge and returns the verifier", () => {
    const { url, verifier } = beginClaudeLogin();
    const u = new URL(url);
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("client_id")).toBeTruthy();
    expect(u.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(verifier).digest("base64url"),
    );
    expect(u.searchParams.get("scope")).toContain("user:inference");
  });
});
