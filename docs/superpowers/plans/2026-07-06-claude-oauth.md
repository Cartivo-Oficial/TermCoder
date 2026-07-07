# Claude Pro/Max OAuth Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user sign in with an existing Claude Pro/Max subscription (paste-code OAuth) and use it as termcoder's Anthropic model instead of an API key — isolated, labeled experimental, failing gracefully to keyless.

**Architecture:** All ToS-gray, breakable code lives in one quarantine module `core/auth/oauth.ts` (PKCE, token exchange/refresh, the constants, AND a custom `fetch` wrapper that carries the Bearer token, the beta header, and the required system-prompt preamble — so `session.ts` never learns about any of it). Creds live at `config.providers.anthropic.oauth` (config is not a sync store, so they never leave the machine). `resolveModel` grows one branch; routing treats "has anthropic oauth" like "has a key"; refresh-failure clears the creds.

**Tech Stack:** TypeScript, Node built-ins (`crypto`, `fetch`), Vercel AI SDK (`@ai-sdk/anthropic` with a custom `fetch`), Vitest, Ink TUI, Electron+React.

## Global Constraints

- **Experimental, isolated, fail-graceful.** Every UI surface labels it experimental; any failure falls back to keyless without crashing.
- **Secrets never sync.** Creds sit under `config.providers.anthropic.oauth`; config is not in `DEFAULT_SYNC_STORES` — verify nothing new adds it.
- **Comment-free code** (user rule). No new runtime dependencies (Node `crypto`/`fetch` + existing `@ai-sdk/anthropic`).
- **The OAuth constants are community-reverse-engineered and may be wrong/stale.** They live in ONE place (`CLAUDE_OAUTH` in `oauth.ts`). **Task 8's manual live-login smoke is the only real confirmation** — a subagent cannot perform it; the human runs it. If the constants are wrong, only that const block changes; the architecture holds.
- Node ≥ 20, ESM, tests colocated, typecheck clean (`noUncheckedIndexedAccess`). Never edit via PowerShell.
- **No version bump, no push** — the bundle ships versioned later; hold push for the final review. Suite currently 263 green.
- Starting constants (verify in Task 8): client id `9d1c250a-e61b-44d9-88ed-5944d1962f5e`; authorize `https://claude.ai/oauth/authorize`; token `https://console.anthropic.com/v1/oauth/token`; redirect `https://console.anthropic.com/oauth/code/callback`; scopes `org:create_api_key user:profile user:inference`; beta header `anthropic-beta: oauth-2025-04-20`; required system preamble `You are Claude Code, Anthropic's official CLI for Claude.`

---

### Task 1: PKCE + login-URL builder (offline)

**Files:**
- Create: `packages/core/src/auth/oauth.ts`
- Test: `packages/core/src/auth/oauth.test.ts`

**Interfaces:**
- Produces:
  - `interface ClaudeOAuth { accessToken: string; refreshToken: string; expiresAt: number }`
  - `const CLAUDE_OAUTH` (the constants block)
  - `pkce(): { verifier: string; challenge: string }`
  - `beginClaudeLogin(): { url: string; verifier: string }`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it — FAIL (module missing).** `npx vitest run packages/core/src/auth/oauth.test.ts`

- [ ] **Step 3: Implement**

```ts
import { createHash, randomBytes } from "node:crypto";

export interface ClaudeOAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export const CLAUDE_OAUTH = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorizeUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://console.anthropic.com/v1/oauth/token",
  redirectUri: "https://console.anthropic.com/oauth/code/callback",
  scopes: "org:create_api_key user:profile user:inference",
  betaHeader: "oauth-2025-04-20",
  systemPreamble: "You are Claude Code, Anthropic's official CLI for Claude.",
};

export function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function beginClaudeLogin(): { url: string; verifier: string } {
  const { verifier, challenge } = pkce();
  const u = new URL(CLAUDE_OAUTH.authorizeUrl);
  u.searchParams.set("code", "true");
  u.searchParams.set("client_id", CLAUDE_OAUTH.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", CLAUDE_OAUTH.redirectUri);
  u.searchParams.set("scope", CLAUDE_OAUTH.scopes);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", verifier);
  return { url: u.toString(), verifier };
}
```

