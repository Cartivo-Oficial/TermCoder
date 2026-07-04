# AI Quality (phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the keyless free AI reliable (retries + fallback instead of dying on a 500), make upgrading to a better model effortless (free Gemini key), and tighten the agent so it errs less.

**Architecture:** A small pure `reliability` helper decides the next model to try when a turn's model call fails; the session's stream loop uses it to retry the same model then fall back to a configured key before surfacing a friendly error. A guided "connect Google, free" upgrade path (CLI `/upgrade` + a desktop card) turns the honest quality jump into two clicks. Prompt tightening + a comment cleanup round out the touched code.

**Tech Stack:** TypeScript, pnpm monorepo (`@termcoder/core`, `@termcoder/tui`, `@termcoder/desktop`), Vitest, Vercel AI SDK, Ink (TUI), React (desktop).

## Global Constraints

- **Keyless stays the default.** `termcoderfree/auto` (→ `pollinations/openai`) must keep working with no key; every upgrade is opt-in, never nagged (dismiss is per-version via localStorage).
- **No new runtime dependencies.**
- **Node ≥ 20**, ESM. Tests colocated as `*.test.ts`, run with `npx vitest run`.
- **Never edit repo source via PowerShell** (UTF-8 mojibake) — use the editor tools.
- **Model ids:** free = `termcoderfree/auto`; Gemini fast = `google/gemini-2.5-flash`; Anthropic fast = `anthropic/claude-haiku-4-5-20251001`; OpenAI fast = `openai/gpt-4o-mini`.
- **OUT OF SCOPE (separate plan):** Claude Pro/Max & ChatGPT OAuth subscription login — needs the exact vendor OAuth params, planned separately.
- Keep the suite green (currently 215 tests). Bump `core`/`tui`/`desktop` to `0.6.0` and the tui `VERSION` const at the end.

---

### Task 1: Reliability helper (pure)

**Files:**
- Create: `packages/core/src/provider/reliability.ts`
- Test: `packages/core/src/provider/reliability.test.ts`

**Interfaces:**
- Produces:
  - `firstKeyedModel(config: Config, env: NodeJS.ProcessEnv): string | undefined` — the best fast model the user has a key for, else undefined.
  - `interface RetryState { model: string; retriesLeft: number; fallback?: string }`
  - `nextModelOnError(s: RetryState): RetryState | null` — the next attempt (retry same model, then fall back once), or null to give up.
  - `const MODEL_RETRIES = 1`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/provider/reliability.test.ts
import { describe, expect, it } from "vitest";
import { ConfigSchema } from "../config/config";
import { firstKeyedModel, nextModelOnError } from "./reliability";

describe("firstKeyedModel", () => {
  it("prefers Google, then Anthropic, then OpenAI, else undefined", () => {
    const empty = ConfigSchema.parse({});
    expect(firstKeyedModel(empty, {})).toBeUndefined();
    expect(firstKeyedModel(empty, { GEMINI_API_KEY: "x" })).toBe("google/gemini-2.5-flash");
    const anth = ConfigSchema.parse({ providers: { anthropic: { apiKey: "a" } } });
    expect(firstKeyedModel(anth, {})).toBe("anthropic/claude-haiku-4-5-20251001");
    const oai = ConfigSchema.parse({ providers: { openai: { apiKey: "o" } } });
    expect(firstKeyedModel(oai, {})).toBe("openai/gpt-4o-mini");
  });
});

