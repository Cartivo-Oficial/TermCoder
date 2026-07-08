import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadChatGPTOAuth, saveChatGPTOAuth, clearChatGPTOAuth, ensureFreshChatGPTConfig } from "./chatgpt-oauth";
import { loadConfig, ConfigSchema } from "../config/config";
import { beginChatGPTLogin, pollChatGPTLogin, refreshChatGPT, chatgptFetch } from "./chatgpt-oauth";

it("chatgptFetch sets the bearer + account header and drops x-api-key", async () => {
  let seen: Headers | undefined;
  const inner = (async (_u: string, init: RequestInit) => { seen = new Headers(init.headers); return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" } as Response; }) as unknown as typeof fetch;
  const f = chatgptFetch({ accessToken: "AT", refreshToken: "RT", expiresAt: Date.now() + 9e5, accountId: "acc_1" }, inner);
  await f("https://chatgpt.com/backend-api/codex/responses", { method: "POST", headers: { "x-api-key": "drop", "content-type": "application/json" }, body: "{}" });
  expect(seen!.get("authorization")).toBe("Bearer AT");
  expect(seen!.get("chatgpt-account-id")).toBe("acc_1");
  expect(seen!.get("x-api-key")).toBeNull();
});

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

let cfg: string;
let prevXdg: string | undefined;

beforeEach(() => {
  cfg = mkdtempSync(join(tmpdir(), "tc-cgptcfg-"));
  prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = cfg;
});

afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  rmSync(cfg, { recursive: true, force: true });
});

describe("store and config helpers", () => {
  it("round-trips ChatGPT oauth creds via config", () => {
    saveChatGPTOAuth({ accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 1000, accountId: "acc_1" });
    const loaded = loadChatGPTOAuth(loadConfig({ cwd: cfg, env: { XDG_CONFIG_HOME: cfg } }));
    expect(loaded?.accessToken).toBe("at");
    expect(loaded?.accountId).toBe("acc_1");
    clearChatGPTOAuth();
    expect(loadChatGPTOAuth(loadConfig({ cwd: cfg, env: { XDG_CONFIG_HOME: cfg } }))).toBeUndefined();
  });

  it("ensureFreshChatGPTConfig refreshes near-expiry creds in place", async () => {
    const config = ConfigSchema.parse({ providers: { openai: { oauth: { accessToken: "old", refreshToken: "rt", expiresAt: Date.now() + 1000 } } } });
    const f = (async () => ({ ok: true, status: 200, json: async () => ({ access_token: "new", refresh_token: "rt2", expires_in: 3600 }) }) as Response) as unknown as typeof fetch;
    await ensureFreshChatGPTConfig(config, f);
    expect(config.providers.openai?.oauth?.accessToken).toBe("new");
  });
});
