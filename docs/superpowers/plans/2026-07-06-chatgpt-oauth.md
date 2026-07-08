# ChatGPT Subscription Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user drive termcoder with a ChatGPT Plus/Pro subscription via the Codex device-code flow, instead of an OpenAI API key — isolated, experimental, fail-graceful.

**Architecture:** All ToS-gray code in one quarantine module `core/auth/chatgpt-oauth.ts` (device grant, poll, refresh, the constants, and the backend `fetch` wrapper that carries the Bearer token + account header to the ChatGPT/Codex responses backend). Creds in `config.providers.openai.oauth` (already valid in the schema — the `oauth` object is per-provider; never synced). `resolveModel` grows an `openai/*` oauth branch; routing treats it like a key; the session's top-of-prompt refresh covers it.

**Tech Stack:** TypeScript, Node built-ins (`crypto`, `fetch`), `@ai-sdk/openai` with a custom fetch, Vitest, Ink TUI, Electron+React.

## Global Constraints

- **Experimental, isolated, fail-graceful.** Every UI surface labels it experimental; failures fall back to keyless.
- **ChatGPT is the highest ToS risk** (OpenAI restricts programmatic ChatGPT use). Opt-in, never default.
- **Secrets never sync** — creds under `providers.openai.oauth`; config is not a sync store (verify).
- **Comment-free code; no new runtime dependencies.**
- **Constants + backend specifics are community-reverse-engineered and verified ONLY by the manual live gate (Task 7).** They live in one const block; if wrong, only that block + the backend base/headers change — no architecture change. Best-known starting values: client `app_EMoamEEZ73f0CkXaXp7hrann`; device-authorize `https://auth.openai.com/oauth/device/authorize`; token `https://auth.openai.com/oauth/token`; device grant type `urn:ietf:params:oauth:grant-type:device_code`; backend base + `chatgpt-account-id` header + Responses-API (not `.chat()`) — all VERIFY LIVE.
- Node ≥ 20, ESM, tests colocated, typecheck clean (`noUncheckedIndexedAccess`). Never edit via PowerShell.
- **No version bump, no push** — bundle ships later; hold push for the final review. Suite currently 278 green.
- Mirror the shipped Claude module (`core/auth/oauth.ts`) exactly in shape (it's the proven reference).

---

### Task 1: Device-grant + polling + refresh (offline)

**Files:**
- Create: `packages/core/src/auth/chatgpt-oauth.ts`
- Test: `packages/core/src/auth/chatgpt-oauth.test.ts`

**Interfaces:**
- Produces:
  - `interface ChatGPTOAuth { accessToken: string; refreshToken: string; expiresAt: number; accountId?: string }`
  - `const CHATGPT_OAUTH` (constants block)
  - `interface DeviceGrant { deviceCode: string; userCode: string; verificationUri: string; interval: number; expiresAt: number }`
  - `beginChatGPTLogin(fetchImpl?): Promise<DeviceGrant>`
  - `pollChatGPTLogin(deviceCode, opts?: { intervalMs?, signal?, fetchImpl? }): Promise<ChatGPTOAuth>`
  - `refreshChatGPT(refreshToken, fetchImpl?): Promise<ChatGPTOAuth>`

- [ ] **Step 1: Write the failing test** (mock fetch; the poll test returns `authorization_pending` once, then tokens):

```ts
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
```

- [ ] **Step 2: Run it — FAIL (module missing).** `npx vitest run packages/core/src/auth/chatgpt-oauth.test.ts`

- [ ] **Step 3: Implement**

```ts
export interface ChatGPTOAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId?: string;
}

export const CHATGPT_OAUTH = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  deviceAuthorizeUrl: "https://auth.openai.com/oauth/device/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  deviceGrantType: "urn:ietf:params:oauth:grant-type:device_code",
  scopes: "openid profile email offline_access",
};

export interface DeviceGrant {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresAt: number;
}

function accountFromToken(accessToken: string): string | undefined {
  const part = accessToken.split(".")[1];
  if (!part) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
    const auth = claims["https://api.openai.com/auth"] as { chatgpt_account_id?: string } | undefined;
    return auth?.chatgpt_account_id;
  } catch {
    return undefined;
  }
}

function toCreds(json: { access_token: string; refresh_token: string; expires_in?: number }): ChatGPTOAuth {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    accountId: accountFromToken(json.access_token),
  };
}

export async function beginChatGPTLogin(fetchImpl: typeof fetch = fetch): Promise<DeviceGrant> {
  const res = await fetchImpl(CHATGPT_OAUTH.deviceAuthorizeUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CHATGPT_OAUTH.clientId, scope: CHATGPT_OAUTH.scopes }).toString(),
  });
  if (!res.ok) throw new Error("Could not start ChatGPT sign-in. Try again, or use an API key.");
  const json = (await res.json()) as { device_code: string; user_code: string; verification_uri: string; interval?: number; expires_in?: number };
  return {
    deviceCode: json.device_code,
    userCode: json.user_code,
    verificationUri: json.verification_uri,
    interval: json.interval ?? 5,
    expiresAt: Date.now() + (json.expires_in ?? 900) * 1000,
  };
}

export async function pollChatGPTLogin(
  deviceCode: string,
  opts: { intervalMs?: number; signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ChatGPTOAuth> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const intervalMs = opts.intervalMs ?? 5000;
  while (true) {
    if (opts.signal?.aborted) throw new Error("ChatGPT sign-in cancelled.");
    const res = await fetchImpl(CHATGPT_OAUTH.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CHATGPT_OAUTH.clientId, device_code: deviceCode, grant_type: CHATGPT_OAUTH.deviceGrantType }).toString(),
    });
    if (res.ok) return toCreds((await res.json()) as { access_token: string; refresh_token: string; expires_in?: number });
    const err = ((await res.json()) as { error?: string }).error ?? "";
    if (err === "authorization_pending" || err === "slow_down") {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    throw new Error("ChatGPT sign-in failed or was denied. Try /login-chatgpt again, or use an API key.");
  }
}

export async function refreshChatGPT(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<ChatGPTOAuth> {
  const res = await fetchImpl(CHATGPT_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CHATGPT_OAUTH.clientId, refresh_token: refreshToken, grant_type: "refresh_token" }).toString(),
  });
  if (!res.ok) throw new Error("ChatGPT session refresh failed.");
  return toCreds((await res.json()) as { access_token: string; refresh_token: string; expires_in?: number });
}
```

- [ ] **Step 4: Run it — PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/auth/chatgpt-oauth.ts packages/core/src/auth/chatgpt-oauth.test.ts
git commit -m "feat(core): ChatGPT device-code login flow (experimental)"
```

---

### Task 2: Credential store + config helpers

**Files:**
- Modify: `packages/core/src/auth/chatgpt-oauth.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/auth/chatgpt-oauth.test.ts`

**Interfaces:**
- Produces: `loadChatGPTOAuth(config): ChatGPTOAuth | undefined`; `saveChatGPTOAuth(creds): void`; `clearChatGPTOAuth(): void`; `ensureFreshChatGPT(creds, save?, clear?, fetchImpl?): Promise<ChatGPTOAuth | undefined>`; `ensureFreshChatGPTConfig(config, fetchImpl?): Promise<void>`.

The `oauth` object is already valid on any provider in the schema (`providers.<name>.oauth`), so **no schema change** — but the schema's `oauth` shape is `{ accessToken, refreshToken, expiresAt }` with no `accountId`. Add `accountId: z.string().optional()` to the existing provider `oauth` object in `config.ts` so ChatGPT's account id persists.

- [ ] **Step 1: Add `accountId` to the schema.** In `packages/core/src/config/config.ts`, the provider `oauth` object becomes:

```ts
        oauth: z
          .object({ accessToken: z.string(), refreshToken: z.string(), expiresAt: z.number(), accountId: z.string().optional() })
          .optional(),
```

- [ ] **Step 2: Write the failing test** (mirror Claude's store test with XDG isolation):

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { loadChatGPTOAuth, saveChatGPTOAuth, clearChatGPTOAuth, ensureFreshChatGPTConfig } from "./chatgpt-oauth";
import { loadConfig, ConfigSchema } from "../config/config";

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
```

- [ ] **Step 3: Run it — FAIL.**

- [ ] **Step 4: Implement.** Append to `chatgpt-oauth.ts` (import `readGlobalConfig`, `writeGlobalConfig`, `Config`; and the shared `ensureFreshClaude`-style refresh from `./oauth`? No — keep isolated, write our own):

```ts
import { readGlobalConfig, writeGlobalConfig, type Config } from "../config/config";

export function loadChatGPTOAuth(config: Config): ChatGPTOAuth | undefined {
  return config.providers.openai?.oauth as ChatGPTOAuth | undefined;
}

export function saveChatGPTOAuth(creds: ChatGPTOAuth): void {
  const config = readGlobalConfig();
  const providers = { ...((config.providers as Record<string, unknown>) ?? {}) };
  providers.openai = { ...((providers.openai as Record<string, unknown>) ?? {}), oauth: creds };
  writeGlobalConfig({ ...config, providers });
}

export function clearChatGPTOAuth(): void {
  const config = readGlobalConfig();
  const providers = { ...((config.providers as Record<string, unknown>) ?? {}) };
  const openai = providers.openai as Record<string, unknown> | undefined;
  if (!openai?.oauth) return;
  const next = { ...openai };
  delete next.oauth;
  providers.openai = next;
  writeGlobalConfig({ ...config, providers });
}

const REFRESH_SKEW_MS = 120_000;

export async function ensureFreshChatGPT(
  creds: ChatGPTOAuth,
  save: (c: ChatGPTOAuth) => void = () => {},
  clear: () => void = () => {},
  fetchImpl: typeof fetch = fetch,
): Promise<ChatGPTOAuth | undefined> {
  if (creds.expiresAt - Date.now() > REFRESH_SKEW_MS) return creds;
  try {
    const fresh = await refreshChatGPT(creds.refreshToken, fetchImpl);
    save(fresh);
    return fresh;
  } catch {
    clear();
    return undefined;
  }
}

export async function ensureFreshChatGPTConfig(config: Config, fetchImpl: typeof fetch = fetch): Promise<void> {
  const creds = config.providers.openai?.oauth as ChatGPTOAuth | undefined;
  if (!creds) return;
  const fresh = await ensureFreshChatGPT(creds, saveChatGPTOAuth, clearChatGPTOAuth, fetchImpl);
  if (fresh) {
    config.providers.openai = { ...config.providers.openai, oauth: fresh };
  } else if (config.providers.openai) {
    const next = { ...config.providers.openai };
    delete (next as { oauth?: unknown }).oauth;
    config.providers.openai = next;
  }
}
```

- [ ] **Step 5: Export** from `index.ts`:

```ts
export {
  beginChatGPTLogin,
  pollChatGPTLogin,
  refreshChatGPT,
  loadChatGPTOAuth,
  saveChatGPTOAuth,
  clearChatGPTOAuth,
  ensureFreshChatGPTConfig,
  CHATGPT_OAUTH,
  type ChatGPTOAuth,
  type DeviceGrant,
} from "./auth/chatgpt-oauth";
```

- [ ] **Step 6: Run tests + typecheck + verify sync exclusion** (`grep DEFAULT_SYNC_STORES`). Commit:

```bash
git add packages/core/src/auth/chatgpt-oauth.ts packages/core/src/config/config.ts packages/core/src/index.ts packages/core/src/auth/chatgpt-oauth.test.ts
git commit -m "feat(core): store ChatGPT oauth creds + freshness"
```

---

### Task 3: Backend adapter + resolveModel branch + routing

**Files:**
- Modify: `packages/core/src/auth/chatgpt-oauth.ts` (`chatgptFetch` + `chatgptModel`)
- Modify: `packages/core/src/provider/provider.ts` (openai oauth branch + `providerHasKey`)
- Modify: `packages/core/src/provider/reliability.ts` (`firstKeyedModel`)
- Test: `packages/core/src/auth/chatgpt-oauth.test.ts`, `packages/core/src/provider/provider.test.ts`

**Interfaces:**
- Produces: `chatgptFetch(creds, inner?)` — a fetch that drops `authorization`/`x-api-key`, sets `Authorization: Bearer <accessToken>` and (if present) `chatgpt-account-id: <accountId>`. `chatgptModel(model, creds)` → an `@ai-sdk/openai` model pointed at the ChatGPT backend base, using the **Responses API** (do NOT call `.chat()`).

**VERIFY-LIVE:** the backend base URL and whether an account header / responses vs chat is required are confirmed in Task 7; wire the code to read them from `CHATGPT_OAUTH` so the live gate corrects one place. Add to `CHATGPT_OAUTH`: `backendBaseUrl: "https://chatgpt.com/backend-api/codex"` (VERIFY LIVE).

- [ ] **Step 1: Write the failing test** (fetch wrapper headers):

```ts
import { chatgptFetch } from "./chatgpt-oauth";

it("chatgptFetch sets the bearer + account header and drops x-api-key", async () => {
  let seen: Headers | undefined;
  const inner = (async (_u: string, init: RequestInit) => { seen = new Headers(init.headers); return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" } as Response; }) as unknown as typeof fetch;
  const f = chatgptFetch({ accessToken: "AT", refreshToken: "RT", expiresAt: Date.now() + 9e5, accountId: "acc_1" }, inner);
  await f("https://chatgpt.com/backend-api/codex/responses", { method: "POST", headers: { "x-api-key": "drop", "content-type": "application/json" }, body: "{}" });
  expect(seen!.get("authorization")).toBe("Bearer AT");
  expect(seen!.get("chatgpt-account-id")).toBe("acc_1");
  expect(seen!.get("x-api-key")).toBeNull();
});
```

Add to `provider.test.ts`:

```ts
it("resolves openai via oauth when there is no api key", () => {
  const config = ConfigSchema.parse({ providers: { openai: { oauth: { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 9e5 } } } });
  expect(resolveModel("openai/gpt-5", { config, env: {} })).toBeTruthy();
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** in `chatgpt-oauth.ts` (import `createOpenAI` from `@ai-sdk/openai`, `LanguageModel` from `ai`; add `backendBaseUrl` to `CHATGPT_OAUTH`):

```ts
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export function chatgptFetch(creds: ChatGPTOAuth, inner: typeof fetch = fetch): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.delete("x-api-key");
    headers.set("authorization", `Bearer ${creds.accessToken}`);
    if (creds.accountId) headers.set("chatgpt-account-id", creds.accountId);
    return inner(url as string, { ...init, headers });
  }) as unknown as typeof fetch;
}

