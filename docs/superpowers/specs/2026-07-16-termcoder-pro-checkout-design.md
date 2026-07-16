# termcoder Pro — checkout and licence delivery

**Date:** 2026-07-16
**Status:** approved, not yet implemented
**Supersedes the payment half of:** `2026-07-14-termcoder-pro-phase1-design.md` (which assumed Gumroad/Lemon Squeezy and a monthly price)

## Problem

Pro is built and gated, but there is no way to pay. The "Get Pro" button on the pricing page is a placeholder pointing at `login.html`. Keys can only be minted by hand with `gen-license.mjs`.

The ask: a checkout that accepts Pix, boleto, credit card, and foreign payment in USD/EUR — from a seller who is a **pessoa física with no CNPJ**, serving Brazilian and international buyers from day one.

## Two corrections this spec depends on

**1. The gate did not match the promise — RESOLVED 2026-07-16 in `6008a06`.** The gate read `room.sockets.size >= 1`, which blocked the next joiner as soon as the host was in the room, so the first guest was already paywalled — while the site promised one free guest. Rather than correct the copy, the user chose to keep the promise, so the gate is now `>= 2`: **Pro is required from the third person in the room**.

The published pricing copy ("Host a room, one guest — free", "the licence starts at the third person") and `study.tsx` ("more than one guest") are therefore now accurate, and **no site copy change is needed**. What we sell, precisely: joining is always free; hosting is free up to one guest; Pro covers the third person onward, classrooms, and session sync.

**2. The browser invents its own session.** `auth.js` builds the session client-side and the Worker signs nothing:

```js
localStorage.setItem(SESSION_KEY, JSON.stringify({ provider, name, email, avatar, token }))
```

Harmless while the dashboard only displays your own data. Fatal the moment the dashboard hands out licence keys: anyone can set `{email: "someone@else.com"}` and ask for their key. Google sessions carry no token at all, so there is nothing to verify against. The Worker must issue a signed session.

## What we sell

**One SKU: an annual licence, paid once.** Not a subscription.

This is forced by a verified constraint and confirmed by the existing design:

- Paddle supports Pix, but "Pix only supports one-time purchases (not subscriptions)", BRL only, buyer in Brazil.
- The licence is already a term licence, not a subscription: `LicensePayload = { email, tier: "pro", issued, expires? }`, Ed25519-signed, verified offline against an embedded public key. A subscription over offline keys cannot be revoked on cancellation and would need a re-issue every month.

So an annual key with `expires = issued + 365d` fits Pix, fits the existing crypto, and needs no recurring machinery. Price is set by the user in Paddle (BRL and USD); Paddle localises presentation.

## Provider: Paddle, alone

Verified:

- **Accepts individuals.** No incorporation. Business verification is skipped for individuals/sole traders; only identity verification (government ID + proof of address, via Sumsub). Approval estimated 2–4 business days.
- **Pix with no Brazilian entity.** "You don't need to set up a bank account in Brazil or sign up for a Pix merchant account to add Pix as a payment option with Paddle." Buyer supplies CPF/CNPJ at checkout. Capped at R$250,000.
- **International out of the box.** Cards, PayPal, Apple/Google Pay, and more, in USD/EUR, as Merchant of Record — Paddle owns the tax liability.

