import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { beginClaudeLogin, completeClaudeLogin, pkce, refreshClaude } from "./oauth";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return (async () =>
    ({ ok, status: ok ? 200 : 400, json: async () => payload, text: async () => JSON.stringify(payload) }) as Response) as unknown as typeof fetch;
}

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

describe("completeClaudeLogin", () => {
  it("exchanges code#state for tokens", async () => {
    const f = fakeFetch({ access_token: "at", refresh_token: "rt", expires_in: 3600 });
    const creds = await completeClaudeLogin("thecode#thestate", "verifier123", f);
    expect(creds.accessToken).toBe("at");
    expect(creds.refreshToken).toBe("rt");
    expect(creds.expiresAt).toBeGreaterThan(Date.now());
  });
  it("throws a friendly error on a rejected exchange", async () => {
    const f = fakeFetch({ error: "invalid_grant" }, false);
    await expect(completeClaudeLogin("bad#state", "v", f)).rejects.toThrow(/sign in|login|invalid/i);
  });
});

describe("refreshClaude", () => {
  it("swaps a refresh token for fresh creds", async () => {
    const f = fakeFetch({ access_token: "at2", refresh_token: "rt2", expires_in: 3600 });
    const creds = await refreshClaude("rt", f);
    expect(creds.accessToken).toBe("at2");
  });
});