export function chatgptModel(model: string, creds: ChatGPTOAuth): LanguageModel {
  return createOpenAI({ apiKey: "", baseURL: CHATGPT_OAUTH.backendBaseUrl, fetch: chatgptFetch(creds) })(model);
}
```

- [ ] **Step 4: openai branch** in `provider.ts` `case "openai":`:

```ts
    case "openai": {
      const oauth = cfg.oauth as { accessToken: string; refreshToken: string; expiresAt: number; accountId?: string } | undefined;
      if (!cfg.apiKey && !env.OPENAI_API_KEY && oauth) {
        return chatgptModel(model, oauth);
      }
      return createOpenAI({
        apiKey: requireKey(provider, cfg.apiKey ?? env.OPENAI_API_KEY),
        baseURL: cfg.baseURL,
      })(model);
    }
```

(Import `chatgptModel` from `../auth/chatgpt-oauth`.)

- [ ] **Step 5: Routing.** In `providerHasKey` (provider.ts), after the anthropic-oauth line add `if (provider === "openai" && config.providers.openai?.oauth) return true;`. In `firstKeyedModel` (reliability.ts), change the openai line to OR-in oauth like anthropic's:

```ts
  if (!providerMarkedBad("openai") && (has("openai", "OPENAI_API_KEY") || Boolean(config.providers.openai?.oauth)))
    return "openai/gpt-4o-mini";