**Boleto is not supported by Paddle and is dropped for now** (user's call). Pix settles instantly and covers most of the same buyers. If boleto later becomes non-negotiable, Mercado Pago accepts CPF and does Pix + boleto + card in BRL — but that means a second account, a second webhook, and Brazilian tax handling falls back on the user. Out of scope here.

## Architecture

Three moving parts. The site is static (GitHub Pages); the only compute is the existing Cloudflare Worker `termcoder-auth`.

```
pricing.html ──"Get Pro"──> login.html (if signed out)
                               │
                               ▼
                        Paddle Checkout overlay
                        customData: { sub }
                               │  Pix / card / PayPal
                               ▼
                        Paddle records the transaction
                               │
dashboard.html "Your licence" ─┤
      │  POST /license { session }
      ▼
   Worker: verify session HMAC → ask Paddle API for a completed
   transaction with customData.sub → sign Ed25519 key → return it
```

**There is no database.** Paddle's API is the record of who paid. The Worker stores nothing and the key is re-derived on demand, so "I lost my key" is a page refresh.

### 1. Identity — Worker-issued sessions

`worker.js` already exchanges the OAuth `code` server-side, so at that moment it *knows* the verified profile. It starts returning a signed session alongside it:

```
session = base64url({ sub, email, name, provider, iat, exp }) + "." + HMAC-SHA256(payload, SESSION_SECRET)
```

- `exp` = 30 days.
- `SESSION_SECRET` = a new Worker secret (`wrangler secret put SESSION_SECRET`).

**`sub` does not exist yet and must be added.** The Worker currently discards both stable ids: `github()` returns `login` but not `u.id`, and `google()` returns only `{provider, name, email, avatar}` — it drops the `sub` that `/oauth2/v3/userinfo` gives it. Both must be captured:

- `sub` = `"github:" + u.id` — **not** `login`, which a user can rename, which would silently orphan their purchase.
- `sub` = `"google:" + u.sub`.

Email is deliberately **not** the key: GitHub email can be null or private, and a buyer's Paddle email need not match their sign-in email.

`auth.js` stores `session` in the existing `tc-session` object. Nothing else about the OAuth flow changes: `callback.html`, the `redirect_uri`, and the client IDs stay exactly as they are.

**This is a change to `auth.js` and `worker.js`, which the site migration deliberately kept byte-identical.** It is justified: the licence endpoint cannot trust a browser-authored identity. The change is additive — the existing fields keep their shape, so a stale session simply lacks `session` and is treated as signed-out.

### 2. Buying — `POST /checkout` is not needed

Paddle Checkout runs client-side with `Paddle.Checkout.open({ items, customData, customer })`. No server round-trip to start a purchase. The client token is public and safe to commit (like the OAuth client IDs already in `config.js`).

`config.js` gains:

```js
window.TC_PAY = {
  environment: "production",       // or "sandbox"
  clientToken: "live_xxx",         // public
  priceId: "pri_xxx",              // the annual Pro licence
};
```

Sign-in is required *before* checkout so `customData.sub` is populated. This is the whole binding between a payment and a person — without it we would have to match on email, and the Paddle email need not equal the GitHub email.

### 3. Delivering — `POST /license` on the Worker

```
POST /license   { session }
 ->  200 { active: true, key, email, expires, issued }
 ->  200 { active: false, reason: "no-purchase" }
 ->  401 { error: "bad session" }
```

Steps:

1. Verify the session HMAC and `exp`. Reject otherwise.
2. `GET https://api.paddle.com/transactions?status=completed` filtered to our `priceId`, authenticated with `PADDLE_API_KEY` (Worker secret), and find one whose `custom_data.sub` matches. Paddle's API is paginated; filter server-side by `customer_id` where possible.
3. If found, build `{ email: <session email>, tier: "pro", issued: <billed_at>, expires: <billed_at + 365d> }` and sign it with `PRO_PRIVATE_KEY` (Worker secret) using `crypto.subtle.sign("Ed25519", ...)` — supported in Workers.
4. Return the key. The dashboard displays it.

The signed payload's `email` comes from the **session**, not from Paddle, so the key is issued to the person who signed in and can be verified offline by the app exactly as a hand-minted key is today.

**Empty email is a real case and must be handled.** `github()` returns `email: email || ""` when the address is private and the `/user/emails` fallback fails, and `verifyLicenseKey` rejects a payload with no email as `"bad payload"` — so signing a session with an empty email mints a key that cannot activate. Order of preference: session email → the Paddle transaction's customer email → refuse to issue, with a message telling the user to make an email public or contact support. Never sign an empty email.

### 4. Dashboard — a real "Licence" panel

Replaces nothing; adds a panel that is genuinely useful (and is the delivery mechanism):

- Signed out → "Sign in to see your licence."
- Signed in, no purchase → what Pro unlocks, and a Buy button (same Paddle overlay).
- Signed in, purchased → status, expiry date, days remaining, the key in a monospace box with a copy button, and the exact next step: *Settings → termcoder Pro → paste*.
- Expired → "Renew" (same one-time checkout again).

This is the minimum honest content. The broader "the dashboard has almost no options" complaint is a **separate spec** — this one only earns the licence panel.

## Components and interfaces

| Unit | Responsibility | Depends on |
|---|---|---|
| `website/auth/worker.js` → `session.js` | mint/verify HMAC sessions | `SESSION_SECRET` |
| `website/auth/worker.js` → `license.js` | look up a Paddle purchase, sign an Ed25519 key | `PADDLE_API_KEY`, `PRO_PRIVATE_KEY` |
| `app/src/lib/paddle.ts` | load Paddle.js, open the overlay | `window.TC_PAY` |
| `app/src/lib/session.ts` | read `tc-session`, expose `session` token | localStorage |
| `app/src/pages/dashboard.tsx` | the Licence panel | the two libs above |
| `app/src/pages/pricing.tsx` | Buy button (copy is already accurate as of `6008a06`) | `paddle.ts` |

Each is separately testable: session signing is pure crypto; the Paddle lookup is one fetch behind an interface that can be faked; the panel is a component with four states.

## Error handling

| Case | Behaviour |
|---|---|
| Paddle API down / 5xx | Panel keeps the last-known state and says "couldn't reach the licence service — your key still works offline." Never implies the licence is void. |
| Session expired (>30d) | Panel asks the user to sign in again. No key issued. |
| Purchase not found | Not an error — the "no purchase" state with a Buy button. Payments can take a moment; the panel offers Refresh. |
| Pix pending | Paddle marks the transaction completed only on settlement, so a pending Pix is simply "no purchase yet" + Refresh. Copy must say so explicitly, or the buyer will think they lost their money. |
| Bad/forged session | 401, no detail. |
| Worker misconfigured (no secrets) | 503 with a clear message; the panel shows "not configured yet" rather than "you didn't pay". |

## Testing

- **Session**: sign→verify round-trip; tampered payload rejected; expired rejected; missing secret → 503. Pure functions, no network.
- **Licence issuance**: with a faked Paddle client — purchase found → key verifies against `PRO_PUBLIC_KEY` with `verifyLicenseKey` (reuse the real function from `packages/core`); no purchase → inactive; expiry is exactly `billed_at + 365d`.
- **End-to-end, by hand, in Paddle sandbox**: buy with a sandbox card and with Pix, confirm the key appears in the dashboard and activates in Settings → termcoder Pro.
- **Gate**: an existing server test already covers room-locked; add one asserting a key minted by the Worker's payload shape passes `verifyLicenseKey`.

## Security

- Private key and API key are Worker secrets, never in the repo. `config.js` holds only public tokens.
- The Ed25519 **production keypair does not exist yet** — `PRO_PUBLIC_KEY` embedded in `license.ts` is a DEV key. Shipping checkout against a dev key means every issued licence is forgeable by anyone reading the repo. Regenerating it (`gen-keypair.mjs`) and embedding the public half is a **blocking prerequisite**, not a follow-up.
- The offline gate stays bypassable on an OSS build. Accepted, per the existing open-core posture.
- CORS on `/license` restricted to the site origin.

## What the user must do (I cannot)

1. Create the Paddle account and pass identity verification (gov ID + proof of address).
2. Set the price in BRL and USD; create the product and copy its `priceId` and client token.
3. Generate the production keypair, keep `pro-private.pem` secret, and hand me the **public** half to embed.
4. Put `PRO_PRIVATE_KEY`, `PADDLE_API_KEY`, `SESSION_SECRET` into the Worker via `wrangler secret put`.

I do not create accounts, enter bank or card details, or handle the private key material.

## Out of scope

- Boleto; Mercado Pago; any second provider.
- Monthly subscriptions.
- The broader dashboard content build-out (separate spec).
- Refunds/cancellation UI — Paddle handles refunds; a refunded key simply runs out its year. Revisit if abused.
- Team/multi-seat licences.

## Open question deferred

Whether a refunded or charged-back purchase should invalidate a key. Offline keys cannot be revoked, so honestly: it cannot, within this design. Left as-is deliberately; the payer profile (teacher/team lead) makes this a low risk.
