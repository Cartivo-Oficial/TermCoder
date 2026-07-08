# ChatGPT + Gemini Subscription Login — Design

**Status:** approved (brainstorming) — ready for implementation plans (one per provider, built sequentially).
**Date:** 2026-07-06
**Bundle:** "O Motor" mega update. Completes the subscription-login story begun with Claude (shipped, verified live).

## Goal

Let a user drive termcoder with an existing **ChatGPT Plus/Pro** subscription or a **personal Google account** (free Gemini Code Assist), instead of an API key — each isolated, experimental, and failing gracefully to keyless.

## Honest constraints (why this is experimental)

- **Impersonation, same as Claude.** Each reuses a first-party CLI's public OAuth client (Codex for ChatGPT, gemini-cli for Google). ToS gray area; can break when the vendor changes anything.
- **ChatGPT is the highest ToS risk.** OpenAI restricts programmatic use of the ChatGPT product; the risk lands on the user's account. Labeled experimental, opt-in, never the default.
- **Both talk to NON-standard backends** — unlike Claude (a header swap on the standard Anthropic API):
  - ChatGPT/Codex token → the ChatGPT backend (responses API at a Codex base + an account header).
  - Gemini personal login → the **Code Assist** API (`cloudcode-pa.googleapis.com`), a different protocol from the standard Gemini API; needs a bespoke request/response adapter. Known finicky (403 project-resolution bug on some personal Pro accounts).