```

- [ ] **Step 6: Run auth + provider folders + typecheck + build.** Commit:

```bash
git add packages/core/src/auth/chatgpt-oauth.ts packages/core/src/provider/provider.ts packages/core/src/provider/reliability.ts packages/core/src/provider/provider.test.ts
git commit -m "feat(core): resolve openai via ChatGPT oauth (isolated backend fetch)"
```

---

### Task 4: Wire freshness into the session

**Files:**
- Modify: `packages/core/src/session/session.ts`
- Test: (covered by Task 2's `ensureFreshChatGPTConfig` unit test; no new session test needed)

- [ ] **Step 1: Import + call.** In `session.ts`, next to the existing `import { ensureFreshClaudeConfig } from "../auth/oauth";`, add `import { ensureFreshChatGPTConfig } from "../auth/chatgpt-oauth";`. In `prompt`, where the Claude refresh is called (the `if (this.deps.config.providers.anthropic?.oauth) { await ensureFreshClaudeConfig(...) }` block), add right after:

```ts
    if (this.deps.config.providers.openai?.oauth) {
      await ensureFreshChatGPTConfig(this.deps.config);
    }
```

- [ ] **Step 2: Run the session tests + build + typecheck.** Commit:

```bash
git add packages/core/src/session/session.ts
git commit -m "feat(core): auto-refresh ChatGPT oauth before a turn"
```

---

### Task 5: TUI /login-chatgpt + /logout-chatgpt

**Files:**
- Modify: `packages/tui/src/commands.ts`, `packages/tui/src/app.tsx`

**Interfaces:**
- Consumes: `beginChatGPTLogin`, `pollChatGPTLogin`, `saveChatGPTOAuth`, `clearChatGPTOAuth`.

- [ ] **Step 1: Register** in `commands.ts` near `login-claude`:

```ts
  { name: "login-chatgpt", desc: "Sign in with a ChatGPT Plus/Pro subscription (experimental)" },
  { name: "logout-chatgpt", desc: "Disconnect the ChatGPT subscription login" },