describe("nextModelOnError", () => {
  it("retries the same model while retries remain", () => {
    expect(nextModelOnError({ model: "a", retriesLeft: 1 })).toEqual({ model: "a", retriesLeft: 0 });
  });
  it("falls back once retries are exhausted", () => {
    expect(nextModelOnError({ model: "a", retriesLeft: 0, fallback: "b" })).toEqual({ model: "b", retriesLeft: 0 });
  });
  it("gives up when no retries and no distinct fallback", () => {
    expect(nextModelOnError({ model: "a", retriesLeft: 0 })).toBeNull();
    expect(nextModelOnError({ model: "a", retriesLeft: 0, fallback: "a" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/provider/reliability.test.ts`
Expected: FAIL — "Cannot find module './reliability'".

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/provider/reliability.ts
import type { Config } from "../config/config";

/** How many times to retry the SAME model on a transient error before falling back. */
export const MODEL_RETRIES = 1;

/** The best fast model the user has a key for (better + more reliable than keyless). */
export function firstKeyedModel(config: Config, env: NodeJS.ProcessEnv): string | undefined {
  const has = (p: string, ...vars: string[]) =>
    Boolean(config.providers[p]?.apiKey) || vars.some((v) => Boolean(env[v]));
  if (has("google", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY")) return "google/gemini-2.5-flash";
  if (has("anthropic", "ANTHROPIC_API_KEY")) return "anthropic/claude-haiku-4-5-20251001";
  if (has("openai", "OPENAI_API_KEY")) return "openai/gpt-4o-mini";
  return undefined;
}

export interface RetryState {
  model: string;
  retriesLeft: number;
  fallback?: string;
}

/** The next attempt after a model error: retry the same model, then fall back once, then give up. */
export function nextModelOnError(s: RetryState): RetryState | null {
  if (s.retriesLeft > 0) return { model: s.model, retriesLeft: s.retriesLeft - 1, fallback: s.fallback };
  if (s.fallback && s.fallback !== s.model) return { model: s.fallback, retriesLeft: 0 };
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/provider/reliability.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Export + commit**

Add to `packages/core/src/index.ts` (near the other provider exports):

```ts
export { firstKeyedModel, nextModelOnError, MODEL_RETRIES, type RetryState } from "./provider/reliability";
```

```bash
git add packages/core/src/provider/reliability.ts packages/core/src/provider/reliability.test.ts packages/core/src/index.ts
git commit -m "feat(core): reliability helper — retry-then-fallback model selection"
```

---

### Task 2: Wire retry + fallback into the session stream loop

**Files:**
- Modify: `packages/core/src/session/session.ts` (the `prompt` generator's per-step stream loop, ~L411-450)
- Test: `packages/core/src/session/session.test.ts`

**Interfaces:**
- Consumes: `firstKeyedModel`, `nextModelOnError`, `MODEL_RETRIES`, `RetryState` from Task 1.
- Behaviour produced: a transient stream error (no text emitted yet) retries the same model up to `MODEL_RETRIES`, then falls back to `firstKeyedModel` if one exists, then yields a friendly error. A stream error AFTER text was emitted surfaces immediately (can't cleanly retry). Retries do NOT consume the `maxSteps` budget.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/session/session.test.ts`. The scripted runner errors on its first call and succeeds on the retry:

```ts
it("retries the model on a transient stream error and recovers", async () => {
  let calls = 0;
  const flakyRunner: ModelRunner = () => {
    calls += 1;
    const failing = calls === 1;
    async function* stream() {
      if (failing) {
        yield { type: "error" as const, error: new Error("Cannot connect to API") };
      } else {
        yield { type: "text-delta" as const, text: "Recovered." };
      }
    }
    return {
      fullStream: stream(),
      response: Promise.resolve({ messages: [{ role: "assistant", content: "Recovered." }] as never }),
      finishReason: Promise.resolve("stop"),
      toolCalls: Promise.resolve([]),
    };
  };
  const session = Session.create(
    { store, registry: new ToolRegistry(), config, permission, runner: flakyRunner },
    { cwd: dir, model: "termcoderfree/auto" },
  );
  const events: string[] = [];
  for await (const e of session.prompt("hi")) events.push(e.type);
  expect(calls).toBe(2); // failed once, retried once
  expect(events).toContain("done");
  expect(events).not.toContain("error");
});
```

(Reuse the file's existing `store`, `config`, `permission`, `dir`, and `ModelRunner`/`ToolRegistry` imports. `Session.create` accepts `model` in its options.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/session/session.test.ts -t "retries the model"`
Expected: FAIL — `calls` is 1 and an `error` event is emitted (no retry yet).

- [ ] **Step 3: Add imports**

At the top of `session.ts`, add to the existing `../provider/provider` import group a new import:

```ts
import { firstKeyedModel, nextModelOnError, MODEL_RETRIES } from "../provider/reliability";
```

- [ ] **Step 4: Replace the per-step stream + error handling**

Replace the block from `const result = activeRunner({` through the `if (streamError) { … }` block (the escalation block, ~L413-450) with an inner retry loop. New code:

```ts
        // Each step tries its model, retrying transient failures and falling
        // back to a configured key before giving up — so a flaky free tier
        // doesn't kill the turn.
        let attempt: RetryState = {
          model: modelToUse,
          retriesLeft: MODEL_RETRIES,
          fallback: firstKeyedModel(this.deps.config, this.deps.env),
        };
        let response: Awaited<typeof result.response> | undefined;
        let result!: ReturnType<ModelRunner>;
        let stepFailed = false;

        while (true) {
          result = activeRunner({
            system:
              systemPrompt(ctx.cwd, agent, persona) +
              (persona !== "study" && repoSummary ? `\n\n${repoSummary}` : "") +
              (skillMenu ? `\n\n${skillMenu}` : ""),
            messages: pruneMessagesForModel(
              this.record.messages,
              this.deps.config.context?.keepRecentToolResults ?? 6,
            ),
            tools,
            signal,
          });

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

          if (!streamError) break; // success — leave the retry loop

          // Can't cleanly retry once we've streamed text to the user.
          const next = emittedText ? null : nextModelOnError(attempt);
          if (!next) {
            yield { type: "error", error: streamError };
            stepFailed = true;
            break;
          }
          attempt = next;
          if (attempt.model !== modelToUse) {
            activeRunner = this.deps.runner ?? this.buildRunner(agent, attempt.model);
            modelToUse = attempt.model; // stick with the model that works
            yield { type: "text-delta", text: `\n\n⚠️ Switching to ${attempt.model}…\n\n` };
          }
          // loop: re-attempt this step (does not consume maxSteps)
        }
        if (stepFailed) return;
        response = await result.response;
        this.record.messages.push(...response.messages);
```

**Also:** just above the `for (let step …)` loop, introduce `modelToUse` and delete the now-unused `escalated`/`canEscalate` one-shot escalation variables:

```ts
    let modelToUse = routedModel ?? this.record.model;
```

And remove the old lines `let response = await result.response; this.record.messages.push(...response.messages);` that followed the deleted error block (now folded into the loop above).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run packages/core/src/session/session.test.ts`
Expected: PASS, including the existing escalation/error tests (the new path subsumes them — update any that assumed the exact "That model struggled" copy to match "Switching to").

- [ ] **Step 6: Typecheck + full suite + commit**

```bash
pnpm --filter @termcoder/core build
npx vitest run
git add packages/core/src/session/session.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): retry + key-fallback in the session loop for a flaky free tier"
```

---

### Task 3: Friendly, actionable connection-error copy

**Files:**
- Modify: `packages/core/src/session/session.ts` (the `friendlyError` connection branch)
- Test: `packages/core/src/session/session.test.ts`

**Interfaces:**
- Consumes: the existing `friendlyError(raw: string): string`.
- Produces: for connection/"cannot connect"/timeout errors, a message that points to the effortless upgrade.

- [ ] **Step 1: Write the failing test**

```ts
it("connection errors point at the free-tier retry and the upgrade", () => {
  // friendlyError is module-private; assert via a forced stream error instead.
  // (If friendlyError is exported, call it directly.)
});
```

If `friendlyError` is not exported, export it, and test directly:

```ts
import { friendlyError } from "./session";
it("connection errors suggest retry or connecting a better model", () => {
  const msg = friendlyError("Cannot connect to API");
  expect(msg).toMatch(/busy|try again/i);
  expect(msg).toMatch(/connect|key|Gemini/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/session/session.test.ts -t "connection errors"`
Expected: FAIL (message doesn't yet mention connecting a better model).

- [ ] **Step 3: Update the connection branch**

In `friendlyError`, change the `cannot connect / connect to api / network` branch return to:

```ts
    return "The free model is busy or unreachable right now. Try again in a moment — or connect a better model for fast, reliable answers: a free Gemini key (/upgrade), a local Ollama, or paste a provider key in Settings.";
```

Export `friendlyError` if it isn't already (`export function friendlyError`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/session/session.test.ts -t "connection errors"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/session.ts
git commit -m "feat(core): connection errors nudge the effortless upgrade"
```

---

### Task 4: CLI `/upgrade` — guided free-Gemini connection

**Files:**
- Modify: `packages/tui/src/commands.ts` (register the command)
- Modify: `packages/tui/src/app.tsx` (handle it)

**Interfaces:**
- Consumes: the existing `pushHistory({ kind, text })`, `providerHasKey`.
- Produces: a `/upgrade` command that prints the 3-step guided path (get a free Gemini key → `/key google …`), tailored to whether a key is already connected.

- [ ] **Step 1: Register the command** in `packages/tui/src/commands.ts`, right after the `setup` entry:

```ts
  { name: "upgrade", desc: "Connect a better model (free Gemini key) for much better answers" },
```

- [ ] **Step 2: Handle it** in `app.tsx` `handleCommand`, add a case near `setup`:

```ts
      case "upgrade": {
        const onKey = providerHasKey("google") || providerHasKey("anthropic") || providerHasKey("openai");
        pushHistory({
          kind: "notice",
          text: onKey
            ? "You're already connected to a provider — you're on the good stuff. /model to pick one."
            : [
                "termcoderfree is free but small. For MUCH better answers — free — connect Google Gemini:",
                "  1. Get a free key: https://aistudio.google.com/apikey",
                "  2. Run:  /key google YOUR_KEY",
                "That's it. termcoder/auto will use Gemini automatically. (Or install Ollama for unlimited local.)",
              ].join("\n"),
        });
        break;
      }
```

- [ ] **Step 3: Typecheck + build**

Run: `cd packages/tui && npx tsc --noEmit`
Expected: exit 0. Then `pnpm --filter @termcoder/tui build`.

- [ ] **Step 4: Commit**

```bash
git add packages/tui/src/commands.ts packages/tui/src/app.tsx
git commit -m "feat(tui): /upgrade — guided free-Gemini connection"
```

---

### Task 5: Desktop "connect a better model" upgrade card

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx` (empty-state region + a state flag)
- Modify: `packages/desktop/src/renderer/i18n.ts` (copy keys `upgrade.title`/`upgrade.body`/`upgrade.cta`/`upgrade.later`, en/pt/es)
- Modify: `packages/desktop/src/renderer/styles.css` (`.upgrade-card`)

**Interfaces:**
- Consumes: the existing Settings→Providers Connect flow (open Settings on `providers` tab), `t()`.
- Produces: a dismissible card in the empty state shown only when no provider key is configured and not dismissed this version.

- [ ] **Step 1: Add copy keys** to each of the en/pt/es blocks in `i18n.ts`:

```ts
  "upgrade.title": "Want much better answers?",
  "upgrade.body": "You're on the free model. Connect a free Google Gemini key (2 clicks) for faster, smarter replies.",
  "upgrade.cta": "Connect — free",
  "upgrade.later": "Not now",
```
(pt: "Quer respostas muito melhores?" / "Você está no modelo grátis. Conecte uma chave grátis do Google Gemini (2 cliques) para respostas mais rápidas e espertas." / "Conectar — grátis" / "Agora não". es: analogous.)

- [ ] **Step 2: Add the card** in the empty-state block (next to the `free-hint` button), gated by no configured key and not dismissed:

```tsx
{!(serverStatus?.providers ?? []).some((p) => p.configured && p.name !== "ollama") &&
 localStorage.getItem("tc-skip-upgrade") !== "1" ? (
  <div className="upgrade-card">
    <b>{t("upgrade.title")}</b>
    <span>{t("upgrade.body")}</span>
    <div className="upgrade-actions">
      <button className="settings-btn" onClick={() => { setSettingsTab("providers"); setSettingsOpen(true); }}>
        {t("upgrade.cta")}
      </button>
      <button className="update-later" onClick={(e) => { localStorage.setItem("tc-skip-upgrade", "1"); (e.currentTarget.closest(".upgrade-card") as HTMLElement).style.display = "none"; }}>
        {t("upgrade.later")}
      </button>
    </div>
  </div>
) : null}
```

- [ ] **Step 3: Style it** — append to `styles.css`:

```css
.upgrade-card { margin: 14px auto 0; max-width: 420px; display: flex; flex-direction: column; gap: 6px;
  padding: 14px 16px; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--accent);
  border-radius: 12px; text-align: left; }
.upgrade-card b { font-size: 13.5px; } .upgrade-card span { font-size: 12.5px; color: var(--muted); }
.upgrade-actions { display: flex; gap: 8px; margin-top: 6px; }
```

- [ ] **Step 4: Typecheck**

Run: `cd packages/desktop && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/i18n.ts packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): dismissible 'connect a better model' upgrade card"
```

---

### Task 6: Agent scaffolding — tighten the coder prompt

**Files:**
- Modify: `packages/core/src/session/session.ts` (`systemPrompt` coder persona text)
- Test: `packages/core/src/session/session.test.ts`

**Interfaces:**
- Produces: a crisper plan→act→verify protocol in the coder system prompt (helps the small model). No API change.

- [ ] **Step 1: Write the failing test** — assert the coder prompt states the protocol:

```ts
it("the coder system prompt states a plan->act->verify protocol", async () => {
  const session = Session.create({ store, registry: new ToolRegistry(), config, permission, runner: captureRunner }, { cwd: dir, model: "termcoder/auto" });
  let system = "";
  const cap: ModelRunner = (o) => { system = o.system; return errorOnceRunner(); };
  // simplest: reuse an existing capturing-runner pattern in this file to grab opts.system
  expect(system.toLowerCase()).toMatch(/verify|check|test/);
});
```

Prefer the file's existing capturing-runner helper if present; assert `opts.system` contains "plan", "verify"/"check". Keep the test minimal and aligned with how other prompt tests in this file capture `system`.

- [ ] **Step 2: Run it to verify it fails** (if the words aren't present yet).

Run: `npx vitest run packages/core/src/session/session.test.ts -t "plan->act->verify"`

- [ ] **Step 3: Tighten the coder prompt** — in `systemPrompt`, ensure the coder branch includes a concise protocol line, e.g.:

```
"Work in a tight loop: PLAN briefly, ACT with minimal diffs, then VERIFY (run the tests/build). " +
"Prefer small, correct changes. If unsure, read the relevant file before editing. Don't invent APIs — check first."
```

Keep it short and high-signal; don't bloat the prompt.

- [ ] **Step 4: Run tests + build**

Run: `npx vitest run packages/core/src/session && pnpm --filter @termcoder/core build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/session.ts packages/core/src/session/session.test.ts
git commit -m "feat(core): crisper plan->act->verify coder protocol"
```

---

### Task 7: Comment cleanup on the files this plan touched

**Files:**
- Modify: `reliability.ts`, `session.ts`, `commands.ts`, `app.tsx` (tui), `App.tsx`/`i18n.ts`/`styles.css` (desktop) — only files touched above.

**Interface:** none (no behaviour change).

- [ ] **Step 1:** Re-read each touched file. Remove comments that merely restate the code (e.g. `// increment i`), keep comments that explain a non-obvious *why* (e.g. "can't cleanly retry once we've streamed text"). Do not touch unrelated files.

- [ ] **Step 2: Typecheck + full suite** (nothing should change behaviourally)

Run: `pnpm -r typecheck && npx vitest run`
Expected: exit 0, 218+ tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: drop noise comments on the files touched this phase (keep the why)"
```

---

### Task 8: Version bump, docs, verify, ship

**Files:**
- Modify: `packages/{core,tui,desktop}/package.json` (version → 0.6.0), `packages/tui/src/app.tsx` (`VERSION`), `docs/configuration.md` (a short "Better answers" note).

- [ ] **Step 1: Bump versions to 0.6.0** in the three package.json files and the tui `VERSION` const.

- [ ] **Step 2: Add a docs note** to `docs/configuration.md` under Models: "termcoderfree is free but small — for much better answers connect a free Gemini key (`/key google …` or `/upgrade`); the free tier now retries and falls back to your key automatically if it hiccups."

- [ ] **Step 3: Build + full suite + live smoke**

Run:
```bash
pnpm -r build && pnpm -r typecheck && npx vitest run
```
Live smoke (node, from `packages/core`): resolve `termcoderfree/auto`, run a `generateText`, confirm a reply; simulate a first-call error with a scripted runner and confirm the session recovers (covered by Task 2's test).

- [ ] **Step 4: Commit + push**

```bash
git add -A
git commit -m "feat: AI quality phase 1 — reliable free tier + easy upgrade (v0.6.0)"
git push origin master:main
```

---

## Follow-up (separate plan, not this one)

- **Subscription OAuth login** (Claude Pro/Max browser + headless, then ChatGPT): needs the exact vendor OAuth client-id/endpoints/PKCE flow — research first, then its own `docs/superpowers/plans/…-oauth-login.md`. Wire it through the existing Connect modal ("coming soon" → available) and `provider.ts` credential path, isolated and failing gracefully to keyless.
- **Deep context/retrieval** for very large repos (later quality pass).
