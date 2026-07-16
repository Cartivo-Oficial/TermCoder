# termcoder Pro Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let someone buy an annual termcoder Pro licence with Pix, card or PayPal, and collect their key from the dashboard, with no database.

**Architecture:** The static site opens a Paddle Checkout overlay carrying `customData.sub`, which binds the payment to the signed-in identity. The existing Cloudflare Worker (`termcoder-auth`) gains a signed-session mint on the OAuth callback and a `POST /license` endpoint that asks Paddle who paid, then signs an Ed25519 licence key on the fly. Paddle's API is the record of purchase; the Worker stores nothing.

**Tech Stack:** Cloudflare Workers (ES modules, WebCrypto), Paddle Billing (client-side `Paddle.js` + REST API), Vite + React (the site), vitest.

**Spec:** `docs/superpowers/specs/2026-07-16-termcoder-pro-checkout-design.md`

## Global Constraints

- **The licence key wire format is fixed and must match `packages/core/src/license/license.ts` exactly:** `b64url(utf8(JSON.stringify(payload)))` + `"."` + `b64url(rawEd25519Signature)`. Payload is `{ email, tier: "pro", issued, expires?, name? }`. `b64url` = standard base64 with `+`→`-`, `/`→`_`, trailing `=` stripped. Node's `sign(null, data, ed25519Key)` and WebCrypto's `crypto.subtle.sign("Ed25519", ...)` both produce the raw 64-byte signature, so they interoperate.
- **Never sign an empty email.** `verifyLicenseKey` rejects a payload with no email as `"bad payload"`, which mints a key that cannot activate.
- **`sub` is the identity key, never `login` and never email.** `"github:" + u.id` or `"google:" + u.sub`.
- **Secrets never enter the repo.** `PRO_PRIVATE_KEY`, `PADDLE_API_KEY`, `SESSION_SECRET` are Worker secrets. Only public tokens go in `config.js`.
- **`callback.html` and the `redirect_uri` do not move.** `/TermCoder/callback.html` is registered with GitHub and Google.
- **Code carries no comments** (repo rule). Explanations belong in commit messages.
- **The deployed site is `app/`.** `site/` and `website/` are dead weight; do not edit their copies of `auth.js`.
- **Blocked on the user before any real money moves:** production Ed25519 keypair (the embedded `PRO_PUBLIC_KEY` is a DEV key), Paddle account + `priceId` + client token, and the three Worker secrets. Tasks 1–9 are all implementable and testable against a locally generated test keypair and a faked Paddle.

---

## File Structure

| File | Responsibility |
|---|---|
| `website/auth/session.mjs` | mint/verify HMAC session tokens (pure) |
| `website/auth/license.mjs` | build + Ed25519-sign a licence payload (pure) |
| `website/auth/paddle.mjs` | find a completed purchase for a `sub` (one injected `fetch`) |
| `website/auth/worker.js` | routing, OAuth exchange, CORS; wires the three above |
| `app/public/config.js` | adds public `window.TC_PAY` |
| `app/public/auth.js` | stores the Worker's session token |
| `app/src/lib/session.ts` | read `tc-session`, expose `{ sub, email, session }` |
| `app/src/lib/paddle.ts` | load Paddle.js, open the overlay |
| `app/src/lib/license.ts` | call `POST /license`, cache the result |
| `app/src/components/licence-panel.tsx` | the four-state panel |
| `app/src/pages/dashboard.tsx` | mounts the panel |
| `app/src/pages/pricing.tsx` | Buy button |

---

### Task 1: Session tokens in the Worker

**Files:**
- Create: `website/auth/session.mjs`
- Test: `website/auth/session.test.mjs`
- Modify: `vitest.config.ts:17`

**Interfaces:**
- Consumes: nothing.
- Produces: `signSession(claims: {sub, email, name, provider}, secret: string): Promise<string>` and `verifySession(token: string, secret: string, now?: number): Promise<{sub, email, name, provider, iat, exp} | null>`. Returns `null` for any tampered, malformed or expired token. Session lifetime is 30 days.

- [ ] **Step 1: Extend the vitest include so `website/auth` tests run**

In `vitest.config.ts`, replace line 17:

```ts
    include: ["packages/*/src/**/*.{test,spec}.{ts,tsx}", "website/auth/**/*.test.mjs"],
```

- [ ] **Step 2: Write the failing test**

Create `website/auth/session.test.mjs`:

```js
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
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run website/auth/session.test.mjs`
Expected: FAIL — `Failed to load url ./session.mjs` (the module does not exist yet).

- [ ] **Step 4: Implement**

Create `website/auth/session.mjs`:

