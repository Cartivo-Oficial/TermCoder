# Spec — AI Quality (phase 1): reliable free AI + effortless connection

## Context

termcoder is feature-complete (5 phases shipped) but its weakest link is the AI's
**quality**. The keyless default — `termcoderfree` (Pollinations' GPT-OSS 20B) — is a single
small community model that intermittently 500s / times out, makes mistakes, answers
shallowly, and loses the thread in long chats. Those four pains share one root: a small,
unreliable model.

The user picked **AI Quality** as the first of four "new level" tracks (the others —
killer feature, adoption, polish — follow in later specs). Constraint they chose: **keyless
stays the zero-friction default, but connecting a better model must be effortless**. And a
concrete addition: **make the "coming soon" subscription logins in the Connect modal
actually work**, so people can connect their existing Claude Pro/Max (and later ChatGPT)
and get a much better model — "facilitar a conexão do pessoal."

Reality check that shapes the design: Pollinations exposes **only one** anonymous-tier model,
so keyless reliability can't come from switching free models — it comes from **robustness**
(retries/timeout) plus making the **upgrade to a real model** (free Gemini key, or a Claude
Pro/Max subscription) one-click.

## Goals

1. The free default feels **reliable** — transient failures don't kill a turn.
2. Connecting a **better** model is effortless (≈2 clicks) and honestly nudged, never nagged.
3. Even the small model **errs less** (tightened agent scaffolding).
4. Touched code is left **clean** — drop noise comments, keep the load-bearing "why".

## Non-goals (this spec)

- The killer-feature / adoption / broad-polish tracks (separate later specs).
- **ChatGPT OAuth** and the **headless** OAuth flow (follow-up — start with Anthropic browser).
- Deep retrieval/RAG for very large repos (later).

## Design

### 1. Reliable keyless tier — `core/src/provider/reliability.ts` (new)

A small, well-bounded helper the session runner wraps its model stream in:

- **Retry with backoff + a per-request timeout.** A connection error / 5xx / abort retries up
  to N (≈2) with short backoff instead of failing the turn; a hung request times out and
  becomes a retry rather than a hang.
- **Fallback chain.** After retries on the primary are exhausted, fall through to the next
  candidate: `termcoderfree` → a configured key (google → anthropic → openai) if the user has
  one → a friendly terminal error. (Only one free model exists, so real redundancy = "a key if
  present" + retries.)
- Generalizes the session's existing `termcoder/auto` auto-escalation hook into this chain, so
  there's one code path for "the model call failed, try the next thing."
- Interface: `runWithReliability(candidates, callOnce, { retries, timeoutMs, onFallback })` →
  the first successful stream, or throws a friendly error. Pure and unit-testable with a
  scripted `callOnce`.

### 2. Effortless connection & upgrade

The honest, high-leverage quality jump. Two paths, same "2 clicks" bar:

- **Free Gemini key.** Desktop: a dismissible card in the empty state, and one after a turn
  that failed on the free tier — *"Want much better answers? Connect Google — free, 2 clicks."*
  Opens the AI Studio key page, paste field, save → `termcoder/auto` routes to Gemini (already
  wired). CLI: `/upgrade` prints the same guided steps. Never nags (dismiss is per-version).
- **Claude Pro/Max subscription (OAuth).** Make the Connect modal's "Claude Pro/Max (browser)"
  method real:
  - `core/src/auth/oauth-anthropic.ts` (new): PKCE OAuth against Anthropic's auth (the flow
    Claude Code / OpenCode use) — build the authorize URL, open the browser, receive the code
    (loopback or paste), exchange for access+refresh tokens.
  - `core/src/auth/tokens.ts` (new): store tokens in the config dir (gitignored, never synced),
    refresh on expiry, expose the current access token.
  - `provider.ts`: when an Anthropic OAuth token exists, use it as the credential (with the
    subscription's required headers) so termcoder runs on the user's Claude Pro/Max.
  - Wire the method through the existing Connect UI (`auth.ts` flips it to `available`, the
    desktop modal + a CLI `/login anthropic` trigger it).
  - **Honest caveats, encoded as constraints:** it uses the vendor's OAuth like the official
    CLI (ToS gray area); it's fragile (breaks if Anthropic changes the flow). So it is isolated,
    **fails gracefully to keyless**, and is clearly labeled. ChatGPT + headless are follow-ups.
- Reuses the Phase-4 auth framework: `CONNECTABLE_PROVIDERS`/`providerAuthMethods`, the desktop
  Connect modal, and `GET /providers`.

### 3. Agent scaffolding — fewer mistakes

- Tighten the coder/study system prompts to a crisp **plan → act → verify** protocol; ensure
  the `termcoder/auto` review pass fires; sharpen tool-use guidance — so even the small model
  behaves better. Bounded prompt/logic edits in `session.ts`, not open-ended.
- **Comment cleanup** on every file touched by this work: remove obvious/redundant comments,
  keep the ones that explain a non-obvious "why".

### 4. Error handling

- Model/connection failures → friendly, actionable copy: *"the free service is busy — try again,
  or connect a better model (2 clicks)."* OAuth failures → clear message + automatic fall-back
  to keyless. No raw tracebacks reach the user.

### 5. Testing

- Unit: the reliability chain (scripted `callOnce` — first errors → recovers on retry; all fail
  → friendly error; timeout path triggers fallback).
- Unit: the OAuth token store (save / read / refresh-on-expiry) against a mocked token endpoint;
  PKCE verifier/challenge generation.
- Live smoke: force a keyless failure and confirm recovery; connect a Gemini key and confirm the
  route switches; run the Anthropic OAuth flow end-to-end once (manual).

## Risks & mitigations

- **OAuth fragility / ToS gray area** → isolate it, fail gracefully to keyless, start with the
  most-sanctioned Anthropic browser flow, label it honestly.
- **Single free model caps keyless reliability** → retries + timeout make it best-effort, and the
  effortless upgrade is the real reliability/quality answer.

## Rollout

Ship as **v0.6.0**, in order of safety: (1) reliability wrapper, (2) Gemini-key upgrade UX,
(3) agent-scaffolding + comment cleanup, (4) Anthropic OAuth. Each lands behind the existing
keyless default, so nothing regresses if a piece is deferred.