- **Constants are community-reverse-engineered and may be stale.** Each provider's constants live in ONE const block in its module. **Each provider has a manual live-login gate** — a subagent cannot perform it; the human logs in with their real account to confirm before the piece is trusted/pushed.
- **Comment-free code; no new runtime dependencies** (Node `crypto`/`http`/`fetch` + existing `@ai-sdk/openai`/`@ai-sdk/google` where usable).
- **Secrets never sync** — creds under `providers.<name>.oauth`; config is not a sync store (same guarantee as Claude).
- **Build sequentially:** ChatGPT first (cleaner device-code mechanism, backend close to Claude's pattern), then Gemini (the heavier Code Assist adapter). Each is its own plan + SDD cycle + live gate.

## Shared architecture

Mirror the Claude quarantine (`core/auth/oauth.ts`): each provider gets its own isolated module so ToS-gray code is deletable in one file.

- **Config:** `providers.openai.oauth` and `providers.google.oauth`, each `{ accessToken, refreshToken, expiresAt, ...providerExtras }` (extend the existing provider schema's `oauth` object with optional provider-specific fields; keep the three core fields shared).
- **resolveModel:** an `openai/*` branch and a `google/*` branch, each used only when there's no apiKey/env key for that provider but oauth creds exist. Routing (`providerHasKey`, `firstKeyedModel`, `pickAutoModel`) treats oauth like a key (already generalized for anthropic — extend to openai/google).
- **Freshness:** `ensureFreshClaudeConfig` becomes a small per-provider family; the session's top-of-`prompt` refresh call covers all three providers that have oauth.
- **UIs:** flip the "coming soon" `oauth-browser` method for openai (and add one for google) in `auth.ts`; TUI commands; desktop Connect modal buttons. All labeled **experimental**.

---

## Piece 1 — ChatGPT (device-code)

### Flow (`core/auth/chatgpt-oauth.ts`)
- Constants: client `app_EMoamEEZ73f0CkXaXp7hrann`, `https://auth.openai.com/oauth/device/authorize` (or `/oauth/authorize` device variant), token `https://auth.openai.com/oauth/token`. **Verify live.**
- `beginChatGPTLogin()` → POST for a device grant → `{ userCode, verificationUri, deviceCode, interval, expiresAt }`. Show the user `verificationUri` + `userCode`.
- `pollChatGPTLogin(deviceCode, interval, signal)` → polls the token endpoint until `authorization_pending` clears → `{ accessToken, refreshToken, expiresAt }` (or times out). PKCE if the device flow requires it.
- `refreshChatGPT(refreshToken)` → refresh.
- `ensureFreshChatGPT` — same shape as Claude's.

### Backend adapter
- `chatgptModel(model, creds)` → `createOpenAI({ apiKey: "", baseURL: <codex base>, fetch })(...)` where the custom `fetch` sets `Authorization: Bearer <accessToken>` + any required account/session header, and targets the ChatGPT-backend responses base. **The exact base + headers are verified in the live gate.** Use `.chat()` or the responses path as the live test dictates.

### UX
- TUI `/login-chatgpt` (prints the URL + code, polls in the background, notifies on success) + `/logout-chatgpt`.
- Server `POST /auth/chatgpt/start` (returns `{ verificationUri, userCode }`, begins polling server-side) + `GET /auth/chatgpt/status` (pending/connected/failed). Desktop Connect modal: "ChatGPT Plus/Pro login" shows the code + a live status, saves on success.
- resolveModel `openai/*` oauth branch.

### Live gate (human)
Log in with a real ChatGPT Plus/Pro account; send an `openai/*` prompt; PASS = a real reply. FAIL modes correct only the const block / backend base+headers.

---

## Piece 2 — Gemini (loopback + Code Assist adapter)

### Flow (`core/auth/gemini-oauth.ts`)
- Constants: the gemini-cli OAuth client id + secret (public), Google authorize `https://accounts.google.com/o/oauth2/v2/auth`, token `https://oauth2.googleapis.com/token`, scopes for Code Assist. **Verify live.**
- `beginGeminiLogin()` starts an ephemeral `http` server on `127.0.0.1:<port>`, returns `{ url, done: Promise<creds> }`; the browser redirect to `http://localhost:<port>` is captured, the `code` exchanged for tokens, the server closed. A timeout aborts and closes the server.
- `refreshGemini(refreshToken)`; `ensureFreshGemini`.

### Backend adapter (the heavy part)
- The personal login authorizes **Code Assist**, not the standard Gemini API. `geminiCodeAssistModel(model, creds)` is a **bespoke `LanguageModel`** (or a translating `fetch`) that:
  - Resolves the user's Code Assist project/tier (the `loadCodeAssist`/`onboardUser` handshake gemini-cli does), handling the known 403 by falling back gracefully.
  - Translates AI SDK generate/stream calls to `cloudcode-pa.googleapis.com` `:generateContent`/`:streamGenerateContent` request/response shapes, mapping messages, tools, and streaming chunks.
- This adapter is the fragile core; scoped to `gemini-oauth.ts`. If the handshake fails (403/no license), clear creds and fall back to keyless with a friendly message.

### UX
- TUI `/login-gemini` (opens the browser via loopback; on capture, saves) + `/logout-gemini`.
- Server `POST /auth/gemini/start` (starts loopback, returns the url) + status; desktop "Sign in with Google (free Gemini)" button.
- resolveModel `google/*` oauth branch → the Code Assist adapter.

### Live gate (human)
Log in with a personal Google account; send a `google/*` prompt; PASS = a real Gemini reply through Code Assist. FAIL corrects the const block / handshake / adapter mapping.

---

## Testing (both, offline)

- PKCE/device-grant builders, token exchange + refresh against mocked `fetch`.
- The ChatGPT fetch wrapper (bearer + base + headers) and the Gemini request/response translation, unit-tested against recorded/mocked shapes.
- resolveModel picks the oauth branch when no key + creds; routing treats oauth as usable; `ensureFresh*` refresh/clear.
- Server route shapes. No live vendor calls in CI — the live gates are manual.

## Out of scope

- Any provider without a consumer subscription (the 7 API-key-only providers).
- Headless/CI variants beyond what each vendor's flow already gives.
- Persisting the loopback port or device session beyond a single login attempt.
