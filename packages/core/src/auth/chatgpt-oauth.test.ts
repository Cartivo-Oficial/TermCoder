import { describe, expect, it } from "vitest";
import { beginChatGPTLogin, pollChatGPTLogin, refreshChatGPT } from "./chatgpt-oauth";

function seqFetch(responses: Array<{ status: number; body: unknown }>): typeof fetch {
  let i = 0;
  return (async () => {
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) } as Response;
  }) as unknown as typeof fetch;
}

describe("beginChatGPTLogin", () => {
  it("returns a device grant with a user code and verification uri", async () => {
    const f = seqFetch([{ status: 200, body: { device_code: "dc", user_code: "WXYZ-1234", verification_uri: "https://auth.openai.com/device", interval: 5, expires_in: 900 } }]);
    const g = await beginChatGPTLogin(f);
    expect(g.userCode).toBe("WXYZ-1234");
    expect(g.verificationUri).toContain("device");
    expect(g.deviceCode).toBe("dc");
    expect(g.interval).toBe(5);
  });
});

describe("pollChatGPTLogin", () => {
  it("waits through authorization_pending then returns tokens", async () => {
    const f = seqFetch([
      { status: 400, body: { error: "authorization_pending" } },
      { status: 200, body: { access_token: "at", refresh_token: "rt", expires_in: 3600 } },
    ]);
    const creds = await pollChatGPTLogin("dc", { intervalMs: 1, fetchImpl: f });
    expect(creds.accessToken).toBe("at");
    expect(creds.refreshToken).toBe("rt");
    expect(creds.expiresAt).toBeGreaterThan(Date.now());
  });
  it("throws on access_denied", async () => {
    const f = seqFetch([{ status: 400, body: { error: "access_denied" } }]);
    await expect(pollChatGPTLogin("dc", { intervalMs: 1, fetchImpl: f })).rejects.toThrow(/denied|sign in|login/i);
  });
});

describe("refreshChatGPT", () => {
  it("swaps a refresh token for fresh creds", async () => {
    const f = seqFetch([{ status: 200, body: { access_token: "at2", refresh_token: "rt2", expires_in: 3600 } }]);
    const creds = await refreshChatGPT("rt", f);
    expect(creds.accessToken).toBe("at2");
  });
});
