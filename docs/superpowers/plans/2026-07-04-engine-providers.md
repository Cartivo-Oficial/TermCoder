# Engine + All Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any provider connects easily (12 in a registry), no model call can hang (idle timeout → existing retry/fallback), and "ready" in the picker is earned by a live probe with routing that skips unhealthy providers.

**Architecture:** A pure data `registry.ts` describes every provider; `resolveModel` gains one generic OpenAI-compatible branch driven by it. A dependency-free `health.ts` holds an in-memory provider-health map; `probeProvider` (in provider.ts) fills it and routing consults it. `streamWithIdleTimeout` (in reliability.ts) wraps each attempt's stream in the session loop so silence becomes a stream error that the v0.6.0 retry/fallback already handles.

**Tech Stack:** TypeScript, pnpm monorepo, Vitest, Vercel AI SDK v5 (`createOpenAI(...).chat()` for all compat vendors), Ink TUI, Electron+React desktop.

## Global Constraints

- **No new runtime dependencies.**
- **Comment-free code** (user rule): no comments in any new/edited code — self-explanatory names instead. Required directives only.
- **Node ≥ 20**, ESM. Tests colocated `*.test.ts`, run `npx vitest run`. Typecheck must stay clean (`noUncheckedIndexedAccess`).
- **Never edit repo source via PowerShell.**
- Keyless stays the default; `termcoderfree/auto` → pollinations must keep working with no key.
- Registry providers (exact ids): `anthropic, openai, google, groq, openrouter, mistral, deepseek, xai, together, cerebras, ollama, termcoderfree`.
- Config: `reliability.idleTimeoutMs` default `45000`. Probe timeout 10s. Health TTL 5 min.
- **No version bump in this plan** — the bundle ships versioned at the end (after retrieval + desktop pieces).
- Suite currently green at 235 tests; keep it green.

---

### Task 1: Provider registry (pure data)