```

- [ ] **Step 2: Handle** in `app.tsx` `handleCommand` (device-code: begin, print URL+code, poll in background, notify). Add the four imports.

```ts
      case "login-chatgpt": {
        beginChatGPTLogin().then((grant) => {
          pushHistory({ kind: "notice", text: [
            "Experimental — sign in with your ChatGPT Plus/Pro subscription:",
            `  1. Open: ${grant.verificationUri}`,
            `  2. Enter this code: ${grant.userCode}`,
            "Waiting for you to approve… (this may take a moment; it falls back to /key or the free model if it fails)",
          ].join("\n") });
          return pollChatGPTLogin(grant.deviceCode, { intervalMs: grant.interval * 1000 });
        }).then((creds) => {
          saveChatGPTOAuth(creds);
          forceRender((n) => n + 1);
          pushHistory({ kind: "notice", text: "✓ ChatGPT subscription connected (experimental)." });
        }).catch((err) => {
          pushHistory({ kind: "error", text: err instanceof Error ? err.message : String(err) });
        });
        break;
      }
      case "logout-chatgpt": {
        clearChatGPTOAuth();
        forceRender((n) => n + 1);
        pushHistory({ kind: "notice", text: "Disconnected the ChatGPT subscription login." });
        break;
      }
```

- [ ] **Step 3: Typecheck + build.** Commit:

```bash
git add packages/tui/src/commands.ts packages/tui/src/app.tsx
git commit -m "feat(tui): /login-chatgpt + /logout-chatgpt (experimental)"
```

---

### Task 6: Server routes + desktop Connect modal + auth.ts flip

**Files:**
- Modify: `packages/server/src/server.ts`, `packages/core/src/auth/auth.ts`, `packages/desktop/src/renderer/Settings.tsx`
- Test: `packages/server/src/server.test.ts`

**Interfaces:**
- Produces: `POST /auth/chatgpt/start` → `{ verificationUri, userCode }` and begins polling server-side (module-level pending state); `GET /auth/chatgpt/status` → `{ state: "pending" | "connected" | "failed", error? }`. `auth.ts` flips openai's `oauth-browser` method to available (experimental). Desktop modal shows the code + a polling status.

- [ ] **Step 1: Server test**

```ts
it("starts a ChatGPT device login", async () => {
  const start = await fetch(`${base()}/auth/chatgpt/start`, { method: "POST" });
  // Without network the device-authorize call fails → 200 with a failed status OR 502; assert it doesn't crash (not 404) and returns JSON.
  expect([200, 502]).toContain(start.status);
});
```

(Adapt to the real behavior — the device-authorize call hits the network; in CI it will fail. The route must return a clean JSON error, not crash. If mocking is needed, thread a fetch override through the server ctx; otherwise assert non-404 + JSON shape and note the limitation.)

- [ ] **Step 2: Implement routes.** Module-level `let chatgptLogin: { state: string; error?: string } = { state: "idle" };` and:

```ts
  if (req.method === "POST" && parts.length === 3 && parts[0] === "auth" && parts[1] === "chatgpt" && parts[2] === "start") {
    try {
      const grant = await beginChatGPTLogin();
      chatgptLogin = { state: "pending" };
      pollChatGPTLogin(grant.deviceCode, { intervalMs: grant.interval * 1000 })
        .then((creds) => { saveChatGPTOAuth(creds); chatgptLogin = { state: "connected" }; })
        .catch((err) => { chatgptLogin = { state: "failed", error: err instanceof Error ? err.message : String(err) }; });
      return sendJson(res, 200, { verificationUri: grant.verificationUri, userCode: grant.userCode });
    } catch (err) {
      return sendJson(res, 502, { error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (req.method === "GET" && parts.length === 3 && parts[0] === "auth" && parts[1] === "chatgpt" && parts[2] === "status") {
    return sendJson(res, 200, chatgptLogin);
  }
```

(Import `beginChatGPTLogin`, `pollChatGPTLogin`, `saveChatGPTOAuth`.)

- [ ] **Step 3: auth.ts flip.** For openai, change `oauth-browser` to `{ id: "oauth-browser", label: "ChatGPT Plus/Pro login", available: true, hint: "Experimental — sign in with your subscription. Highest chance of breaking; falls back to a key or the free model." }`. Leave oauth-headless unavailable. Update `auth.test.ts` (openai now has 1 unavailable oauth method, not 2).

- [ ] **Step 4: Desktop modal.** In `Settings.tsx`, for openai's `oauth-browser` method: a button POSTs `/auth/chatgpt/start`, shows the returned `userCode` + verification link (opens externally), then polls `/auth/chatgpt/status` every ~3s and shows connected/failed. Reuse the Claude flow's styles; label experimental.

- [ ] **Step 5: Build core + server tests + desktop typecheck.** Commit:

```bash
git add packages/server/src/server.ts packages/core/src/auth/auth.ts packages/server/src/server.test.ts packages/desktop/src/renderer/Settings.tsx
git commit -m "feat: ChatGPT subscription login live in server + desktop (experimental)"
```

---

### Task 7: Docs, offline verify, and the MANUAL live gate

**Files:**
- Modify: `docs/configuration.md`

- [ ] **Step 1: Docs.** Add a "ChatGPT subscription login (experimental)" note near the Claude one: needs Plus/Pro, `/login-chatgpt` (enter the code on OpenAI's page) or the Connect modal, experimental + highest ToS risk, falls back to keyless.

- [ ] **Step 2: Offline verify.** `pnpm -r build && pnpm -r typecheck && npx vitest run` — all green (278 + new tests).

- [ ] **Step 3: MANUAL live gate (human).** Not automatable — the human logs in with a real ChatGPT Plus/Pro account:
  1. TUI `/login-chatgpt` (or the desktop modal). Open the URL, enter the code, approve.
  2. Pick an `openai/*` model and send a prompt.
  - **PASS:** a real reply. **FAIL modes → correct only `CHATGPT_OAUTH` (+ backendBaseUrl/headers):** device-authorize 404 (wrong endpoint/client), token never resolves (wrong grant/params), or the message call 401/404 (wrong backend base, missing `chatgpt-account-id`, or responses-vs-chat mismatch — the most likely failure; try toggling `.responses()`/`.chat()` and the base).

- [ ] **Step 4: Commit (no push — final review first).**

```bash
git add -A
git commit -m "feat: ChatGPT Pro/Plus subscription login (experimental)"
```

---

## Notes for the executor
- Everything is offline-testable except Task 7 Step 3 — surface it to the human and pause; don't mark "done" on offline tests alone.
- The backend base URL + account header + responses/chat choice are the most likely live-gate corrections; they're all read from `CHATGPT_OAUTH` / the `chatgptFetch`+`chatgptModel` pair so a fix touches one place.
- All ToS-gray code is in `chatgpt-oauth.ts` + the one `resolveModel` branch — deletable to revert.