- [ ] **Step 4: Run it — PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/auth/oauth.ts packages/core/src/auth/oauth.test.ts
git commit -m "feat(core): Claude OAuth PKCE + login URL (experimental)"
```

---

### Task 2: Token exchange + refresh (offline, mocked fetch)

**Files:**
- Modify: `packages/core/src/auth/oauth.ts`
- Test: `packages/core/src/auth/oauth.test.ts`

**Interfaces:**
- Produces:
  - `completeClaudeLogin(pasted: string, verifier: string, fetchImpl?: typeof fetch): Promise<ClaudeOAuth>` — `pasted` is the `code#state` value the page shows.
  - `refreshClaude(refreshToken: string, fetchImpl?: typeof fetch): Promise<ClaudeOAuth>`

- [ ] **Step 1: Write the failing test**

```ts
import { completeClaudeLogin, refreshClaude } from "./oauth";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return (async () =>
    ({ ok, status: ok ? 200 : 400, json: async () => payload, text: async () => JSON.stringify(payload) }) as Response) as unknown as typeof fetch;
}

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
```

- [ ] **Step 2: Run it — FAIL.**

- [ ] **Step 3: Implement.** Append to `oauth.ts`:

```ts
async function postToken(body: Record<string, string>, fetchImpl: typeof fetch): Promise<ClaudeOAuth> {
  const res = await fetchImpl(CLAUDE_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("Claude sign-in failed. Try /login-claude again, or use an API key.");
  }
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

export function completeClaudeLogin(pasted: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<ClaudeOAuth> {
  const [code, state] = pasted.trim().split("#");
  return postToken(
    {
      grant_type: "authorization_code",
      code: code ?? "",
      state: state ?? "",
      client_id: CLAUDE_OAUTH.clientId,
      redirect_uri: CLAUDE_OAUTH.redirectUri,
      code_verifier: verifier,
    },
    fetchImpl,
  );
}

export function refreshClaude(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<ClaudeOAuth> {
  return postToken(
    { grant_type: "refresh_token", refresh_token: refreshToken, client_id: CLAUDE_OAUTH.clientId },
    fetchImpl,
  );
}
```

- [ ] **Step 4: Run it — PASS**, typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/auth/oauth.ts packages/core/src/auth/oauth.test.ts
git commit -m "feat(core): Claude OAuth token exchange + refresh"
```

---

### Task 3: Config schema + credential store

**Files:**
- Modify: `packages/core/src/config/config.ts` (provider schema)
- Modify: `packages/core/src/auth/oauth.ts` (load/save/clear helpers)
- Modify: `packages/core/src/index.ts` (exports)
- Test: `packages/core/src/auth/oauth.test.ts`

**Interfaces:**
- Produces: `providers.<name>.oauth?: { accessToken, refreshToken, expiresAt }` in the schema; `loadClaudeOAuth(config): ClaudeOAuth | undefined`; `saveClaudeOAuth(creds): void`; `clearClaudeOAuth(): void`.

- [ ] **Step 1: Extend the provider schema** in `config.ts` (the `z.object({ apiKey, baseURL })` at ~line 102):

```ts
      z.object({
        apiKey: z.string().optional(),
        baseURL: z.string().optional(),
        oauth: z
          .object({ accessToken: z.string(), refreshToken: z.string(), expiresAt: z.number() })
          .optional(),
      }),
```

- [ ] **Step 2: Write the failing test** (uses `readGlobalConfig`/`writeGlobalConfig` via a temp XDG — mirror how `oauth.test.ts` isolates; save then load round-trips):

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { loadClaudeOAuth, saveClaudeOAuth, clearClaudeOAuth } from "./oauth";
import { loadConfig } from "../config/config";

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
  const loaded = loadClaudeOAuth(loadConfig({ cwd: cfg, env: {} }));
  expect(loaded?.accessToken).toBe("at");
  clearClaudeOAuth();
  expect(loadClaudeOAuth(loadConfig({ cwd: cfg, env: {} }))).toBeUndefined();
});
```

- [ ] **Step 3: Run it — FAIL.**

- [ ] **Step 4: Implement.** Append to `oauth.ts` (import `readGlobalConfig`, `writeGlobalConfig` from `../config/config`, and `Config` type):