```js
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const enc = new TextEncoder();

export function b64url(bytes) {
  let s = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(claims, secret) {
  const now = Date.now();
  const payload = { ...claims, iat: now, exp: now + TTL_MS };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token, secret, now = Date.now()) {
  try {
    const trimmed = (token ?? "").trim();
    const dot = trimmed.indexOf(".");
    if (dot <= 0 || dot >= trimmed.length - 1) return null;
    const body = trimmed.slice(0, dot);
    const sig = b64urlDecode(trimmed.slice(dot + 1));
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, enc.encode(body));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!claims.sub || !claims.exp || now > claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run website/auth/session.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add website/auth/session.mjs website/auth/session.test.mjs vitest.config.ts
git commit -m "feat(auth): HMAC session tokens for the auth Worker"
```

---

### Task 2: Licence signing, cross-verified against the real verifier

**Files:**
- Create: `website/auth/license.mjs`
- Test: `website/auth/license.test.mjs`

**Interfaces:**
- Consumes: `b64url` from `./session.mjs`.
- Produces: `signLicenseKey(claims: {email, name?, issued, expires}, privateKeyPem: string): Promise<string>` returning the `payload.signature` key string. Throws `Error("email required")` when email is empty.

The test proves interoperability by verifying a Worker-signed key with `verifyLicenseKey` from `packages/core` — the same function the product uses. This is the task's whole point; do not weaken it into a self-consistency check.

- [ ] **Step 1: Write the failing test**

Create `website/auth/license.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run website/auth/license.test.mjs`
Expected: FAIL — cannot resolve `./license.mjs`.

- [ ] **Step 3: Implement**

Create `website/auth/license.mjs`:

```js
import { b64url, b64urlDecode } from "./session.mjs";

const enc = new TextEncoder();

function pemToPkcs8(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  return b64urlDecode(body.replace(/\+/g, "-").replace(/\//g, "_"));
}

export async function signLicenseKey(claims, privateKeyPem) {
  if (!claims.email) throw new Error("email required");
  const payload = { email: claims.email, tier: "pro", issued: claims.issued };
  if (claims.name) payload.name = claims.name;
  if (claims.expires) payload.expires = claims.expires;

  const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(privateKeyPem), { name: "Ed25519" }, false, ["sign"]);
  const bytes = enc.encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("Ed25519", key, bytes);
  return `${b64url(bytes)}.${b64url(sig)}`;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run website/auth/license.test.mjs`
Expected: PASS, 4 tests. If `importKey` throws `Unrecognized name`, the Node version predates Ed25519 in WebCrypto — check `node -e "crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']).then(()=>console.log('ok'))"` and upgrade to Node 22.

- [ ] **Step 5: Commit**

```bash
git add website/auth/license.mjs website/auth/license.test.mjs
git commit -m "feat(auth): sign Ed25519 licence keys in the Worker"
```

---

### Task 3: Finding a purchase in Paddle

**Files:**
- Create: `website/auth/paddle.mjs`
- Test: `website/auth/paddle.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `findPurchase(sub: string, opts: {apiKey: string, priceId: string, fetch?: typeof fetch}): Promise<{billedAt: number, email: string} | null>`. Scans completed transactions newest-first, at most `MAX_PAGES` (5) of 200. Returns the newest transaction whose `custom_data.sub` matches and which contains `priceId`.

Paddle cannot filter by `custom_data`, so this scans. At 200/page and 5 pages it covers 1000 lifetime sales; past that, this needs a KV index of `sub → transaction`. The dashboard caches the issued key, so this runs rarely.

- [ ] **Step 1: Write the failing test**

Create `website/auth/paddle.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { findPurchase } from "./paddle.mjs";

const PRICE = "pri_test";

const tx = (sub, billedAt, priceId = PRICE, email = "buyer@example.com") => ({
  id: "txn_" + billedAt,
  status: "completed",
  custom_data: sub ? { sub } : null,
  billed_at: new Date(billedAt).toISOString(),
  items: [{ price: { id: priceId } }],
  customer: { email },
});

const fakeFetch = (pages) => async (url) => {
  const after = new URL(url).searchParams.get("after");
  const i = after ? Number(after) : 0;
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: pages[i] ?? [],
      meta: { pagination: { has_more: i + 1 < pages.length, next: `https://api.paddle.com/transactions?after=${i + 1}` } },
    }),
  };
};