**Files:**
- Create: `packages/core/src/provider/registry.ts`
- Test: `packages/core/src/provider/registry.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:
  - `interface ProviderInfo { id: string; label: string; kind: "native" | "openai-compat" | "local" | "keyless"; baseURL?: string; keyEnv?: string[]; keyUrl?: string; freeTier?: string; fastModel: string }`
  - `const PROVIDERS: ProviderInfo[]`
  - `providerInfo(id: string): ProviderInfo | undefined`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { PROVIDERS, providerInfo } from "./registry";

describe("provider registry", () => {
  it("lists the 12 providers with complete entries", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual([
      "anthropic", "openai", "google", "groq", "openrouter", "mistral",
      "deepseek", "xai", "together", "cerebras", "ollama", "termcoderfree",
    ]);
    for (const p of PROVIDERS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.fastModel).toContain("/");
      if (p.kind === "openai-compat") expect(p.baseURL).toMatch(/^https:\/\//);
      if (p.kind === "native" || p.kind === "openai-compat") {
        expect(p.keyEnv?.length).toBeGreaterThan(0);
        expect(p.keyUrl).toMatch(/^https:\/\//);
      }
    }
  });
  it("looks up one provider", () => {
    expect(providerInfo("groq")?.baseURL).toBe("https://api.groq.com/openai/v1");
    expect(providerInfo("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it — FAIL (module missing)**

Run: `npx vitest run packages/core/src/provider/registry.test.ts`

- [ ] **Step 3: Implement**

```ts
export interface ProviderInfo {
  id: string;
  label: string;
  kind: "native" | "openai-compat" | "local" | "keyless";
  baseURL?: string;
  keyEnv?: string[];
  keyUrl?: string;
  freeTier?: string;
  fastModel: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "anthropic", label: "Anthropic (Claude)", kind: "native", keyEnv: ["ANTHROPIC_API_KEY"], keyUrl: "https://console.anthropic.com/settings/keys", fastModel: "anthropic/claude-haiku-4-5-20251001" },
  { id: "openai", label: "OpenAI (ChatGPT)", kind: "native", keyEnv: ["OPENAI_API_KEY"], keyUrl: "https://platform.openai.com/api-keys", fastModel: "openai/gpt-4o-mini" },
  { id: "google", label: "Google (Gemini)", kind: "native", keyEnv: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"], keyUrl: "https://aistudio.google.com/apikey", freeTier: "generous free tier", fastModel: "google/gemini-2.5-flash" },
  { id: "groq", label: "Groq", kind: "openai-compat", baseURL: "https://api.groq.com/openai/v1", keyEnv: ["GROQ_API_KEY"], keyUrl: "https://console.groq.com/keys", freeTier: "fast free tier", fastModel: "groq/llama-3.3-70b-versatile" },
  { id: "openrouter", label: "OpenRouter", kind: "openai-compat", baseURL: "https://openrouter.ai/api/v1", keyEnv: ["OPENROUTER_API_KEY"], keyUrl: "https://openrouter.ai/settings/keys", freeTier: "some free models", fastModel: "openrouter/meta-llama/llama-3.3-70b-instruct:free" },
  { id: "mistral", label: "Mistral", kind: "openai-compat", baseURL: "https://api.mistral.ai/v1", keyEnv: ["MISTRAL_API_KEY"], keyUrl: "https://console.mistral.ai/api-keys", freeTier: "free tier", fastModel: "mistral/mistral-small-latest" },
  { id: "deepseek", label: "DeepSeek", kind: "openai-compat", baseURL: "https://api.deepseek.com", keyEnv: ["DEEPSEEK_API_KEY"], keyUrl: "https://platform.deepseek.com/api_keys", fastModel: "deepseek/deepseek-chat" },
  { id: "xai", label: "xAI (Grok)", kind: "openai-compat", baseURL: "https://api.x.ai/v1", keyEnv: ["XAI_API_KEY"], keyUrl: "https://console.x.ai", fastModel: "xai/grok-3-mini" },
  { id: "together", label: "Together AI", kind: "openai-compat", baseURL: "https://api.together.xyz/v1", keyEnv: ["TOGETHER_API_KEY"], keyUrl: "https://api.together.ai/settings/api-keys", freeTier: "trial credits", fastModel: "together/meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  { id: "cerebras", label: "Cerebras", kind: "openai-compat", baseURL: "https://api.cerebras.ai/v1", keyEnv: ["CEREBRAS_API_KEY"], keyUrl: "https://cloud.cerebras.ai", freeTier: "free tier", fastModel: "cerebras/llama-3.3-70b" },
  { id: "ollama", label: "Ollama (local)", kind: "local", freeTier: "free, local, private", fastModel: "ollama/llama3.1" },
  { id: "termcoderfree", label: "termcoderfree (no key)", kind: "keyless", freeTier: "free, no key, built in", fastModel: "termcoderfree/auto" },
];

export function providerInfo(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
```

- [ ] **Step 4: Run it — PASS.** Then add to `packages/core/src/index.ts` near the provider exports:

```ts
export { PROVIDERS, providerInfo, type ProviderInfo } from "./provider/registry";
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/provider/registry.ts packages/core/src/provider/registry.test.ts packages/core/src/index.ts
git commit -m "feat(core): provider registry — 12 connectable providers"
```

---

### Task 2: Provider health state (pure, in-memory)

**Files:**
- Create: `packages/core/src/provider/health.ts`
- Test: `packages/core/src/provider/health.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:
  - `interface ProviderHealth { ok: boolean; error?: string; until: number }`
  - `HEALTH_TTL_MS = 300_000`
  - `markProvider(id: string, ok: boolean, error?: string, ttlMs?: number): void`
  - `providerMarkedBad(id: string): boolean`
  - `providerHealthSnapshot(): Record<string, ProviderHealth>`
  - `clearProviderHealth(): void`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { clearProviderHealth, markProvider, providerHealthSnapshot, providerMarkedBad } from "./health";

afterEach(() => clearProviderHealth());

describe("provider health", () => {
  it("marks a provider bad and clears on success", () => {
    expect(providerMarkedBad("anthropic")).toBe(false);
    markProvider("anthropic", false, "no credits");
    expect(providerMarkedBad("anthropic")).toBe(true);
    expect(providerHealthSnapshot().anthropic?.error).toBe("no credits");
    markProvider("anthropic", true);
    expect(providerMarkedBad("anthropic")).toBe(false);
  });
  it("bad marks expire after their ttl", () => {
    markProvider("openai", false, "timeout", 1);
    const wait = Date.now() + 5;
    while (Date.now() < wait) {}
    expect(providerMarkedBad("openai")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — FAIL.** `npx vitest run packages/core/src/provider/health.test.ts`

- [ ] **Step 3: Implement**

```ts
export interface ProviderHealth {
  ok: boolean;
  error?: string;
  until: number;
}

export const HEALTH_TTL_MS = 300_000;

const HEALTH = new Map<string, ProviderHealth>();

export function markProvider(id: string, ok: boolean, error?: string, ttlMs = HEALTH_TTL_MS): void {
  HEALTH.set(id, { ok, error, until: Date.now() + ttlMs });
}

export function providerMarkedBad(id: string): boolean {
  const h = HEALTH.get(id);
  if (!h) return false;
  if (Date.now() > h.until) {
    HEALTH.delete(id);
    return false;
  }
  return !h.ok;
}

export function providerHealthSnapshot(): Record<string, ProviderHealth> {
  const out: Record<string, ProviderHealth> = {};
  for (const [k, v] of HEALTH) out[k] = v;
  return out;
}

export function clearProviderHealth(): void {
  HEALTH.clear();
}
```

- [ ] **Step 4: Run it — PASS.** Export from `index.ts`:

```ts
export {
  markProvider,
  providerMarkedBad,
  providerHealthSnapshot,
  clearProviderHealth,
  HEALTH_TTL_MS,
  type ProviderHealth,
} from "./provider/health";
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/provider/health.ts packages/core/src/provider/health.test.ts packages/core/src/index.ts
git commit -m "feat(core): in-memory provider health map"
```

---

### Task 3: Idle-timeout stream guard + config knob + friendly copy

**Files:**
- Modify: `packages/core/src/provider/reliability.ts` (add `streamWithIdleTimeout`)
- Modify: `packages/core/src/config/config.ts` (add `reliability` block)
- Modify: `packages/core/src/session/session.ts` (`friendlyError` timeout branch)
- Test: `packages/core/src/provider/reliability.test.ts`, `packages/core/src/session/session.test.ts`

**Interfaces:**
- Produces: `streamWithIdleTimeout<C>(stream: AsyncIterable<C>, ms: number, onTimeout?: () => void): AsyncGenerator<C | { type: "error"; error: unknown }>`; `config.reliability.idleTimeoutMs` (default 45000).

- [ ] **Step 1: Write the failing tests.** In `reliability.test.ts`:

```ts
import { streamWithIdleTimeout } from "./reliability";

describe("streamWithIdleTimeout", () => {
  it("passes chunks through when the stream stays alive", async () => {
    async function* alive() {
      yield { type: "text-delta", text: "a" };
      yield { type: "text-delta", text: "b" };
    }
    const seen: string[] = [];
    for await (const c of streamWithIdleTimeout(alive(), 200)) seen.push(c.type);
    expect(seen).toEqual(["text-delta", "text-delta"]);
  });
  it("yields an error chunk and stops when the stream goes silent", async () => {
    let timedOut = false;
    async function* silent() {
      yield { type: "text-delta", text: "a" };
      await new Promise(() => {});
    }
    const seen: Array<{ type: string }> = [];
    for await (const c of streamWithIdleTimeout(silent(), 30, () => { timedOut = true; })) seen.push(c);
    expect(seen.map((c) => c.type)).toEqual(["text-delta", "error"]);
    expect(timedOut).toBe(true);
  });
});
```

In `session.test.ts`:

```ts
it("timeout errors read as a friendly timeout", () => {
  const msg = friendlyError("The model produced no output for 45s (timed out)");
  expect(msg).toMatch(/timed out/i);
  expect(msg).toMatch(/model|try again/i);
});
```

- [ ] **Step 2: Run them — FAIL.**

- [ ] **Step 3: Implement.** Append to `reliability.ts`:

```ts
export async function* streamWithIdleTimeout<C>(
  stream: AsyncIterable<C>,
  ms: number,
  onTimeout?: () => void,
): AsyncGenerator<C | { type: "error"; error: unknown }> {
  const it = stream[Symbol.asyncIterator]();
  while (true) {
    let timer: NodeJS.Timeout | undefined;
    const nextP = it.next();
    nextP.catch(() => {});
    const winner = await Promise.race([
      nextP.then((r) => ({ kind: "next" as const, r })),
      new Promise<{ kind: "timeout" }>((res) => {
        timer = setTimeout(() => res({ kind: "timeout" }), ms);
      }),
    ]);
    clearTimeout(timer);
    if (winner.kind === "timeout") {
      onTimeout?.();
      yield { type: "error", error: new Error(`The model produced no output for ${Math.round(ms / 1000)}s (timed out)`) };
      try {
        await it.return?.(undefined as never);
      } catch {}
      return;
    }
    if (winner.r.done) return;
    yield winner.r.value;
  }
}
```

In `config.ts`, after the `context` block:

```ts
  reliability: z
    .object({
      idleTimeoutMs: z.number().int().positive().default(45000),
    })
    .default({}),
```

In `session.ts` `friendlyError`, before the final `return raw;`:

```ts
  if (s.includes("timed out") || s.includes("timeout") || s.includes("aborted")) {
    return "The model timed out without responding. Try again, switch models with /model, or connect a faster provider (/upgrade).";
  }
```

- [ ] **Step 4: Run tests — PASS.** `npx vitest run packages/core/src/provider/reliability.test.ts packages/core/src/session/session.test.ts` then `pnpm --filter @termcoder/core typecheck`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/provider/reliability.ts packages/core/src/provider/reliability.test.ts packages/core/src/config/config.ts packages/core/src/session/session.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): idle-timeout stream guard + reliability config"
```

---

### Task 4: Wire idle timeout + health marking into the session loop

**Files:**
- Modify: `packages/core/src/session/session.ts` (the retry loop, currently ~L427-483)
- Test: `packages/core/src/session/session.test.ts`

**Interfaces:**
- Consumes: `streamWithIdleTimeout` (Task 3), `markProvider` (Task 2).
- Behaviour: an attempt whose stream goes silent for `reliability.idleTimeoutMs` aborts, becomes a stream error, and flows into the existing retry/fallback. Stream failures mark the model's provider bad; a successful attempt marks it good.

- [ ] **Step 1: Write the failing test** (uses the file's scripted-runner style; a runner whose stream hangs forever, with a shortened timeout via config):

```ts
it("aborts a silent stream at the idle timeout and retries", async () => {
  const hangConfig = loadConfig({ cwd: dir, configDir: join(dir, "cfg"), env: {} });
  hangConfig.reliability = { idleTimeoutMs: 40 };
  let calls = 0;
  const runner: ModelRunner = () => {
    calls += 1;
    const hang = calls === 1;
    async function* stream() {
      if (hang) {
        await new Promise(() => {});
      } else {
        yield { type: "text-delta" as const, text: "recovered" };
      }
    }
    return {
      fullStream: stream(),
      response: Promise.resolve({ messages: [{ role: "assistant", content: "recovered" }] as ModelMessage[] }),
      finishReason: Promise.resolve("stop"),
      toolCalls: Promise.resolve([]),
    };
  };
  const permission = new PermissionManager(hangConfig.permission, async () => "deny");
  const session = Session.create({ store, registry, config: hangConfig, permission, runner }, { cwd: dir });
  const events: string[] = [];
  for await (const e of session.prompt("hello")) events.push(e.type);
  expect(calls).toBe(2);
  expect(events).toContain("done");
  expect(events).not.toContain("error");
});
```

- [ ] **Step 2: Run it — FAIL** (hangs are currently forever; vitest will time the test out — confirm the failure mode, then move on).

- [ ] **Step 3: Implement.** In `session.ts` add imports:

```ts
import { firstKeyedModel, nextModelOnError, streamWithIdleTimeout, MODEL_RETRIES, type RetryState } from "../provider/reliability";
import { markProvider } from "../provider/health";
```

Add a module-level helper near `friendlyError`:

```ts
function healthIdOf(modelId: string): string {
  const provider = modelId.slice(0, Math.max(0, modelId.indexOf("/")));
  return provider === "termcoderfree" ? "pollinations" : provider;
}
```

Inside the retry `while (true)` loop, replace the stream consumption block. Current code:

```ts
          let streamError: string | null = null;
          let emittedText = false;
          for await (const chunk of result.fullStream) {
            if (chunk.type === "text-delta") {
              emittedText = true;
              yield { type: "text-delta", text: chunk.text ?? "" };
            } else if (chunk.type === "error") {
              if (signal?.aborted) return;
              streamError = friendlyError(stringifyError(chunk.error));
              break;
            }
          }

          if (!streamError) break;
```

New code (also create the per-attempt abort and pass a combined signal into `activeRunner`; change the `signal,` property in the `activeRunner({ ... })` call to `signal: attemptSignal,`):

```ts
          const attemptAbort = new AbortController();
          const attemptSignal = signal ? AbortSignal.any([signal, attemptAbort.signal]) : attemptAbort.signal;
```

(placed immediately before the `result = activeRunner({` call), and the consumption becomes:

```ts
          const idleMs = this.deps.config.reliability?.idleTimeoutMs ?? 45000;
          let streamError: string | null = null;
          let emittedText = false;
          for await (const chunk of streamWithIdleTimeout(result.fullStream, idleMs, () => attemptAbort.abort())) {
            if (chunk.type === "text-delta") {
              emittedText = true;
              yield { type: "text-delta", text: (chunk as { text?: string }).text ?? "" };
            } else if (chunk.type === "error") {
              if (signal?.aborted) return;
              streamError = friendlyError(stringifyError((chunk as { error?: unknown }).error));
              break;
            }
          }

          if (!streamError) {
            markProvider(healthIdOf(modelToUse), true);
            break;
          }
          markProvider(healthIdOf(modelToUse), false, streamError);
```

- [ ] **Step 4: Run the full session test file — PASS**, plus `pnpm --filter @termcoder/core build && pnpm --filter @termcoder/core typecheck`.

Run: `npx vitest run packages/core/src/session/session.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/session.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): idle-timeout + provider-health wiring in the session loop"
```

---

### Task 5: resolveModel compat branch + registry-aware keys

**Files:**
- Modify: `packages/core/src/provider/provider.ts`
- Test: `packages/core/src/provider/provider.test.ts` (create if absent; check for an existing file first and extend it)

**Interfaces:**
- Consumes: `providerInfo` (Task 1).
- Produces: `resolveModel("groq/llama-3.3-70b-versatile", …)` works when a groq key exists (config or `GROQ_API_KEY`); unknown providers keep failing with a helpful error that now names the registry.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { ConfigSchema } from "../config/config";
import { resolveModel } from "./provider";

describe("resolveModel openai-compat registry branch", () => {
  it("resolves a registry compat provider with a config key", () => {
    const config = ConfigSchema.parse({ providers: { groq: { apiKey: "gsk_x" } } });
    expect(resolveModel("groq/llama-3.3-70b-versatile", { config, env: {} })).toBeTruthy();
  });
  it("resolves via the registry env var", () => {
    const config = ConfigSchema.parse({});
    expect(resolveModel("mistral/mistral-small-latest", { config, env: { MISTRAL_API_KEY: "x" } })).toBeTruthy();
  });
  it("keeps model ids containing slashes intact", () => {
    const config = ConfigSchema.parse({ providers: { openrouter: { apiKey: "x" } } });
    expect(resolveModel("openrouter/meta-llama/llama-3.3-70b-instruct:free", { config, env: {} })).toBeTruthy();
  });
  it("throws a key error for a compat provider without a key", () => {
    const config = ConfigSchema.parse({});
    expect(() => resolveModel("groq/llama-3.3-70b-versatile", { config, env: {} })).toThrow(/GROQ_API_KEY|key/i);
  });
  it("still rejects unknown providers", () => {
    const config = ConfigSchema.parse({});
    expect(() => resolveModel("wat/nope", { config, env: {} })).toThrow(/unknown provider/i);
  });
});
```

- [ ] **Step 2: Run it — FAIL** (groq/mistral currently hit the `default:` throw).

- [ ] **Step 3: Implement.** In `provider.ts`:

Add import:

```ts
import { providerInfo } from "./registry";
```

Add a helper near `requireKey`:

```ts
function keyFromEnv(provider: string, env: NodeJS.ProcessEnv): string | undefined {
  for (const name of providerInfo(provider)?.keyEnv ?? []) {
    if (env[name]) return env[name];
  }
  return undefined;
}
```

In the `resolveModel` switch, replace the `default:` case:

```ts
    default: {
      const info = providerInfo(provider);
      if (info?.kind === "openai-compat") {
        const apiKey = cfg.apiKey ?? keyFromEnv(provider, env);
        if (!apiKey) {
          throw new Error(`No API key for "${provider}". Set ${info.keyEnv?.[0] ?? "an API key"} or run /key ${provider} <key>.`);
        }
        return createOpenAI({ baseURL: cfg.baseURL ?? info.baseURL, apiKey }).chat(model);
      }
      throw new Error(`Unknown provider "${provider}". Connectable providers: anthropic, openai, google, groq, openrouter, mistral, deepseek, xai, together, cerebras, ollama, termcoderfree.`);
    }
```

Also update `providerHasKey` (same file) to honor registry env vars, replacing its three hardcoded `if (provider === …)` lines:

```ts
function providerHasKey(config: Config, env: NodeJS.ProcessEnv, provider: string): boolean {
  if (KEYLESS_PROVIDERS.has(provider)) return true;
  if (config.providers[provider]?.apiKey) return true;
  return Boolean(keyFromEnv(provider, env));
}
```

- [ ] **Step 4: Run it — PASS**, plus the whole provider folder: `npx vitest run packages/core/src/provider` and typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/provider/provider.ts packages/core/src/provider/provider.test.ts
git commit -m "feat(core): any registry provider resolves via the openai-compat branch"
```

---

### Task 6: probeProvider + health-aware routing

**Files:**
- Modify: `packages/core/src/provider/provider.ts` (probe + routing skips), `packages/core/src/provider/reliability.ts` (`firstKeyedModel` skips)
- Test: `packages/core/src/provider/provider.test.ts`, `packages/core/src/provider/reliability.test.ts`
- Modify: `packages/core/src/index.ts` (export `probeProvider`)

**Interfaces:**
- Produces: `probeProvider(id: string, opts: ResolveModelOptions & { probe?: (model: LanguageModel) => Promise<unknown> }): Promise<{ ok: boolean; error?: string }>` — the `probe` injection keeps tests offline.
- Behaviour: probe resolves the registry `fastModel`, runs a 1-token generate under a 10s abort, marks health both ways. `pickAutoModel` and `firstKeyedModel` skip providers where `providerMarkedBad(id)` is true.

- [ ] **Step 1: Write the failing tests.** In `provider.test.ts`:

```ts
import { afterEach } from "vitest";
import { clearProviderHealth, markProvider, providerMarkedBad } from "./health";
import { pickAutoModel, probeProvider } from "./provider";

afterEach(() => clearProviderHealth());

describe("probeProvider", () => {
  it("marks a provider good on success", async () => {
    const config = ConfigSchema.parse({ providers: { groq: { apiKey: "x" } } });
    const r = await probeProvider("groq", { config, env: {}, probe: async () => "ok" });
    expect(r.ok).toBe(true);
    expect(providerMarkedBad("groq")).toBe(false);
  });
  it("marks a provider bad on failure with the error", async () => {
    const config = ConfigSchema.parse({ providers: { groq: { apiKey: "x" } } });
    const r = await probeProvider("groq", { config, env: {}, probe: async () => { throw new Error("credit balance too low"); } });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/credit/i);
    expect(providerMarkedBad("groq")).toBe(true);
  });
  it("fails fast when the provider has no key", async () => {
    const config = ConfigSchema.parse({});
    const r = await probeProvider("groq", { config, env: {} });
    expect(r.ok).toBe(false);
  });
});

describe("health-aware routing", () => {
  it("pickAutoModel skips a provider marked bad", () => {
    const config = ConfigSchema.parse({ providers: { google: { apiKey: "g" }, anthropic: { apiKey: "a" } } });
    expect(pickAutoModel(config, {})).toBe("google/gemini-2.5-flash");
    markProvider("google", false, "down");
    expect(pickAutoModel(config, {})).toBe("anthropic/claude-haiku-4-5-20251001");
  });
});
```

In `reliability.test.ts`:

```ts
import { clearProviderHealth, markProvider } from "./health";

it("firstKeyedModel skips a provider marked bad", () => {
  const cfg = ConfigSchema.parse({ providers: { google: { apiKey: "g" }, openai: { apiKey: "o" } } });
  markProvider("google", false, "down");
  expect(firstKeyedModel(cfg, {})).toBe("openai/gpt-4o-mini");
  clearProviderHealth();
});
```

- [ ] **Step 2: Run them — FAIL.**

- [ ] **Step 3: Implement.** In `provider.ts` add imports:

```ts
import { markProvider, providerMarkedBad } from "./health";
```

Append:

```ts
export interface ProbeOptions extends ResolveModelOptions {
  probe?: (model: LanguageModel) => Promise<unknown>;
}

export async function probeProvider(id: string, opts: ProbeOptions): Promise<{ ok: boolean; error?: string }> {
  const info = providerInfo(id);
  if (!info) return { ok: false, error: `Unknown provider "${id}".` };
  try {
    const model = resolveModel(info.fastModel, opts);
    const run =
      opts.probe ??
      (async (m: LanguageModel) =>
        generateText({ model: m, prompt: "Reply with exactly: ok", abortSignal: AbortSignal.timeout(10_000) }));
    await run(model);
    markProvider(id, true);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    markProvider(id, false, error);
    return { ok: false, error };
  }
}
```

In `pickAutoModel`, change the provider chain to skip unhealthy candidates:

```ts
  const usable = (p: string) => hasApiKey(p) && !providerMarkedBad(p);
  const provider =
    (usable("google") && "google") ||
    (usable("anthropic") && "anthropic") ||
    (usable("openai") && "openai") ||
    (config.providers.ollama && !providerMarkedBad("ollama") && "ollama") ||
    "pollinations";
```

In `reliability.ts`'s `firstKeyedModel`, wrap each `has(...)` check:

```ts
import { providerMarkedBad } from "./health";
```

```ts
export function firstKeyedModel(config: Config, env: NodeJS.ProcessEnv): string | undefined {
  const has = (provider: string, ...vars: string[]) =>
    !providerMarkedBad(provider) &&
    (Boolean(config.providers[provider]?.apiKey) || vars.some((v) => Boolean(env[v])));
  if (has("google", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY")) return "google/gemini-2.5-flash";
  if (has("anthropic", "ANTHROPIC_API_KEY")) return "anthropic/claude-haiku-4-5-20251001";
  if (has("openai", "OPENAI_API_KEY")) return "openai/gpt-4o-mini";
  return undefined;
}
```

Export from `index.ts` (probeProvider returns raw provider errors; `friendlyError` is exported so the server/TUI layers can humanize them — `provider.ts` cannot import it from `session.ts` without a cycle):

```ts
export { probeProvider, type ProbeOptions } from "./provider/provider";
export { friendlyError } from "./session/session";
```

- [ ] **Step 4: Run the provider folder + full core — PASS**, typecheck clean.

Run: `npx vitest run packages/core/src && pnpm --filter @termcoder/core typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/provider packages/core/src/index.ts
git commit -m "feat(core): probeProvider + health-aware routing"
```

---

### Task 7: Registry-driven Connect surface (auth.ts)

**Files:**
- Modify: `packages/core/src/auth/auth.ts`
- Test: `packages/core/src/auth/auth.test.ts` (create if absent; extend if present)

**Interfaces:**
- Produces: `CONNECTABLE_PROVIDERS` now covers every registry provider that takes a key (native + openai-compat), in registry order; anthropic/openai keep their two unavailable OAuth methods first; every api-key method's `hint` includes the provider's `keyUrl` and `freeTier` note when present. `providerAuthMethods` unchanged.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { CONNECTABLE_PROVIDERS, providerAuthMethods } from "./auth";

describe("connectable providers", () => {
  it("covers every key-based registry provider", () => {
    const ids = CONNECTABLE_PROVIDERS.map((p) => p.provider);
    expect(ids).toEqual(["anthropic", "openai", "google", "groq", "openrouter", "mistral", "deepseek", "xai", "together", "cerebras"]);
  });
  it("api-key hints carry the key url", () => {
    const groq = CONNECTABLE_PROVIDERS.find((p) => p.provider === "groq")!;
    const apiKey = groq.methods.find((m) => m.id === "api-key")!;
    expect(apiKey.available).toBe(true);
    expect(apiKey.hint).toContain("console.groq.com");
  });
  it("anthropic keeps its oauth placeholders", () => {
    expect(providerAuthMethods("anthropic").filter((m) => !m.available)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it — FAIL.**

- [ ] **Step 3: Implement.** Rewrite `auth.ts` body (types unchanged):

```ts
import { PROVIDERS } from "../provider/registry";

export type AuthMethodId = "api-key" | "oauth-browser" | "oauth-headless";

export interface AuthMethod {
  id: AuthMethodId;
  label: string;
  available: boolean;
  hint?: string;
}

export interface ProviderAuth {
  provider: string;
  label: string;
  methods: AuthMethod[];
}

const SOON = "Log in with your subscription — coming soon.";

const OAUTH_SOON: Record<string, AuthMethod[]> = {
  anthropic: [
    { id: "oauth-browser", label: "Claude Pro/Max (browser)", available: false, hint: SOON },
    { id: "oauth-headless", label: "Claude Pro/Max (headless)", available: false, hint: SOON },
  ],
  openai: [
    { id: "oauth-browser", label: "ChatGPT Pro/Plus (browser)", available: false, hint: SOON },
    { id: "oauth-headless", label: "ChatGPT Pro/Plus (headless)", available: false, hint: SOON },
  ],
};

function apiKeyMethod(keyUrl?: string, freeTier?: string): AuthMethod {
  const parts = ["Paste an API key."];
  if (freeTier) parts.unshift(`${freeTier[0]!.toUpperCase()}${freeTier.slice(1)}.`);
  if (keyUrl) parts.push(`Get one: ${keyUrl}`);
  return { id: "api-key", label: "API key", available: true, hint: parts.join(" ") };
}

export const CONNECTABLE_PROVIDERS: ProviderAuth[] = PROVIDERS.filter(
  (p) => p.kind === "native" || p.kind === "openai-compat",
).map((p) => ({
  provider: p.id,
  label: p.label,
  methods: [...(OAUTH_SOON[p.id] ?? []), apiKeyMethod(p.keyUrl, p.freeTier)],
}));

export function providerAuthMethods(provider: string): AuthMethod[] {
  return CONNECTABLE_PROVIDERS.find((p) => p.provider === provider)?.methods ?? [];
}
```

- [ ] **Step 4: Run it — PASS**, plus the full core suite (server/tui consume this shape) and typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/auth/auth.ts packages/core/src/auth/auth.test.ts
git commit -m "feat(core): connect surface lists every registry provider"
```

---

### Task 8: Server — probe route + provider info in /providers

**Files:**
- Modify: `packages/server/src/server.ts`
- Test: `packages/server/src/server.test.ts`

**Interfaces:**
- Consumes: `probeProvider`, `providerHealthSnapshot`, `PROVIDERS` from `@termcoder/core`.
- Produces: `POST /providers/probe` body `{ provider }` → `{ ok, error? }` (400 on missing/unknown provider). The existing `GET /providers` response gains, per provider: `keyUrl`, `freeTier`, and `health` (`"ok" | "bad" | "unknown"`).

- [ ] **Step 1: Write the failing test** (mirror the file's existing `/providers` test setup):

```ts
it("probes a provider and reports health", async () => {
  const bad = await fetch(`${base()}/providers/probe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "nope" }),
  });
  expect(bad.status).toBe(400);

  const res = await fetch(`${base()}/providers/probe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "groq" }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { ok: boolean; error?: string };
  expect(body.ok).toBe(false);

  const providers = (await (await fetch(`${base()}/providers`)).json()) as {
    providers: Array<{ name: string; keyUrl?: string; health?: string }>;
  };
  const groq = providers.providers.find((p) => p.name === "groq");
  expect(groq?.health).toBe("bad");
  expect(groq?.keyUrl).toContain("groq");
});
```

(The probe legitimately fails in tests — no key — which is exactly the "fails fast without a key" path; no network call happens.)

- [ ] **Step 2: Run it — FAIL.** Note: match the actual shape of the existing `GET /providers` handler when adapting assertions — if it returns a bare array instead of `{ providers }`, adjust the test to the real shape first.

- [ ] **Step 3: Implement.** Add imports (`probeProvider`, `providerHealthSnapshot`, `providerInfo`) to the core import block. Next to the existing `/providers` handler:

```ts
  if (req.method === "POST" && parts.length === 2 && parts[0] === "providers" && parts[1] === "probe") {
    const body = await readJson(req);
    const provider = typeof body.provider === "string" ? body.provider : "";
    if (!provider || !providerInfo(provider)) return sendJson(res, 400, { error: "unknown provider" });
    const result = await probeProvider(provider, { config: ctx.config });
    return sendJson(res, 200, result.ok ? result : { ok: false, error: friendlyError(result.error ?? "no response") });
  }
```

(`friendlyError` joins the core import block alongside `probeProvider`.)

Extend the `GET /providers` mapper: for each provider entry add

```ts
    keyUrl: providerInfo(p.provider)?.keyUrl,
    freeTier: providerInfo(p.provider)?.freeTier,
    health: (() => {
      const h = providerHealthSnapshot()[p.provider];
      if (!h || Date.now() > h.until) return "unknown";
      return h.ok ? "ok" : "bad";
    })(),
```

(Adapt the property names to the handler's real variables; keep the existing `configured`/`methods` fields untouched.)

- [ ] **Step 4: Run — PASS.** `pnpm --filter @termcoder/core build && npx vitest run packages/server/src/server.test.ts` + server typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/src/server.test.ts
git commit -m "feat(server): provider probe route + health/keyUrl in /providers"
```

---

### Task 9: TUI — probe on /key, registry-driven /connect, picker states

**Files:**
- Modify: `packages/tui/src/app.tsx`, `packages/tui/src/components/ModelPicker.tsx`

**Interfaces:**
- Consumes: `probeProvider`, `providerHealthSnapshot`, `CONNECTABLE_PROVIDERS` (already imported), `providerInfo` from `@termcoder/core`.
- Produces: `/key <provider> <key>` saves then probes, printing `✓ <provider> connected — works!` or `✗ <provider>: <friendly error>`; `/key` accepts any registry key provider (not just google/anthropic/openai); `/connect` lists every provider with its key URL; the model picker shows `●` (health ok), `◐` (key saved, unverified), `○` (needs key).

- [ ] **Step 1: Extend `/key`.** In `app.tsx`'s `case "key"`, replace the provider allowlist check:

```ts
        const validProvider = ["google", "anthropic", "openai"].includes(provider);
```

becomes (import `providerInfo` and `probeProvider` from `@termcoder/core`):

```ts
        const info = providerInfo(provider);
        const validProvider = Boolean(info && (info.kind === "native" || info.kind === "openai-compat"));
```

(match the real existing condition shape at ~L611 — it is currently an inline `!["google","anthropic","openai"].includes(provider)`), and update the usage text to `"Usage: /key <provider> <api-key> — /connect lists providers"`. After the successful `saveConfig` branch, add the probe:

```ts
          pushHistory({ kind: "notice", text: `✓ Saved your ${provider} API key — testing…` });
          void probeProvider(provider, { config }).then((r) => {
            pushHistory(
              r.ok
                ? { kind: "notice", text: `✓ ${provider} connected — works!` }
                : { kind: "error", text: `✗ ${provider}: ${friendlyError(r.error ?? "did not respond")}` },
            );
            forceRender((n) => n + 1);
          });
```

(`friendlyError` joins the `@termcoder/core` import block with `probeProvider` and `providerInfo`.)

- [ ] **Step 2: `/connect` listing.** The no-arg `/connect` branch already maps `CONNECTABLE_PROVIDERS` — after Task 7 it automatically lists all ten. Extend each line with the key URL when present (`providerInfo(p.provider)?.keyUrl`), keeping the existing format.

- [ ] **Step 3: Picker states.** In `app.tsx`, where the picker's ready state is computed (`providerHasKey(...)` usage feeding `ModelPicker`), pass a `verify` state instead of a boolean when cheap to do: compute per model row in `ModelPicker.tsx`:

```ts
const snapshot = providerHealthSnapshot();
function readiness(provider: string, hasKey: boolean): "ready" | "unverified" | "needs-key" {
  const h = snapshot[provider];
  if (h && Date.now() < h.until && h.ok) return "ready";
  return hasKey ? "unverified" : "needs-key";
}
```

Render `●` for ready, `◐` for unverified, `○` for needs-key (the picker currently renders `●`/`○` from a boolean — extend that ternary). Keep colors: ready=green/success, unverified=amber/running, needs-key=muted.

- [ ] **Step 4: Typecheck + build**

Run: `cd packages/tui && npx tsc --noEmit && cd ../.. && pnpm --filter @termcoder/tui build`

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/app.tsx packages/tui/src/components/ModelPicker.tsx
git commit -m "feat(tui): key probing, full provider list, truthful picker states"
```

---

### Task 10: Desktop — Test connection + auto-probe + picker states + i18n

**Files:**
- Modify: `packages/desktop/src/renderer/Settings.tsx` (providers tab / Connect modal)
- Modify: `packages/desktop/src/renderer/ModelBrowser.tsx` (readiness states)
- Modify: `packages/desktop/src/renderer/i18n.ts` (en/pt/es keys)

**Interfaces:**
- Consumes: server `POST /providers/probe` + extended `GET /providers` (Task 8).
- Produces: each provider row in the Connect surface shows label + free-tier note + "Get a key" link (opens externally) + a **Test connection** button with inline `✓ works` / `✗ <error>` result; saving a key auto-probes; the model browser maps `health` to `●/◐/○`.

- [ ] **Step 1: Add i18n keys** (en/pt/es blocks, next to the existing `settings.providers` keys):

```ts
  "providers.test": "Test connection",
  "providers.testing": "Testing…",
  "providers.works": "Works!",
  "providers.getKey": "Get a key",
```

(pt: "Testar conexão" / "Testando…" / "Funciona!" / "Pegar uma chave". es: "Probar conexión" / "Probando…" / "¡Funciona!" / "Obtener una clave".)

- [ ] **Step 2: Wire the providers tab.** In `Settings.tsx`, the providers tab already fetches `/providers`; store the new `keyUrl`/`freeTier`/`health` fields. Add state `const [probeState, setProbeState] = useState<Record<string, { busy?: boolean; ok?: boolean; error?: string }>>({});` and:

```tsx
  async function testProvider(name: string) {
    setProbeState((s) => ({ ...s, [name]: { busy: true } }));
    try {
      const r = await fetch(`${httpBase}/providers/probe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: name }),
      }).then((x) => x.json() as Promise<{ ok: boolean; error?: string }>);
      setProbeState((s) => ({ ...s, [name]: { ok: r.ok, error: r.error } }));
    } catch {
      setProbeState((s) => ({ ...s, [name]: { ok: false, error: "server unreachable" } }));
    }
  }
```

Each provider row renders: the free-tier note (muted), an anchor for `keyUrl` (`window.api?.openExternal?.(url)` if the preload exposes it, else `target="_blank"` — match how other external links in this file open), the Test connection button (`disabled={probeState[name]?.busy}`, label `providers.testing` while busy), and the inline result (`providers.works` in success color, or the error text muted-red). In the existing key-save handler (`patchConfig({ providers: … })` in the Connect modal), call `void testProvider(name)` after a successful save.

- [ ] **Step 3: Model browser states.** In `ModelBrowser.tsx`, where the ready dot is computed from `configured`, use `health` when present: `health === "ok"` → filled dot (ready color), `health === "bad"` → `◐` amber with the provider error as `title`, else fall back to the current configured/not logic (`◐` for configured-unverified, `○` otherwise).

- [ ] **Step 4: Typecheck**

Run: `cd packages/desktop && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/Settings.tsx packages/desktop/src/renderer/ModelBrowser.tsx packages/desktop/src/renderer/i18n.ts
git commit -m "feat(desktop): test-connection probes + truthful model states"
```

---

### Task 11: Docs + full verification (no version bump)

**Files:**
- Modify: `docs/configuration.md`

- [ ] **Step 1: Update docs.** In `docs/configuration.md` "Models & providers", add after the `providers.<name>.baseURL` bullet:

```markdown
- **Every major provider connects the same way.** Built in: Anthropic, OpenAI, Google,
  Groq, OpenRouter, Mistral, DeepSeek, xAI, Together, Cerebras — plus local Ollama and the
  keyless free tier. `/connect` lists them with a link to get a key; `/key <provider> <key>`
  saves and immediately tests it.
- **No call can hang.** A model that goes silent for `reliability.idleTimeoutMs`
  (default 45s) is treated as failed: termcoder retries, falls back to another provider,
  and tells you — instead of spinning forever. Routing also skips providers that just
  failed (for ~5 minutes), so `termcoder/auto` doesn't walk into the same wall twice.
```

- [ ] **Step 2: Full verification**

```bash
pnpm -r build && pnpm -r typecheck && npx vitest run
```
Expected: all green (235 + the new registry/health/reliability/provider/auth/server tests).

- [ ] **Step 3: Live smoke** (uses the real machine config — keys exist for anthropic/openai/google):

```bash
node -e "const m=require('./packages/core/dist/index.js');const cfg=m.loadConfig({cwd:process.cwd(),env:process.env});m.probeProvider('google',{config:cfg}).then(r=>console.log('google probe:',JSON.stringify(r)));"
```
Expected: `{"ok":true}` (the Gemini key verified live earlier). Optionally probe `anthropic` and observe `ok:false` with a billing error — proving truthful states.

- [ ] **Step 4: Commit + push**

```bash
git add -A
git commit -m "feat: the engine — every provider, no hangs, truthful readiness"
git push origin master:main
```

---

## Follow-ups (other bundle pieces, separate plans)

- Retrieval (spec: `2026-07-04-retrieval-design.md`).
- Desktop visual redesign (own spec, next).
- Claude subscription OAuth (spec exists).
- Repo-wide comment strip (dedicated careful pass).
- Website docs/features refresh (after the bundle's features land) + bundle version bump.
