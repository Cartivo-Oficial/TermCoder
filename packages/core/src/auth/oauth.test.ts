import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  beginClaudeLogin,
  completeClaudeLogin,
  pkce,
  refreshClaude,
  loadClaudeOAuth,
  saveClaudeOAuth,
  clearClaudeOAuth,
  oauthFetch,
  ensureFreshClaude,
  ensureFreshClaudeConfig,
} from "./oauth";
import { loadConfig } from "../config/config";

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

describe("Claude oauth credential store", () => {
  let cfg: string;
  let prevXdg: string | undefined;
  beforeEach(() => {
    cfg = mkdtempSync(join(tmpdir(), "tc-oauthcfg-"));
    prevXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = cfg;
  });
  afterEach(() => {
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    rmSync(cfg, { recursive: true, force: true });
  });

  it("round-trips Claude oauth creds via the global config", () => {
    saveClaudeOAuth({ accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 1000 });
    const loaded = loadClaudeOAuth(loadConfig({ cwd: cfg, env: { XDG_CONFIG_HOME: cfg } }));
    expect(loaded?.accessToken).toBe("at");
    clearClaudeOAuth();
    expect(loadClaudeOAuth(loadConfig({ cwd: cfg, env: { XDG_CONFIG_HOME: cfg } }))).toBeUndefined();
  });
});

describe("oauthFetch", () => {
  it("injects the bearer, beta header, and system preamble; drops x-api-key", async () => {
    let seen: { headers: Headers; body: unknown } | undefined;
    const inner = (async (_url: string, init: RequestInit) => {
      seen = { headers: new Headers(init.headers), body: JSON.parse(String(init.body)) };
      return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" } as Response;
    }) as unknown as typeof fetch;
    const f = oauthFetch({ accessToken: "AT", refreshToken: "RT", expiresAt: Date.now() + 9e5 }, inner);
    await f("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": "should-be-removed", "content-type": "application/json" },
      body: JSON.stringify({ system: "You are termcoder.", messages: [] }),
    });
    expect(seen!.headers.get("authorization")).toBe("Bearer AT");
    expect(seen!.headers.get("anthropic-beta")).toContain("oauth-2025-04-20");
    expect(seen!.headers.get("x-api-key")).toBeNull();
    const sys = (seen!.body as { system: unknown }).system;
    const first = Array.isArray(sys) ? (sys[0] as { text: string }).text : String(sys);
    expect(first).toContain("Claude Code");
  });
});

describe("ensureFreshClaude", () => {
  it("refreshes near-expiry creds and persists them", async () => {
    const f = fakeFetch({ access_token: "new", refresh_token: "rt2", expires_in: 3600 });
    let saved: unknown;
    const creds = await ensureFreshClaude({ accessToken: "old", refreshToken: "rt", expiresAt: Date.now() + 1000 }, (c) => (saved = c), () => {}, f);
    expect(creds?.accessToken).toBe("new");
    expect(saved).toBeTruthy();
  });
  it("clears creds and returns undefined when refresh fails", async () => {
    const f = fakeFetch({ error: "invalid_grant" }, false);
    let cleared = false;
    const creds = await ensureFreshClaude({ accessToken: "old", refreshToken: "rt", expiresAt: Date.now() + 1000 }, () => {}, () => (cleared = true), f);
    expect(creds).toBeUndefined();
    expect(cleared).toBe(true);
  });
  it("returns creds unchanged when still fresh", async () => {
    const good = { accessToken: "ok", refreshToken: "rt", expiresAt: Date.now() + 9e5 };
    expect(await ensureFreshClaude(good)).toBe(good);
  });
});

describe("ensureFreshClaudeConfig", () => {
  let cfgDir: string;
  let prevXdg: string | undefined;
  beforeEach(() => {
    cfgDir = mkdtempSync(join(tmpdir(), "tc-oauthcfg2-"));
    prevXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = cfgDir;
  });
  afterEach(() => {
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    rmSync(cfgDir, { recursive: true, force: true });
  });

  it("updates the in-memory config's oauth creds on a successful refresh", async () => {
    const config = loadConfig({ cwd: cfgDir, env: { XDG_CONFIG_HOME: cfgDir } });
    config.providers.anthropic = {
      ...config.providers.anthropic,
      oauth: { accessToken: "old", refreshToken: "rt", expiresAt: Date.now() + 1000 },
    };
    const f = fakeFetch({ access_token: "new", refresh_token: "rt2", expires_in: 3600 });
    await ensureFreshClaudeConfig(config, f);
    expect(config.providers.anthropic?.oauth?.accessToken).toBe("new");
  });

  it("deletes the in-memory oauth creds when the refresh is rejected", async () => {
    const config = loadConfig({ cwd: cfgDir, env: { XDG_CONFIG_HOME: cfgDir } });
    config.providers.anthropic = {
      ...config.providers.anthropic,
      oauth: { accessToken: "old", refreshToken: "rt", expiresAt: Date.now() + 1000 },
    };
    const f = fakeFetch({ error: "invalid_grant" }, false);
    await ensureFreshClaudeConfig(config, f);
    expect(config.providers.anthropic?.oauth).toBeUndefined();
  });

  it("is a no-op when there are no oauth creds", async () => {
    const config = loadConfig({ cwd: cfgDir, env: { XDG_CONFIG_HOME: cfgDir } });
    const before = config.providers.anthropic;
    const f = fakeFetch({ access_token: "new", refresh_token: "rt2", expires_in: 3600 });
    await ensureFreshClaudeConfig(config, f);
    expect(config.providers.anthropic).toBe(before);
  });
});
