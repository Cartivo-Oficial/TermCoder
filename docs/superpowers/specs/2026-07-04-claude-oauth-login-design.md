# Claude Pro/Max OAuth Login — Design

**Status:** approved (brainstorming) — ready for an implementation plan.
**Date:** 2026-07-04
**Scope:** Claude subscription login ONLY. ChatGPT OAuth is explicitly out of scope.

## Goal

Let a user sign in with their existing **Claude Pro/Max subscription** and use it as termcoder's model, instead of pasting an Anthropic API key. Isolated, clearly labeled **experimental**, and failing gracefully back to the keyless free model when anything goes wrong.

## Honest constraints (the reason this is "experimental")

- **It works by impersonating Claude Code.** The only way a third-party app authenticates against a Claude subscription is by reusing Claude Code's public OAuth client id. This is a ToS gray area with Anthropic, and the issued token is scoped for Claude Code.
- **It can break at any time, silently, for everyone.** Anthropic can rotate or block the client id, change endpoints/scopes, or change the required headers. When they do, every user's login stops working at once and there is nothing we can patch to prevent it.
- **The exact OAuth parameters are not authoritative in this design.** The client id, authorize/token endpoints, scopes, redirect URI, and the required request headers (including the `anthropic-beta` value and any "You are Claude Code" system-prompt requirement) come from community reverse-engineering. **The implementation plan MUST open with a task that verifies these against a real login before any value is hardcoded.** Treat every concrete OAuth constant below as a placeholder to be confirmed, not as fact.
- **ChatGPT is deliberately excluded.** OpenAI has no subscription API and its ToS explicitly forbids programmatic use of the ChatGPT product; the risk lands on users' accounts. Not built.
- **Redundancy is acknowledged.** termcoder already gives classmates free access three ways (keyless `termcoderfree`, free Gemini via `/upgrade`, local Ollama). This feature only helps people who already pay for Claude, and is the one fragile path — hence experimental and strictly isolated.

## Architecture

All ToS-gray, breakable code is quarantined so it can be deleted without touching anything else.

### 1. `core/auth/oauth.ts` (new — the quarantine)

The entire Claude-specific OAuth machinery, clearly commented as experimental.

- `interface ClaudeOAuth { accessToken: string; refreshToken: string; expiresAt: number }` — `expiresAt` is an epoch-ms timestamp.
- `beginClaudeLogin(): { url: string; verifier: string }` — generates a PKCE `code_verifier` + `code_challenge` (S256), builds the authorize URL (paste-code redirect), and returns the URL to open plus the verifier to hold until the code comes back.
- `completeClaudeLogin(code: string, verifier: string): Promise<ClaudeOAuth>` — exchanges the pasted `code` + `verifier` at the token endpoint for `{ accessToken, refreshToken, expiresAt }`.
- `refreshClaude(refreshToken: string): Promise<ClaudeOAuth>` — exchanges a refresh token for fresh creds.
- A single clearly-marked const block holds `CLAUDE_CLIENT_ID`, `CLAUDE_AUTHORIZE_URL`, `CLAUDE_TOKEN_URL`, `CLAUDE_SCOPES`, `CLAUDE_REDIRECT_URI`, and the request-header requirements — **all to be verified by the plan's first task.**

PKCE + code exchange use only Node built-ins (`crypto`, `fetch`) — no new dependencies.

### 2. Credential storage

- Creds live at `config.providers.anthropic.oauth: ClaudeOAuth` in the global config (`~/.config/termcoder/config.json`), which is gitignored.
- **Never synced.** The secrets rule holds — `oauth` is excluded from any sync/gist payload exactly like `apiKey`.
- Small helpers (co-located, e.g. in `oauth.ts` or the config module) to read/write the creds and to compute "is expired / near expiry".

### 3. Provider wiring — `provider.ts` (one isolated branch)

- In `resolveModel`, when the model is `anthropic/*`, there is **no explicit `apiKey`**, and `oauth` creds exist:
  1. If the access token is expired or near expiry, call `refreshClaude` and persist the new creds.
  2. Build the Anthropic client using the Bearer access token plus the required headers (per the verified consts).
- `pickAutoModel` / `firstKeyedModel` treat "has anthropic oauth" the same as "has an anthropic key" → they may route `termcoder/auto` to a Claude model. This reuses the v0.6.0 reliability path.
- Deleting this branch + `oauth.ts` returns termcoder to its exact prior behavior.

### 4. Fail-graceful behavior

- **Refresh failure (revoked/blocked):** clear `config.providers.anthropic.oauth`, and surface a friendly message — "Your Claude login expired or was disconnected. Run `/login-claude` to sign in again, or keep using the free model." Routing then behaves as if no anthropic credential exists.
- **Mid-turn API failure:** handled by the existing v0.6.0 `nextModelOnError` retry-then-fallback — a broken subscription call falls the turn back to keyless automatically. No new fallback logic needed.
- `pickAutoModel` must not select the oauth path when creds are missing or unrefreshable.

### 5. UX entry points (flip "coming soon" → live, labeled experimental)

- **`auth.ts`:** the anthropic `oauth-browser` method becomes `available: true` with copy that says **experimental**; hint text explains the paste-code steps.
- **TUI:** `/login-claude` — prints the authorize URL (and best-effort opens it), waits for the pasted code, calls `completeClaudeLogin`, saves creds, confirms. `/logout-claude` clears them. Registered in `commands.ts`.
- **Desktop:** the Connect modal's Anthropic "Claude Pro/Max login" method opens the browser via `shell.openExternal` and shows a paste-code input that posts the code to a new server endpoint which runs `completeClaudeLogin` and saves. Copy marked experimental (en/pt/es).
- **Server:** minimal endpoints to support the desktop flow — e.g. `POST /auth/claude/start` (returns `{ url }`, holds the verifier server-side per session) and `POST /auth/claude/complete` (`{ code }` → saves creds), or a single stateless variant. Exact shape decided in the plan; must not leak the verifier to other clients.

### 6. Testing

- Unit: PKCE correctness (verifier charset/length; challenge = base64url(SHA-256(verifier))).
- Unit: `completeClaudeLogin` and `refreshClaude` against a mocked `fetch` (success + error/revoked).
- Unit: `resolveModel` selects the oauth path when creds exist and no apiKey; ignores it when creds are expired-and-unrefreshable.
- Unit: refresh failure clears the stored creds.
- **No live Anthropic calls in CI.** A one-time manual smoke login is the user's responsibility and is documented.

### 7. Labeling

Every surface (TUI copy, desktop modal, docs) states the login is **experimental and may stop working if Anthropic changes their flow**, so classmates aren't blindsided.

## Isolation summary

- New file: `core/auth/oauth.ts` (all fragile code).
- Touched: `provider.ts` (one branch), `auth.ts` (flip a flag + copy), config schema (`providers.anthropic.oauth`), sync exclusion (verify `oauth` never leaves the machine), TUI `commands.ts` + `app.tsx` (two commands), desktop Connect modal + i18n, server (two small auth routes), docs.
- Everything is gated on "oauth creds exist." Remove the file and the branch → no behavior change.

## Out of scope (future / separate)

- ChatGPT / OpenAI subscription login.
- Loopback (automatic redirect capture) — paste-code only for now.
- Any non-Anthropic subscription provider.
