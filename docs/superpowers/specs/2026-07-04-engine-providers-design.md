# The Engine — Reliable Models + Every Provider — Design

**Status:** approved (brainstorming) — ready for an implementation plan.
**Date:** 2026-07-04
**Bundle:** "O Motor" mega update, piece 1. Headline: _pick any model and it just works — and auto never leaves you hanging._

## Why (diagnosed live, not guessed)

A live probe against the user's real config found the three failure modes users call "the models are garbage":

1. **Calls can hang forever.** An OpenAI call with a real key froze for 30s+ with no error — the UI just spins. No model call anywhere has a timeout.
2. **The picker lies.** A model shows ● "ready" because a key exists, but the key may not work (the Anthropic key is real but has no credits → instant billing error on use).
3. **Auto routes to dead providers.** `pickAutoModel`/`firstKeyedModel` treat "has key" as "works", so routing happily picks a provider that just failed.

And separately: connecting a provider is limited to anthropic/openai/google/ollama — users want **every major AI easily connectable**.

## Decisions

- **Never hang:** every model attempt gets an idle timeout; a timeout is a stream error, which flows into the existing v0.6.0 retry-then-fallback.
- **Truth in the picker:** "ready" is earned by a live probe, not key presence; probing is explicit + on key save.
- **Health-aware routing:** in-memory provider health (populated by probes and live failures) that routing consults. No persistence — a process restart forgets grudges.
- **All providers via one registry:** most vendors are OpenAI-compatible, so a data-only registry (id, baseURL, key URL) adds them all with zero new dependencies.
- **No new runtime dependencies. Comment-free code** (user rule): self-explanatory names, no comments except required directives.

## Architecture

### 1. Provider registry — `packages/core/src/provider/registry.ts` (new)

One data table describing every connectable provider:

```ts
export interface ProviderInfo {
  id: string;            // config key, e.g. "groq"
  label: string;         // "Groq"
  kind: "native" | "openai-compat" | "local" | "keyless";
  baseURL?: string;      // for openai-compat
  keyEnv?: string[];     // env vars honored
  keyUrl?: string;       // where to get a key
  freeTier?: string;     // one-line honest note, e.g. "generous free tier"
  fastModel?: string;    // model id used for probes + as routing candidate
}
export const PROVIDERS: ProviderInfo[];
export function providerInfo(id: string): ProviderInfo | undefined;
```

Initial registry (all key-based ones are OpenAI-compatible unless native):

| id | kind | baseURL | free tier? |
|---|---|---|---|
| anthropic | native | — | no |
| openai | native | — | no |
| google | native | — | yes (AI Studio key) |
| groq | openai-compat | `https://api.groq.com/openai/v1` | yes |
| openrouter | openai-compat | `https://openrouter.ai/api/v1` | some free models |
| mistral | openai-compat | `https://api.mistral.ai/v1` | yes |
| deepseek | openai-compat | `https://api.deepseek.com` | cheap, no free |
| xai | openai-compat | `https://api.x.ai/v1` | no |
| together | openai-compat | `https://api.together.xyz/v1` | trial credits |
| cerebras | openai-compat | `https://api.cerebras.ai/v1` | yes |
| ollama | local | user-config | free/local |
| termcoderfree | keyless | (pollinations, built-in) | free |

- `resolveModel` gains one generic branch: provider found in registry as `openai-compat` + key in config/env → `createOpenAI({ baseURL, apiKey }).chat(model)` (the `.chat()` lesson from pollinations applies to all compat vendors).
- `auth.ts` `CONNECTABLE_PROVIDERS` is rebuilt on top of the registry so the Connect UI (TUI `/connect`, desktop modal) lists **all** of them, each with its `keyUrl` ("get a free key →") and free-tier note.
- The model catalog groups these providers' models (Models.dev already carries groq/mistral/openrouter/etc. entries); typing a full `provider/model` id keeps working for anything missing.

### 2. Never hang — idle timeout in the session loop