`readGlobalConfig(): Record<string, unknown>` returns the raw parsed config JSON (or `{}`); `writeGlobalConfig(obj)` runs `ConfigSchema.parse(obj)` then writes it. So cast the untyped shape carefully:

```ts
import { readGlobalConfig, writeGlobalConfig, type Config } from "../config/config";

export function loadClaudeOAuth(config: Config): ClaudeOAuth | undefined {
  return config.providers.anthropic?.oauth;
}

export function saveClaudeOAuth(creds: ClaudeOAuth): void {
  const config = readGlobalConfig();
  const providers = { ...((config.providers as Record<string, unknown>) ?? {}) };
  providers.anthropic = { ...((providers.anthropic as Record<string, unknown>) ?? {}), oauth: creds };
  writeGlobalConfig({ ...config, providers });
}

export function clearClaudeOAuth(): void {
  const config = readGlobalConfig();
  const providers = { ...((config.providers as Record<string, unknown>) ?? {}) };
  const anthropic = providers.anthropic as Record<string, unknown> | undefined;
  if (!anthropic?.oauth) return;
  const next = { ...anthropic };
  delete next.oauth;
  providers.anthropic = next;
  writeGlobalConfig({ ...config, providers });
}
```

`loadConfig` reads the same file, so `loadClaudeOAuth(loadConfig(...))` sees what `saveClaudeOAuth` wrote — the test round-trips because both hit the XDG config path.

- [ ] **Step 5: Export** from `index.ts` (near the auth exports):

```ts
export {
  beginClaudeLogin,
  completeClaudeLogin,
  refreshClaude,
  loadClaudeOAuth,
  saveClaudeOAuth,
  clearClaudeOAuth,
  CLAUDE_OAUTH,
  type ClaudeOAuth,
} from "./auth/oauth";
```

- [ ] **Step 6: Run tests + verify no sync leak.** `npx vitest run packages/core/src/auth packages/core/src/sync` and confirm `DEFAULT_SYNC_STORES` still excludes config/providers (grep it). Typecheck.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/config/config.ts packages/core/src/auth/oauth.ts packages/core/src/index.ts packages/core/src/auth/oauth.test.ts
git commit -m "feat(core): store Claude oauth creds in gitignored config (never synced)"
```

---

### Task 4: resolveModel oauth branch + impersonation fetch

**Files:**
- Modify: `packages/core/src/auth/oauth.ts` (the `oauthFetch` wrapper + `anthropicOAuthModel` builder)
- Modify: `packages/core/src/provider/provider.ts` (branch in `resolveModel`, routing awareness)
- Modify: `packages/core/src/provider/reliability.ts` (`firstKeyedModel` treats oauth like a key)
- Test: `packages/core/src/auth/oauth.test.ts`, `packages/core/src/provider/provider.test.ts`

**Interfaces:**
- Consumes: `ClaudeOAuth`, `CLAUDE_OAUTH` (Tasks 1-3).
- Produces: `oauthFetch(creds: ClaudeOAuth): typeof fetch` — a fetch wrapper that (a) drops `x-api-key`, sets `Authorization: Bearer` + the `anthropic-beta` header, and (b) rewrites the request body so its `system` starts with `CLAUDE_OAUTH.systemPreamble`. `anthropicOAuthModel(model: string, creds: ClaudeOAuth)` returns an SDK `LanguageModel`. `resolveModel("anthropic/…")` uses it when there is no apiKey but oauth creds exist.

- [ ] **Step 1: Write the failing test** (the fetch wrapper is the fragile part — test it in isolation):

```ts
import { oauthFetch } from "./oauth";