describe("findPurchase", () => {
  it("finds a matching purchase and returns its billing time and email", async () => {
    const t = Date.parse("2026-03-01T00:00:00Z");
    const f = fakeFetch([[tx("github:1", t)]]);
    const out = await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f });
    expect(out).toEqual({ billedAt: t, email: "buyer@example.com" });
  });

  it("returns null when nobody with that sub bought", async () => {
    const f = fakeFetch([[tx("github:2", Date.now())]]);
    expect(await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f })).toBeNull();
  });

  it("ignores a transaction for a different price", async () => {
    const f = fakeFetch([[tx("github:1", Date.now(), "pri_other")]]);
    expect(await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f })).toBeNull();
  });

  it("follows pagination", async () => {
    const t = Date.parse("2026-02-01T00:00:00Z");
    const f = fakeFetch([[tx("github:9", Date.now())], [tx("github:1", t)]]);
    const out = await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f });
    expect(out.billedAt).toBe(t);
  });

  it("tolerates a transaction with no custom_data", async () => {
    const f = fakeFetch([[tx(null, Date.now())]]);
    expect(await findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f })).toBeNull();
  });

  it("throws when Paddle errors", async () => {
    const f = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await expect(findPurchase("github:1", { apiKey: "k", priceId: PRICE, fetch: f })).rejects.toThrow("paddle_500");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run website/auth/paddle.test.mjs`
Expected: FAIL — cannot resolve `./paddle.mjs`.

- [ ] **Step 3: Implement**

Create `website/auth/paddle.mjs`:

```js
const MAX_PAGES = 5;
const API = "https://api.paddle.com/transactions?status=completed&per_page=200&order_by=billed_at[DESC]";

export async function findPurchase(sub, opts) {
  const doFetch = opts.fetch ?? fetch;
  let url = API;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await doFetch(url, {
      headers: { authorization: "Bearer " + opts.apiKey, accept: "application/json" },
    });
    if (!res.ok) throw new Error("paddle_" + res.status);
    const body = await res.json();

    for (const t of body.data ?? []) {
      if (t.custom_data?.sub !== sub) continue;
      const priced = (t.items ?? []).some((i) => i.price?.id === opts.priceId);
      if (!priced) continue;
      return {
        billedAt: Date.parse(t.billed_at),
        email: t.customer?.email ?? "",
      };
    }

    const pag = body.meta?.pagination;
    if (!pag?.has_more || !pag.next) return null;
    url = pag.next;
  }
  return null;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run website/auth/paddle.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add website/auth/paddle.mjs website/auth/paddle.test.mjs
git commit -m "feat(auth): find a completed Paddle purchase by sub"
```

---

### Task 4: The Worker returns stable ids and a signed session

**Files:**
- Modify: `website/auth/worker.js` (the `github` and `google` functions, and the `fetch` handler's CORS block)
- Test: `website/auth/worker.test.mjs` (create)

**Interfaces:**
- Consumes: `signSession` from `./session.mjs`.
- Produces: `POST /callback` response gains `sub` and `session`. Shape: `{ provider, login?, name, email, avatar, token, sub, session }`.

`github()` currently drops `u.id` and `google()` drops `u.sub`; both must be captured. `login` is renameable and must never be the identity key.

- [ ] **Step 1: Write the failing test**

Create `website/auth/worker.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { allowOrigin } from "./worker.js";

describe("allowOrigin", () => {
  it("allows the production site", () => {
    expect(allowOrigin("https://cartivo-oficial.github.io")).toBe("https://cartivo-oficial.github.io");
  });

  it("allows localhost for development", () => {
    expect(allowOrigin("http://localhost:4199")).toBe("http://localhost:4199");
  });

  it("refuses an unknown origin", () => {
    expect(allowOrigin("https://evil.example.com")).toBe("");
  });

  it("refuses a missing origin", () => {
    expect(allowOrigin(null)).toBe("");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run website/auth/worker.test.mjs`
Expected: FAIL — `allowOrigin` is not exported.

- [ ] **Step 3: Implement**

In `website/auth/worker.js`, add the import at the top of the file, under the existing header comment:

```js
import { signSession } from "./session.mjs";
```

Add this exported function just above `export default {`:

```js
const ALLOWED_ORIGINS = ["https://cartivo-oficial.github.io"];

export function allowOrigin(origin) {
  if (!origin) return "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return origin;
  return "";
}
```

Replace the `cors` block at the top of `fetch` (currently `"Access-Control-Allow-Origin": origin`):

```js
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin(request.headers.get("Origin")),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
```

In `github()`, replace the `return` with:

```js
  return {
    provider: "github",
    sub: "github:" + u.id,
    login: u.login,
    name: u.name || u.login || "",
    email: email || "",
    avatar: u.avatar_url || "",
    token: tok.access_token,
  };
```

In `google()`, replace the `return` with:

```js
  return { provider: "google", sub: "google:" + u.sub, name: u.name || "", email: u.email || "", avatar: u.picture || "" };
```

In the `fetch` handler, replace the two provider dispatch lines:

```js
      let profile = null;
      if (provider === "github") profile = await github(code, redirect_uri, env);
      if (provider === "google") profile = await google(code, redirect_uri, env);
      if (!profile) return json({ error: "unknown_provider" }, 400, cors);
      if (!env.SESSION_SECRET) return json({ error: "auth_not_configured" }, 503, cors);
      profile.session = await signSession(
        { sub: profile.sub, email: profile.email, name: profile.name, provider: profile.provider },
        env.SESSION_SECRET,
      );
      return json(profile, 200, cors);
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run website/auth/worker.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add website/auth/worker.js website/auth/worker.test.mjs
git commit -m "feat(auth): return a stable sub and a signed session from the callback"
```

---

### Task 5: `POST /license` on the Worker

**Files:**
- Modify: `website/auth/worker.js` (the `fetch` handler routing)
- Test: `website/auth/issue.test.mjs` (create)
- Create: `website/auth/issue.mjs`

**Interfaces:**
- Consumes: `verifySession` (Task 1), `signLicenseKey` (Task 2), `findPurchase` (Task 3).
- Produces: `issueLicense(body: {session: string}, env, deps?: {findPurchase}): Promise<{status: number, body: object}>`. The route handler is a thin wrapper so the logic is testable without a Worker runtime.

Response contract:
- `200 { active: true, key, email, issued, expires }`
- `200 { active: false, reason: "no-purchase" }`
- `401 { error: "bad_session" }`
- `503 { error: "not_configured" }`
- `502 { error: "paddle_unreachable" }` — never implies the user did not pay.

- [ ] **Step 1: Write the failing test**

Create `website/auth/issue.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run website/auth/issue.test.mjs`
Expected: FAIL — cannot resolve `./issue.mjs`.

- [ ] **Step 3: Implement**

Create `website/auth/issue.mjs`:

```js
import { verifySession } from "./session.mjs";
import { signLicenseKey } from "./license.mjs";
import { findPurchase as realFindPurchase } from "./paddle.mjs";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function issueLicense(body, env, deps = {}) {
  const find = deps.findPurchase ?? realFindPurchase;

  const claims = await verifySession(body?.session ?? "", env.SESSION_SECRET ?? "");
  if (!claims) return { status: 401, body: { error: "bad_session" } };

  if (!env.PADDLE_API_KEY || !env.PADDLE_PRICE_ID || !env.PRO_PRIVATE_KEY) {
    return { status: 503, body: { error: "not_configured" } };
  }

  let purchase;
  try {
    purchase = await find(claims.sub, { apiKey: env.PADDLE_API_KEY, priceId: env.PADDLE_PRICE_ID });
  } catch {
    return { status: 502, body: { error: "paddle_unreachable" } };
  }
  if (!purchase) return { status: 200, body: { active: false, reason: "no-purchase" } };

  const email = claims.email || purchase.email;
  if (!email) return { status: 200, body: { active: false, reason: "no-email" } };

  const issued = purchase.billedAt;
  const expires = issued + YEAR_MS;
  const key = await signLicenseKey({ email, name: claims.name, issued, expires }, env.PRO_PRIVATE_KEY);
  return { status: 200, body: { active: true, key, email, issued, expires } };
}
```

In `website/auth/worker.js`, add the import:

```js
import { issueLicense } from "./issue.mjs";
```

In the `fetch` handler, replace the 404 guard:

```js
    const url = new URL(request.url);
    if (request.method !== "POST") return json({ error: "not_found" }, 404, cors);
    const isCallback = url.pathname.endsWith("/callback");
    const isLicense = url.pathname.endsWith("/license");
    if (!isCallback && !isLicense) return json({ error: "not_found" }, 404, cors);
```

Then, immediately after the `body` parse block and before the `const { provider, code, redirect_uri } = body || {};` line:

```js
    if (isLicense) {
      const out = await issueLicense(body, env);
      return json(out.body, out.status, cors);
    }
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run website/auth/issue.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — 390 tests: the 364 that already exist plus 26 from Tasks 1–5 (5 session, 4 licence, 6 paddle, 4 worker, 7 issue).

- [ ] **Step 6: Commit**

```bash
git add website/auth/issue.mjs website/auth/issue.test.mjs website/auth/worker.js
git commit -m "feat(auth): issue a licence key for a verified Paddle purchase"
```

---

### Task 6: Document and configure the Worker's new secrets

**Files:**
- Modify: `website/auth/README.md`
- Modify: `website/auth/wrangler.toml`

**Interfaces:**
- Consumes: nothing.
- Produces: no code. `PADDLE_PRICE_ID` is a public var; the other three are secrets.

- [ ] **Step 1: Add the price id as a public var**

In `website/auth/wrangler.toml`, under `[vars]`:

```toml
PADDLE_PRICE_ID = "pri_REPLACE_ME"
```

- [ ] **Step 2: Document the secrets**

Append to `website/auth/README.md`:

```markdown
## Pro checkout

The Worker mints licence keys for verified Paddle purchases. Three more secrets:

    wrangler secret put SESSION_SECRET     # any long random string; signs dashboard sessions
    wrangler secret put PADDLE_API_KEY     # Paddle → Developer tools → Authentication
    wrangler secret put PRO_PRIVATE_KEY    # contents of pro-private.pem (PKCS8)

`PADDLE_PRICE_ID` is public and lives in `wrangler.toml`.

`PRO_PRIVATE_KEY` is the Ed25519 private half generated by
`packages/core/scripts/gen-keypair.mjs`. Its public half must be embedded as
`PRO_PUBLIC_KEY` in `packages/core/src/license/license.ts`. **The key shipped in
that file today is a development key** — regenerate before selling anything, or
every licence is forgeable by anyone who reads the repo.

Rotating `SESSION_SECRET` signs everyone out; nothing else breaks.
```

- [ ] **Step 3: Commit**

```bash
git add website/auth/README.md website/auth/wrangler.toml
git commit -m "docs(auth): how to configure the Pro checkout secrets"
```

---

### Task 7: The site stores the session and reads it back

**Files:**
- Modify: `app/public/auth.js` (the `handleCallback` localStorage write)
- Modify: `app/public/config.js`
- Create: `app/src/lib/session.ts`

**Interfaces:**
- Consumes: the Worker's `/callback` response (Task 4).
- Produces: `readSession(): Session | null` and `signOut(): void` from `app/src/lib/session.ts`, where `interface Session { provider: string; name: string; email: string; avatar: string; token: string; sub: string; session: string }`. `dashboard.tsx` currently defines its own copy of both — it must import them from here instead so there is one definition.

- [ ] **Step 1: Store the new fields**

In `app/public/auth.js`, inside `handleCallback`, extend the `localStorage.setItem` call:

```js
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        provider: provider,
        name: profile.name || profile.login || "",
        email: profile.email || "",
        avatar: profile.avatar || "",
        token: provider === "github" ? (profile.token || "") : "",
        sub: profile.sub || "",
        session: profile.session || "",
      }));
```

- [ ] **Step 2: Add the public payment config**

In `app/public/config.js`, after the `window.TC_AUTH` block:

```js
window.TC_PAY = {
  environment: "sandbox",
  clientToken: "",
  priceId: "",
};
```

- [ ] **Step 3: Create the shared session module**

Create `app/src/lib/session.ts`:

```ts
const SESSION_KEY = "tc-session";

export interface Session {
  provider: string;
  name: string;
  email: string;
  avatar: string;
  token: string;
  sub: string;
  session: string;
}

export function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function signOut(): void {
  localStorage.removeItem(SESSION_KEY);
  location.href = "login.html";
}
```

- [ ] **Step 4: Point the dashboard at it**

In `app/src/pages/dashboard.tsx`, delete the local `SESSION_KEY` constant, the `Session` interface, and the `readSession` and `signOut` functions, and add to the imports:

```ts
import { readSession, signOut, type Session } from "@/lib/session";
```

- [ ] **Step 5: Verify the build still passes**

Run: `cd app && npm run build && node verify.mjs`
Expected: `11 route(s) prerendered.` and `verify: 13 pages, every asset URL resolves, OAuth files intact.`

- [ ] **Step 6: Commit**

```bash
git add app/public/auth.js app/public/config.js app/src/lib/session.ts app/src/pages/dashboard.tsx
git commit -m "feat(app): carry the Worker's signed session and share one session module"
```

---

### Task 8: Opening the Paddle checkout

**Files:**
- Create: `app/src/lib/paddle.ts`

**Interfaces:**
- Consumes: `Session` from `@/lib/session`.
- Produces: `payConfigured(): boolean` and `openCheckout(session: Session): Promise<void>`. `openCheckout` loads Paddle.js on first use, then opens the overlay with `customData: { sub }`.

`customData.sub` is the entire binding between a payment and a person. Without it the Worker cannot match the purchase.

- [ ] **Step 1: Implement**

Create `app/src/lib/paddle.ts`:

```ts
import type { Session } from "@/lib/session";

interface PayConfig {
  environment: "sandbox" | "production";
  clientToken: string;
  priceId: string;
}

declare global {
  interface Window {
    TC_PAY?: PayConfig;
    Paddle?: {
      Environment: { set: (e: string) => void };
      Initialize: (o: { token: string }) => void;
      Checkout: { open: (o: unknown) => void };
    };
  }
}

const SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";
let loading: Promise<void> | null = null;

export function payConfigured(): boolean {
  const c = window.TC_PAY;
  return Boolean(c && c.clientToken && c.priceId);
}

function loadPaddle(): Promise<void> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("paddle.js failed to load"));
    document.head.appendChild(s);
  });
  return loading;
}

export async function openCheckout(session: Session): Promise<void> {
  const cfg = window.TC_PAY;
  if (!cfg || !payConfigured()) throw new Error("checkout is not configured yet");
  await loadPaddle();
  const paddle = window.Paddle;
  if (!paddle) throw new Error("paddle.js unavailable");

  paddle.Environment.set(cfg.environment);
  paddle.Initialize({ token: cfg.clientToken });
  paddle.Checkout.open({
    items: [{ priceId: cfg.priceId, quantity: 1 }],
    customData: { sub: session.sub },
    customer: session.email ? { email: session.email } : undefined,
    settings: { displayMode: "overlay", theme: "dark" },
  });
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd app && npx tsc -b`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/paddle.ts
git commit -m "feat(app): open the Paddle checkout bound to the signed-in sub"
```

---

### Task 9: Fetching and caching the licence

**Files:**
- Create: `app/src/lib/license.ts`

**Interfaces:**
- Consumes: `Session` from `@/lib/session`; `window.TC_AUTH.workerUrl` from `config.js`.
- Produces: `type LicenseState = { status: "loading" } | { status: "none" } | { status: "active"; key: string; email: string; expires: number } | { status: "error"; message: string }` and `fetchLicense(session: Session): Promise<LicenseState>`, plus `cachedLicense(): LicenseState | null` and `cacheLicense(s: LicenseState): void` using the `tc-license` localStorage key.

The cache exists so a dashboard visit does not hit Paddle every time, and so a Paddle outage never makes a paying user look unpaid.

- [ ] **Step 1: Implement**

Create `app/src/lib/license.ts`:

```ts
import type { Session } from "@/lib/session";

const CACHE_KEY = "tc-license";

export type LicenseState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "active"; key: string; email: string; expires: number }
  | { status: "error"; message: string };

export function cachedLicense(): LicenseState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as LicenseState) : null;
  } catch {
    return null;
  }
}

export function cacheLicense(state: LicenseState): void {
  if (state.status !== "active") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(state));
}

export async function fetchLicense(session: Session): Promise<LicenseState> {
  const worker = window.TC_AUTH?.workerUrl;
  if (!worker) return { status: "error", message: "Sign-in isn't configured yet." };
  if (!session.session) return { status: "error", message: "Please sign in again to see your licence." };

  try {
    const res = await fetch(worker.replace(/\/$/, "") + "/license", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: session.session }),
    });
    const body = await res.json();

    if (res.status === 401) return { status: "error", message: "Please sign in again to see your licence." };
    if (res.status === 503) return { status: "error", message: "Checkout isn't switched on yet." };
    if (!res.ok) return { status: "error", message: "Couldn't reach the licence service — your key still works offline." };
    if (!body.active) return { status: "none" };

    const state: LicenseState = { status: "active", key: body.key, email: body.email, expires: body.expires };
    cacheLicense(state);
    return state;
  } catch {
    return { status: "error", message: "Couldn't reach the licence service — your key still works offline." };
  }
}
```

Add to `app/src/lib/session.ts`, so `TC_AUTH` is typed once:

```ts
declare global {
  interface Window {
    TC_AUTH?: { workerUrl?: string };
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd app && npx tsc -b`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/license.ts app/src/lib/session.ts
git commit -m "feat(app): fetch and cache the licence, and never call a payer unpaid"
```

---

### Task 10: The licence panel

**Files:**
- Create: `app/src/components/licence-panel.tsx`
- Modify: `app/src/pages/dashboard.tsx`

**Interfaces:**
- Consumes: `readSession`, `fetchLicense`, `cachedLicense`, `openCheckout`, `payConfigured`.
- Produces: `<LicencePanel />`, mounted by `dashboard.tsx` as a new first tab named `licence`.

Four states: signed out; signed in with no purchase; active; expired. A pending Pix reads as "no purchase", so the copy must say so or the buyer will think their money vanished.

- [ ] **Step 1: Implement the panel**

Create `app/src/components/licence-panel.tsx`:

```tsx
import { useEffect, useState } from "react";
import { readSession, type Session } from "@/lib/session";
import { fetchLicense, cachedLicense, type LicenseState } from "@/lib/license";
import { openCheckout, payConfigured } from "@/lib/paddle";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

export function LicencePanel() {
  const [state, setState] = useState<LicenseState>({ status: "loading" });
  const [session, setSession] = useState<Session | null>(null);

  const load = () => {
    const s = readSession();
    setSession(s);
    if (!s) return setState({ status: "none" });
    const cached = cachedLicense();
    if (cached) setState(cached);
    fetchLicense(s).then((next) => {
      if (next.status === "error" && cached) return;
      setState(next);
    });
  };

  useEffect(load, []);

  if (!session) {
    return (
      <div>
        <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground">Your licence.</h2>
        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
          Sign in and your licence key appears here, ready to paste into the app.
        </p>
        <a href="login.html" className={cn(buttonVariants(), "mt-6 h-11 rounded-md px-5 font-mono text-[14px]")}>
          Sign in
        </a>
      </div>
    );
  }

  const buy = () => {
    if (!session) return;
    void openCheckout(session).catch((e) => setState({ status: "error", message: String(e.message ?? e) }));
  };

  const expired = state.status === "active" && Date.now() > state.expires;
  const daysLeft = state.status === "active" ? Math.max(0, Math.ceil((state.expires - Date.now()) / DAY)) : 0;

  return (
    <div>
      <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground">Your licence.</h2>

      {state.status === "loading" && <p className="mt-3 font-mono text-[13px] text-muted-foreground">Checking…</p>}

      {state.status === "error" && (
        <p className="mt-3 max-w-xl text-[14px] text-muted-foreground">{state.message}</p>
      )}

      {state.status === "none" && (
        <>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
            You are on the free tier: the whole agent, the tutor, joining any room or class, and hosting one guest. Pro
            covers the third person in a room, classrooms, and syncing sessions across machines — for a year, paid once.
          </p>
          <p className="mt-3 max-w-xl text-[13px] text-muted-foreground/60">
            Just paid with Pix? It can take a moment to settle. Hit Refresh.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {payConfigured() ? (
              <button onClick={buy} className={cn(buttonVariants(), "h-11 rounded-md px-5 font-mono text-[14px]")}>
                Get Pro →
              </button>
            ) : (
              <a href="pricing.html" className={cn(buttonVariants(), "h-11 rounded-md px-5 font-mono text-[14px]")}>
                See pricing →
              </a>
            )}
            <button onClick={load} className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-md px-5 font-mono text-[14px]")}>
              Refresh
            </button>
          </div>
        </>
      )}

      {state.status === "active" && (
        <>
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground/50">status</div>
              <div className={cn("mt-1 font-mono text-[14px]", expired ? "text-[#ff6b6b]" : "text-primary")}>
                {expired ? "expired" : "active"}
              </div>
            </div>
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground/50">
                {expired ? "expired on" : "renews"}
              </div>
              <div className="mt-1 font-mono text-[14px] text-foreground">
                {new Date(state.expires).toLocaleDateString()}
              </div>
            </div>
            {!expired && (
              <div className="rounded-md border border-border bg-card px-4 py-3">
                <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground/50">left</div>
                <div className="mt-1 font-mono text-[14px] text-foreground">{daysLeft} days</div>
              </div>
            )}
          </div>

          <p className="mt-6 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Paste this into the app: <span className="text-foreground">Settings → termcoder Pro</span>.
          </p>
          <div className="mt-3 flex max-w-2xl items-start gap-3 rounded-md border border-border bg-[#0d0c0e] p-4">
            <code className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed text-foreground">
              {state.key}
            </code>
            <CopyButton text={state.key} />
          </div>

          {expired && payConfigured() && (
            <button onClick={buy} className={cn(buttonVariants(), "mt-6 h-11 rounded-md px-5 font-mono text-[14px]")}>
              Renew for another year →
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it as the first tab**

In `app/src/pages/dashboard.tsx`:

Add the import:

```ts
import { LicencePanel } from "@/components/licence-panel";
```

Change the `TABS` constant:

```ts
const TABS = ["licence", "overview", "models", "sessions", "recipes", "connectors", "study", "settings"] as const;
```

Change the initial tab:

```ts
  const [tab, setTab] = useState<Tab>("licence");
```

Add the panel as the first entry in the `<section className="min-w-0">` block, above `{tab === "overview" && (`:

```tsx
            {tab === "licence" && <LicencePanel />}
```

- [ ] **Step 3: Build and verify**

Run: `cd app && npm run build && node verify.mjs`
Expected: `11 route(s) prerendered.` and `verify: 13 pages, every asset URL resolves, OAuth files intact.`

- [ ] **Step 4: Check the signed-out and no-purchase states in a browser**

Run: `cd app && npx vite preview --port 4199`
Open `http://localhost:4199/TermCoder/dashboard.html`.

With no `tc-session` in localStorage, expect the "Sign in" state. Then plant one and reload:

```js
localStorage.setItem("tc-session", JSON.stringify({ provider: "github", name: "Test", email: "t@e.com", avatar: "", token: "", sub: "github:1", session: "" }));
```

Expected: the licence panel says "Please sign in again to see your licence." — because the planted session carries no Worker-signed token, which is exactly right.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/licence-panel.tsx app/src/pages/dashboard.tsx
git commit -m "feat(app): a real licence panel on the dashboard"
```

---

### Task 11: The pricing page sells

**Files:**
- Modify: `app/src/pages/pricing.tsx`

**Interfaces:**
- Consumes: `readSession`, `openCheckout`, `payConfigured`.
- Produces: nothing consumed downstream.

The gate now matches the published copy (`6008a06`), so the words stay. Only the button changes: signed out → `login.html`; signed in → the overlay. Checkout requires a session because `customData.sub` is the binding.

- [ ] **Step 1: Replace the Get Pro link**

In `app/src/pages/pricing.tsx`, add to the imports:

```tsx
import { useState, useEffect } from "react";
import { readSession, type Session } from "@/lib/session";
import { openCheckout, payConfigured } from "@/lib/paddle";
```

Turn the component into one that knows about the session by adding this at the top of `export default function Pricing() {`:

```tsx
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => setSession(readSession()), []);

  const getPro = () => {
    const s = readSession();
    if (!s || !payConfigured()) {
      location.href = "login.html";
      return;
    }
    void openCheckout(s);
  };
```

Replace the Pro card's link:

```tsx
              <button
                onClick={getPro}
                className={cn(buttonVariants({ variant: "outline" }), "mt-7 h-11 w-full rounded-md border-study/40 font-mono text-[14px] text-study hover:bg-study/10")}
              >
                {session ? "Get Pro" : "Sign in to get Pro"}
              </button>
```

Replace the note under it:

```tsx
              <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground/60">
                One year, paid once — Pix, card or PayPal. Your key lands in your{" "}
                <a href="dashboard.html" className="text-study underline underline-offset-2">dashboard</a>.
              </p>
```

- [ ] **Step 2: Build and verify**

Run: `cd app && npm run build && node verify.mjs`
Expected: `11 route(s) prerendered.` and verify passes.

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/pricing.tsx
git commit -m "feat(app): wire Get Pro to the checkout"
```

---

### Task 12: Strip comments and ship

**Files:**
- Modify: every file created in Tasks 1–11

**Interfaces:** none.

The repo rule is that termcoder code carries no comments. `worker.js` is pre-existing and keeps its header; only newly written comments go.

- [ ] **Step 1: Check for comments in the new files**

Run:

```bash
grep -rnE '^\s*(//|/\*|\*)' website/auth/session.mjs website/auth/license.mjs website/auth/paddle.mjs website/auth/issue.mjs app/src/lib/session.ts app/src/lib/paddle.ts app/src/lib/license.ts app/src/components/licence-panel.tsx | grep -v eslint
```

Expected: no output. If any appear, remove them — the reasoning belongs in the commit message.

- [ ] **Step 2: Run the full suite one more time**

Run: `npx vitest run`
Expected: PASS, 390 tests.

- [ ] **Step 3: Build the site**

Run: `cd app && npm run build && node verify.mjs`
Expected: 11 routes, verify passes.

- [ ] **Step 4: Commit and merge to main**

```bash
git add -A
git commit -m "chore: strip comments from the checkout code"
git checkout main
git merge --ff-only claude/pro-checkout
git push origin main
```

The branch is `claude/pro-checkout`; create it from `main` before Task 1 with `git checkout -b claude/pro-checkout`.

---

## Manual acceptance, in Paddle sandbox

Not automatable, and not optional before real money moves. Requires the user's Paddle sandbox account.

- [ ] Set `TC_PAY.environment = "sandbox"`, fill `clientToken` and `priceId`, deploy the Worker with sandbox `PADDLE_API_KEY` and a **test** `PRO_PRIVATE_KEY`.
- [ ] Sign in on the site, buy with Paddle's test card, confirm the key appears in the dashboard.
- [ ] Paste the key into the desktop app → Settings → termcoder Pro. Expect it to activate. (It verifies against the embedded public key, so the test private key's public half must be embedded for this run.)
- [ ] Host a room with two guests. Expect the third participant to be admitted.
- [ ] Buy with sandbox Pix. Expect the dashboard to say "no purchase" until settlement, then the key after Refresh.

## Go-live checklist (the user's, not mine)

- [ ] `node packages/core/scripts/gen-keypair.mjs`; embed the public half as `PRO_PUBLIC_KEY` in `packages/core/src/license/license.ts`; keep `pro-private.pem` out of git.
- [ ] `wrangler secret put PRO_PRIVATE_KEY` (production key), `PADDLE_API_KEY` (live), `SESSION_SECRET`.
- [ ] Set the real `PADDLE_PRICE_ID` in `wrangler.toml`; set `TC_PAY.environment = "production"` and the live `clientToken`/`priceId` in `app/public/config.js`.
- [ ] Publish the Paddle price in BRL and USD.