- New config: `reliability: { idleTimeoutMs: 45000 }` (Zod default; env-overridable like the rest).
- In the session stream loop (the v0.6.0 retry loop), each attempt's `for await (chunk of fullStream)` is raced against an idle timer that resets on every chunk. No chunk for `idleTimeoutMs` → abort that attempt's controller and treat it exactly like a stream error (`friendlyError("model timed out …")`) → `nextModelOnError` retries/falls back as today.
- The runner also passes `AbortSignal.any([callerSignal, attemptController.signal])` so the underlying fetch actually cancels.
- Result for the diagnosed OpenAI hang: ~45s worst case, then "OpenAI didn't respond — switching to google/gemini-2.5-flash…" instead of an eternal spinner.

### 3. Truth — provider probes

- `probeProvider(id, { config, env }): Promise<{ ok: true } | { ok: false; error: string }>` in core: resolves the registry's `fastModel` for that provider and runs a 1-token `generateText("Reply with exactly: ok")` under a 10s abort. The error string is passed through `friendlyError` so "no credits" reads as billing, not soup.
- **Probe cache** (in-memory, TTL ~5 min) shared with health (below).
- Server: `POST /providers/probe { provider }` → probe result.
- TUI: `/key <provider> <key>` saves **and probes**, printing `✓ groq connected — works!` or the friendly error. `/connect <provider>` shows the key URL + free-tier note from the registry.
- Desktop Connect modal: every provider row gets **Test connection**; saving a key auto-probes and shows the result inline.
- Model picker (TUI + desktop model browser): three states — `●` verified working (probe ok), `◐` key saved but unverified, `○` needs key. Verification state comes from the probe cache; no automatic mass-probing of every provider on open (only on demand / on save).

### 4. Health-aware routing

- `providerHealth` map in core (module-level, in-memory): `id → { ok: boolean; error?: string; until: number }`.
  - Set by probes (both outcomes) and by **live stream failures** (session marks the failing provider bad for 5 min; a success clears it).
- `pickAutoModel` and `firstKeyedModel` skip providers currently marked bad, falling through to the next candidate (ollama → keyless stay the final fallbacks).
- Effect on the diagnosed setup: the credit-less Anthropic key stops being a routing candidate the first time it fails; auto stays on Gemini.

### 5. Out of scope (other pieces of the bundle)

Retrieval (own spec), desktop visual redesign (own spec), Claude subscription OAuth (spec exists), website refresh (after features land).

## Testing

- `registry.test.ts`: every entry has id/label/kind; openai-compat entries have baseURL; `providerInfo` lookup.
- `resolveModel`: a registry compat provider (e.g. groq) with a key resolves; without a key returns the current no-key behavior.
- Idle timeout: a scripted runner whose stream never yields → attempt aborts at the (test-shortened) idle timeout → retry/fallback path runs → friendly error mentions timeout when everything fails. Also: a slow-but-alive stream (chunks under the idle limit) is NOT aborted.
- `probeProvider`: mocked model runner — ok path, error path (message goes through friendlyError); cache TTL respected.
- Routing health: mark a provider bad → `pickAutoModel` skips it; expiry restores it; live failure marks it.
- Server probe route: 200 shape + unknown provider 400.
- Suite stays green (235 now).

## File summary

- New: `core/src/provider/registry.ts` (+test), `core/src/provider/health.ts` (probe + health map, +test — or folded into `reliability.ts` if small).
- Modify: `core/src/provider/provider.ts` (compat branch, routing consults health), `core/src/config/config.ts` (`reliability.idleTimeoutMs`), `core/src/session/session.ts` (idle-timeout race, failure→health), `core/src/auth/auth.ts` (registry-driven), `core/src/index.ts`, `server/src/server.ts` (probe route), `tui` (`/key` probe feedback, `/connect` listing, picker states), `desktop` (Connect modal rows + Test connection + picker states, i18n en/pt/es), `docs/configuration.md`.