it("oauthFetch injects the bearer, beta header, and system preamble; drops x-api-key", async () => {
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
```

Add to `provider.test.ts`:

```ts
import { ConfigSchema } from "../config/config";
import { resolveModel } from "./provider";

it("resolves anthropic via oauth when there is no api key", () => {
  const config = ConfigSchema.parse({ providers: { anthropic: { oauth: { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 9e5 } } } });
  expect(resolveModel("anthropic/claude-haiku-4-5-20251001", { config, env: {} })).toBeTruthy();
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `oauthFetch` + model builder** in `oauth.ts` (import `createAnthropic` from `@ai-sdk/anthropic`, `LanguageModel` from `ai`):

```ts
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export function oauthFetch(creds: ClaudeOAuth, inner: typeof fetch = fetch): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.delete("x-api-key");
    headers.set("authorization", `Bearer ${creds.accessToken}`);
    headers.set("anthropic-beta", CLAUDE_OAUTH.betaHeader);
    let body = init?.body;
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body) as { system?: unknown };
        const preamble = { type: "text", text: CLAUDE_OAUTH.systemPreamble };
        const existing = Array.isArray(parsed.system)
          ? parsed.system
          : parsed.system
            ? [{ type: "text", text: String(parsed.system) }]
            : [];
        parsed.system = [preamble, ...existing];
        body = JSON.stringify(parsed);
      } catch {}
    }
    return inner(url as string, { ...init, headers, body });
  }) as unknown as typeof fetch;
}

export function anthropicOAuthModel(model: string, creds: ClaudeOAuth): LanguageModel {
  return createAnthropic({ apiKey: "", fetch: oauthFetch(creds) })(model);
}
```

- [ ] **Step 4: Branch in `resolveModel`** (`provider.ts`). In the `case "anthropic":`, before `requireKey`, add the oauth path:

```ts
    case "anthropic": {
      const oauth = cfg.oauth;
      if (!cfg.apiKey && !env.ANTHROPIC_API_KEY && oauth) {
        return anthropicOAuthModel(model, oauth);
      }
      return createAnthropic({
        apiKey: requireKey(provider, cfg.apiKey ?? env.ANTHROPIC_API_KEY),
        baseURL: cfg.baseURL,
      })(model);
    }
```

(Import `anthropicOAuthModel` from `../auth/oauth`.)

- [ ] **Step 5: Routing awareness.** `providerHasKey` (provider.ts) and `firstKeyedModel` (reliability.ts) must treat anthropic oauth as usable. In `providerHasKey`, before the env check add: `if (provider === "anthropic" && config.providers.anthropic?.oauth) return true;`. In `firstKeyedModel`'s `has("anthropic", …)` line, OR-in `Boolean(config.providers.anthropic?.oauth)`.

- [ ] **Step 6: Run the provider + auth folders + typecheck.** `npx vitest run packages/core/src/auth packages/core/src/provider && pnpm --filter @termcoder/core typecheck`

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/auth/oauth.ts packages/core/src/provider/provider.ts packages/core/src/provider/reliability.ts packages/core/src/provider/provider.test.ts
git commit -m "feat(core): resolve Claude via oauth (isolated impersonation fetch)"
```

---

### Task 5: Fail-graceful refresh + clear-on-revoke

**Files:**
- Modify: `packages/core/src/auth/oauth.ts` (`ensureFreshClaude`)
- Modify: `packages/core/src/provider/provider.ts` (use it in the anthropic oauth branch)
- Test: `packages/core/src/auth/oauth.test.ts`

**Interfaces:**
- Produces: `ensureFreshClaude(creds: ClaudeOAuth, save?: (c: ClaudeOAuth) => void, clear?: () => void, fetchImpl?: typeof fetch): Promise<ClaudeOAuth | undefined>` — returns valid creds (refreshing + persisting if near expiry), or `undefined` after clearing when refresh fails.

Because `resolveModel` is synchronous, keep it simple: the branch uses the stored creds as-is (the AI SDK call will 401 if expired, which the session's existing retry/fallback already surfaces). `ensureFreshClaude` is called by the login/refresh commands and by a lightweight pre-check the TUI/desktop can run. Do NOT make `resolveModel` async.

- [ ] **Step 1: Write the failing test**

```ts
import { ensureFreshClaude } from "./oauth";

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
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** in `oauth.ts`:

```ts
const REFRESH_SKEW_MS = 120_000;

export async function ensureFreshClaude(
  creds: ClaudeOAuth,
  save: (c: ClaudeOAuth) => void = () => {},
  clear: () => void = () => {},
  fetchImpl: typeof fetch = fetch,
): Promise<ClaudeOAuth | undefined> {
  if (creds.expiresAt - Date.now() > REFRESH_SKEW_MS) return creds;
  try {
    const fresh = await refreshClaude(creds.refreshToken, fetchImpl);
    save(fresh);
    return fresh;
  } catch {
    clear();
    return undefined;
  }
}
```

- [ ] **Step 4: Run + typecheck. Commit**

```bash
git add packages/core/src/auth/oauth.ts packages/core/src/auth/oauth.test.ts
git commit -m "feat(core): Claude oauth refresh-on-expiry, clear-on-revoke"
```

---

### Task 6: TUI /login-claude + /logout-claude

**Files:**
- Modify: `packages/tui/src/commands.ts`, `packages/tui/src/app.tsx`

**Interfaces:**
- Consumes: `beginClaudeLogin`, `completeClaudeLogin`, `saveClaudeOAuth`, `clearClaudeOAuth` from `@termcoder/core`.

- [ ] **Step 1: Register commands** in `commands.ts` near `/connect`:

```ts
  { name: "login-claude", desc: "Sign in with a Claude Pro/Max subscription (experimental)" },
  { name: "logout-claude", desc: "Disconnect the Claude subscription login" },
```

- [ ] **Step 2: Handle them** in `app.tsx` `handleCommand`. `/login-claude` is two-phase via a small ref holding the verifier (the composer already reads a follow-up line — reuse the existing pattern for a pasted value; if none exists, accept the code as an argument on a second invocation `/login-claude <code#state>`):

```ts
      case "login-claude": {
        const pasted = arg.trim();
        if (!pasted) {
          const { url, verifier } = beginClaudeLogin();
          claudeVerifier.current = verifier;
          pushHistory({ kind: "notice", text: [
            "Experimental — sign in with your Claude Pro/Max subscription:",
            `  1. Open: ${url}`,
            "  2. Approve, copy the code it shows, then run:  /login-claude <code>",
            "If Anthropic changes their flow this may stop working; you can always use /key or the free model.",
          ].join("\n") });
          break;
        }
        if (!claudeVerifier.current) { pushHistory({ kind: "error", text: "Run /login-claude with no argument first to get the sign-in link." }); break; }
        try {
          const creds = await completeClaudeLogin(pasted, claudeVerifier.current);
          saveClaudeOAuth(creds);
          claudeVerifier.current = null;
          forceRender((n) => n + 1);
          pushHistory({ kind: "notice", text: "✓ Claude subscription connected (experimental). termcoder/auto can now use it." });
        } catch (err) {
          pushHistory({ kind: "error", text: err instanceof Error ? err.message : String(err) });
        }
        break;
      }
      case "logout-claude": {
        clearClaudeOAuth();
        forceRender((n) => n + 1);
        pushHistory({ kind: "notice", text: "Disconnected the Claude subscription login." });
        break;
      }
```

Add `const claudeVerifier = useRef<string | null>(null);` near the other refs, and the four imports.

- [ ] **Step 3: Typecheck + build.** `cd packages/tui && npx tsc --noEmit && cd ../.. && pnpm --filter @termcoder/tui build`

- [ ] **Step 4: Commit**

```bash
git add packages/tui/src/commands.ts packages/tui/src/app.tsx
git commit -m "feat(tui): /login-claude + /logout-claude (experimental)"
```

---

### Task 7: Server routes + desktop Connect modal (flip oauth-browser live)

**Files:**
- Modify: `packages/server/src/server.ts` (two routes)
- Modify: `packages/core/src/auth/auth.ts` (anthropic `oauth-browser` → available)
- Modify: `packages/desktop/src/renderer/Settings.tsx` (the oauth method renders a paste-code flow)
- Test: `packages/server/src/server.test.ts`

**Interfaces:**
- Produces: `POST /auth/claude/start` → `{ url }` (server holds the verifier in memory keyed by nothing — single-user desktop; store it on a module variable); `POST /auth/claude/complete { code }` → `{ ok }` (uses the held verifier, saves creds). `auth.ts` marks anthropic's `oauth-browser` method `available: true` with an experimental hint; leave `oauth-headless` "coming soon".

- [ ] **Step 1: Write the failing server test**

```ts
it("starts a Claude oauth login and rejects completing without a start", async () => {
  const start = await fetch(`${base()}/auth/claude/start`, { method: "POST" });
  expect(start.status).toBe(200);
  const body = (await start.json()) as { url: string };
  expect(body.url).toContain("oauth");
});
```

- [ ] **Step 2: Run — FAIL (404).**

- [ ] **Step 3: Implement routes** in `server.ts` (import `beginClaudeLogin`, `completeClaudeLogin`, `saveClaudeOAuth`). Add a module-level `let claudeVerifier: string | null = null;` and:

```ts
  if (req.method === "POST" && parts.length === 3 && parts[0] === "auth" && parts[1] === "claude" && parts[2] === "start") {
    const { url, verifier } = beginClaudeLogin();
    claudeVerifier = verifier;
    return sendJson(res, 200, { url });
  }
  if (req.method === "POST" && parts.length === 3 && parts[0] === "auth" && parts[1] === "claude" && parts[2] === "complete") {
    const body = await readJson(req);
    if (!claudeVerifier) return sendJson(res, 400, { error: "start the login first" });
    try {
      const creds = await completeClaudeLogin(String(body.code ?? ""), claudeVerifier);
      saveClaudeOAuth(creds);
      claudeVerifier = null;
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
```

- [ ] **Step 4: Flip the method** in `auth.ts`: for anthropic, change the `oauth-browser` method to `{ id: "oauth-browser", label: "Claude Pro/Max login", available: true, hint: "Experimental — sign in with your subscription. May break if Anthropic changes their flow." }`. Leave `oauth-headless` unavailable.

- [ ] **Step 5: Desktop modal** (`Settings.tsx`, the method render at ~1284): when `m.id === "oauth-browser" && m.available`, render a two-button flow: "Open sign-in" (POSTs `/auth/claude/start`, then `window.open`/`openExternal` the returned url and reveals a paste input) and, once a code is entered, "Connect" (POSTs `/auth/claude/complete { code }`, shows ✓ or the error). Reuse the existing api-key input styles. Label the whole method **Experimental**.

- [ ] **Step 6: Build core + run server tests + desktop typecheck.** `pnpm --filter @termcoder/core build && npx vitest run packages/server && cd packages/desktop && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/server.ts packages/core/src/auth/auth.ts packages/server/src/server.test.ts packages/desktop/src/renderer/Settings.tsx
git commit -m "feat: Claude subscription login live in server + desktop (experimental)"
```

---

### Task 8: Docs, offline verification, and the MANUAL live-login smoke

**Files:**
- Modify: `docs/configuration.md`

- [ ] **Step 1: Docs.** Add a short "Claude subscription login (experimental)" note under Models & providers: what it is, that it needs Pro/Max, `/login-claude` (CLI) or the Connect modal (desktop), and that it may break if Anthropic changes their flow — with the honest line that it falls back to keyless.

- [ ] **Step 2: Offline verification**

```bash
pnpm -r build && pnpm -r typecheck && npx vitest run
```
Expected: all green (263 + the new oauth/provider/server tests).

- [ ] **Step 3: MANUAL live gate (human, not a subagent).** This is the only real proof the constants are right. Perform once, by hand:
  1. `env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev` (or the TUI `/login-claude`).
  2. Open the printed URL in a browser signed into a Claude Pro/Max account; approve; copy the code.
  3. Paste it back (`/login-claude <code>` or the desktop Connect input).
  4. Pick an `anthropic/*` model (or `termcoder/auto` with no other key) and send a prompt.
  - **PASS:** a real Claude reply. **FAIL modes to correct in `CLAUDE_OAUTH` only:** the authorize page 404s (wrong authorize URL/client id), the token POST 400s (wrong token URL/redirect/params), or the message call 401s / "invalid model" (wrong beta header or missing system preamble). Fix the single const block and re-run — no other file changes.

- [ ] **Step 4: Commit (no push — final review first)**

```bash
git add -A
git commit -m "feat: Claude Pro/Max subscription login (experimental)"
```

---

## Notes for the reviewer / executor

- The subagent tasks are all offline-testable. **Task 8 Step 3 cannot be automated** — surface it to the human and pause the loop there rather than marking the feature "done" on offline tests alone.
- Everything ToS-gray (constants, bearer header, `x-api-key` removal, the "Claude Code" system preamble) lives in `oauth.ts`. Deleting that file + the one `resolveModel` branch returns termcoder to its prior behavior.
