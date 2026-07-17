# Dashboard Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let someone set real preferences and enable vetted MCP connectors from the web dashboard, and have the desktop app pick them up on `/sync`.

**Architecture:** The dashboard has no backend. The only channel to the desktop is the private `termcoder:sync` gist the app already reads and writes, using the `gist`-scoped token the browser already holds. Core gains a `settings` store with a per-key merge; the dashboard writes it; `/sync` pulls it.

**Tech Stack:** TypeScript, zod (already used by `config.ts`), vitest, Vite + React (the site), the GitHub gist API.

**Spec:** `docs/superpowers/specs/2026-07-16-dashboard-settings-design.md`

## Global Constraints

- **Code carries no comments.** Hard repo rule, stated twice by the user, emphatically. Explanations go in commit messages.
- **The gist must never carry an executable command.** `McpServerSchema`'s `stdio` variant is `{ command, args, env }` — a command line. The dashboard writes a catalogue `id` plus input values; the desktop resolves the id against its OWN local catalogue. An unknown id is ignored, never executed. A `command` field arriving in the gist is ignored even if present.
- **A gist-delivered connector arrives `enabled: false`** and requires an explicit confirmation in the desktop app before it runs.
- **Agent permissions, agent definitions, API keys and trusted folders are NEVER settable from the web.** `config.ts` allows `permission: { bash, write }` per path; the gist token lives in browser `localStorage`; a web-writable permission is privilege escalation.
- **Settings sync is GitHub-only.** `worker.js`'s `google()` deliberately returns no token, so a Google session cannot reach the gist. The UI must say so, not render dead controls.
- **Never widen the per-key merge to the other sync stores.** `favorites`, `drafts`, `decks`, `progress` keep their existing whole-file behaviour.
- **Anything pulled from the gist is untrusted input.** Validate against a schema before it touches local config; reject, don't coerce.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/sync/settings.ts` | the settings schema + the per-key merge (pure) |
| `packages/core/src/sync/sync.ts` | add `settings` to the stores; route it to the merge |
| `packages/core/src/mcp/catalog.ts` | resolve a catalogue reference to a real server config |
| `app/src/lib/gist.ts` | read/write the sync gist from the browser |
| `app/src/components/settings-panel.tsx` | the controls and the GitHub-only empty state |

---

### Task 1: Favourite models from the dashboard

**Files:**
- Create: `app/src/lib/gist.ts`
- Modify: `app/src/pages/dashboard.tsx`

**Interfaces:**
- Consumes: `Session` from `@/lib/session` (its `token` is non-empty only for GitHub).
- Produces: `findSyncGist(token)`, `readStore(token, gistId, name)`, `writeStore(token, gistId, name, data)` from `app/src/lib/gist.ts`.

This task exists to prove the whole channel — dashboard → gist → `/sync` → app — at the lowest possible risk, before anything new is designed in core. `favorites` already syncs today, so no core change is needed. If this does not work end to end, nothing later in this plan will.

The gist envelope shape is fixed by `packages/core/src/sync/sync.ts` and must match exactly:

```json
{ "updatedAt": 1763251200000, "data": ["anthropic/claude-sonnet-5"] }
```

`pullSync` skips the pull when the local file's mtime is newer than `updatedAt`, so a dashboard write MUST stamp `updatedAt: Date.now()` or the app will ignore it.

- [ ] **Step 1: Write the gist module**

Create `app/src/lib/gist.ts`:

```ts
const SYNC_PREFIX = "termcoder:sync";

export interface Envelope {
  updatedAt: number;
  data: unknown;
}

function headers(token: string) {
  return { authorization: "Bearer " + token, accept: "application/vnd.github+json" };
}

export async function findSyncGist(token: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/gists?per_page=100", { headers: headers(token) });
  if (!res.ok) throw new Error("github_" + res.status);
  const gists = await res.json();
  if (!Array.isArray(gists)) return null;
  const hit = gists.find((g: { description?: string }) => (g.description || "").indexOf(SYNC_PREFIX) === 0);
  return hit ? hit.id : null;
}

export async function readStore(token: string, gistId: string, name: string): Promise<unknown | null> {
  const res = await fetch("https://api.github.com/gists/" + gistId, { headers: headers(token) });
  if (!res.ok) throw new Error("github_" + res.status);
  const gist = await res.json();
  const file = gist.files?.[name + ".json"];
  if (!file) return null;
  const raw = file.truncated && file.raw_url ? await (await fetch(file.raw_url)).text() : file.content;
  const envelope = JSON.parse(raw) as Envelope;
  return envelope.data;
}

export async function writeStore(token: string, gistId: string, name: string, data: unknown): Promise<void> {
  const envelope: Envelope = { updatedAt: Date.now(), data };
  const res = await fetch("https://api.github.com/gists/" + gistId, {
    method: "PATCH",
    headers: { ...headers(token), "content-type": "application/json" },
    body: JSON.stringify({ files: { [name + ".json"]: { content: JSON.stringify(envelope, null, 2) } } }),
  });
  if (!res.ok) throw new Error("github_" + res.status);
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd app && npx tsc -b --force`
Expected: no output.

- [ ] **Step 3: Render favourites in the dashboard's Models tab**

`dashboard.tsx` already reads the synced gist in `loadSynced` for decks. Extend the Models tab so each model row carries a star that reflects, and toggles, the `favorites` store. Read it in the existing `useEffect` alongside the decks read (reuse the gist id you already resolve there rather than listing gists twice), and write it with `writeStore` on toggle.

Add to the component's state:

```tsx
  const [favorites, setFavorites] = useState<string[] | null>(null);
  const [gistId, setGistId] = useState<string | null>(null);
```

Toggling must be optimistic and must revert on failure — a star that lies is worse than no star:

```tsx
  const toggleFavorite = async (id: string) => {
    if (!session?.token || !gistId || favorites === null) return;
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    const previous = favorites;
    setFavorites(next);
    try {
      await writeStore(session.token, gistId, "favorites", next);
    } catch {
      setFavorites(previous);
    }
  };
```

The star only renders when `session?.token` and `gistId` are both present — a Google user or someone who has never run `/sync` has no gist, and must not see a control that cannot work.

- [ ] **Step 4: Build and verify**

Run: `cd app && npm run build && node verify.mjs`
Expected: `11 route(s) prerendered.` and `verify: 13 pages, every asset URL resolves, OAuth files intact.`

- [ ] **Step 5: Prove the channel end to end, by hand**

This is the point of the task; do not skip it. With a GitHub account that has run `/sync` at least once:
1. Star a model in the dashboard.
2. Confirm the gist's `favorites.json` changed (github.com/gist, or `readStore`).
3. Run `/sync` in the CLI.
4. Confirm the local `favorites.json` in the user config directory now contains it.

Record exactly what you saw. If the app ignores the write, check `updatedAt` first: `pullSync` skips when the local mtime is newer.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/gist.ts app/src/pages/dashboard.tsx
git commit -m "feat(app): star favourite models from the dashboard"
```

---

### Task 2: The settings store and its per-key merge

**Files:**
- Create: `packages/core/src/sync/settings.ts`
- Test: `packages/core/src/sync/settings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SettingsSchema`, `type Settings`, `type SettingsFile = Record<string, { value: unknown; updatedAt: number }>`, and `mergeSettings(local, remote): SettingsFile`, plus `parseSettings(raw: unknown): SettingsFile` which drops anything that fails validation.

Why per-key: `pullSync`'s mtime guard is whole-file, so whichever side is older loses its edits to *unrelated* keys. Merging key by key on a recorded `updatedAt` is what makes "set the theme in the app, set the model in the dashboard" work.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/sync/settings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergeSettings, parseSettings } from "./settings";

const at = (value: unknown, updatedAt: number) => ({ value, updatedAt });

describe("mergeSettings", () => {
  it("keeps the newer side per key, not per file", () => {
    const local = { theme: at("ember", 200), model: at("a/b", 50) };
    const remote = { theme: at("paper", 100), model: at("c/d", 300) };
    expect(mergeSettings(local, remote)).toEqual({ theme: at("ember", 200), model: at("c/d", 300) });
  });

  it("keeps a key present on only one side", () => {
    expect(mergeSettings({ a: at(1, 10) }, { b: at(2, 20) })).toEqual({ a: at(1, 10), b: at(2, 20) });
  });

  it("prefers local on an exact tie", () => {
    expect(mergeSettings({ a: at("local", 10) }, { a: at("remote", 10) })).toEqual({ a: at("local", 10) });
  });

  it("is a no-op against an empty remote", () => {
    expect(mergeSettings({ a: at(1, 10) }, {})).toEqual({ a: at(1, 10) });
  });
});

describe("parseSettings", () => {
  it("drops an unknown key rather than writing it to local config", () => {
    expect(parseSettings({ theme: at("ember", 1), evil: at("rm -rf", 2) })).toEqual({ theme: at("ember", 1) });
  });

  it("drops a known key whose value fails its schema", () => {
    expect(parseSettings({ language: at("klingon", 1) })).toEqual({});
    expect(parseSettings({ displayName: at("x".repeat(200), 1) })).toEqual({});
    expect(parseSettings({ theme: at(42, 1) })).toEqual({});
  });

  it("drops an entry with a missing or non-numeric updatedAt", () => {
    expect(parseSettings({ theme: { value: "ember" } })).toEqual({});
    expect(parseSettings({ theme: { value: "ember", updatedAt: "soon" } })).toEqual({});
  });

  it("returns empty for junk rather than throwing", () => {
    expect(parseSettings(null)).toEqual({});
    expect(parseSettings("nonsense")).toEqual({});
    expect(parseSettings([1, 2])).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run packages/core/src/sync/settings.test.ts`
Expected: FAIL — cannot resolve `./settings`.

- [ ] **Step 3: Implement**

Create `packages/core/src/sync/settings.ts`:

```ts
import { z } from "zod";

export const LANGUAGES = ["en", "pt", "es"] as const;

export const SettingsSchema = z.object({
  theme: z.string().min(1).max(40).optional(),
  language: z.enum(LANGUAGES).optional(),
  defaultModel: z.string().min(1).max(120).optional(),
  displayName: z.string().min(1).max(40).optional(),
  connectors: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        inputs: z.record(z.string(), z.string()).default({}),
      }),
    )
    .optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;

export interface SettingEntry {
  value: unknown;
  updatedAt: number;
}

export type SettingsFile = Record<string, SettingEntry>;

const EntrySchema = z.object({ value: z.unknown(), updatedAt: z.number().finite() });

export function parseSettings(raw: unknown): SettingsFile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SettingsFile = {};
  const shape = SettingsSchema.shape as Record<string, z.ZodTypeAny>;
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    const field = shape[key];
    if (!field) continue;
    const parsedEntry = EntrySchema.safeParse(entry);
    if (!parsedEntry.success) continue;
    const parsedValue = field.safeParse(parsedEntry.data.value);
    if (!parsedValue.success) continue;
    out[key] = { value: parsedValue.data, updatedAt: parsedEntry.data.updatedAt };
  }
  return out;
}

export function mergeSettings(local: SettingsFile, remote: SettingsFile): SettingsFile {
  const out: SettingsFile = { ...local };
  for (const [key, entry] of Object.entries(remote)) {
    const mine = out[key];
    if (!mine || entry.updatedAt > mine.updatedAt) out[key] = entry;
  }
  return out;
}
```

Note on `theme`: `config.ts` types it as `z.string().default("default")` — a free string, not an enum. So this schema deliberately does not restrict it to a list; a length bound is all the validation that is honest here, and matching config's own tolerance is correct. Do not invent a theme enum.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run packages/core/src/sync/settings.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sync/settings.ts packages/core/src/sync/settings.test.ts
git commit -m "feat(core): a settings store that merges key by key"
```

---

### Task 3: Wire the settings store into sync

**Files:**
- Modify: `packages/core/src/sync/sync.ts`
- Test: `packages/core/src/sync/sync.test.ts`

**Interfaces:**
- Consumes: `mergeSettings`, `parseSettings` from `./settings`.
- Produces: `"settings"` added to `DEFAULT_SYNC_STORES`; `pullSync` merges that one store instead of replacing it.

Only the `settings` store changes behaviour. `favorites`, `drafts`, `decks` and `progress` keep the existing whole-file mtime guard — do not touch them.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/sync/sync.test.ts` (follow the file's existing fake-GitHub-client and temp-config-dir setup — read it first and reuse its helpers rather than inventing new ones):

```ts
  it("merges the settings store key by key instead of replacing it", async () => {
    writeLocalStore("settings", {
      theme: { value: "ember", updatedAt: 200 },
      defaultModel: { value: "local/model", updatedAt: 50 },
    });
    const client = fakeClientWith({
      "settings.json": JSON.stringify({
        updatedAt: 999,
        data: {
          theme: { value: "paper", updatedAt: 100 },
          defaultModel: { value: "remote/model", updatedAt: 300 },
        },
      }),
    });

    await pullSync("settings", client, env);

    expect(readLocalStore("settings")).toEqual({
      theme: { value: "ember", updatedAt: 200 },
      defaultModel: { value: "remote/model", updatedAt: 300 },
    });
  });

  it("drops an unknown settings key arriving from the gist", async () => {
    writeLocalStore("settings", {});
    const client = fakeClientWith({
      "settings.json": JSON.stringify({
        updatedAt: 999,
        data: { evil: { value: "rm -rf /", updatedAt: 999 } },
      }),
    });

    await pullSync("settings", client, env);

    expect(readLocalStore("settings")).toEqual({});
  });

  it("still replaces a non-settings store wholesale", async () => {
    writeLocalStore("favorites", ["a"]);
    const client = fakeClientWith({
      "favorites.json": JSON.stringify({ updatedAt: Date.now() + 10_000, data: ["b"] }),
    });

    await pullSync("favorites", client, env);

    expect(readLocalStore("favorites")).toEqual(["b"]);
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run packages/core/src/sync/sync.test.ts`
Expected: FAIL — the settings merge tests fail because `pullSync` replaces the file.

- [ ] **Step 3: Implement**

In `packages/core/src/sync/sync.ts`, add the import:

```ts
import { mergeSettings, parseSettings, type SettingsFile } from "./settings";
```

Add `"settings"` to the stores:

```ts
export const DEFAULT_SYNC_STORES = ["favorites", "drafts", "decks", "progress", "settings"] as const;
```

Replace the body of `pullSync` after the envelope is parsed:

```ts
  const envelope = JSON.parse(raw) as SyncEnvelope;
  const local = readLocal(name, env);

  if (name === "settings") {
    const merged = mergeSettings(
      parseSettings(local?.data),
      parseSettings(envelope.data),
    );
    writeLocal(name, merged, env);
    return true;
  }

  if (local && local.updatedAt >= envelope.updatedAt) return false;
  writeLocal(name, envelope.data, env);
  return true;
```

The settings branch deliberately ignores the file-level `updatedAt`: per-key timestamps are the authority, and the file mtime is not a real edit time — a checkout or a restore moves it without anyone editing anything.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run packages/core/src/sync/sync.test.ts`
Expected: PASS, including the three new tests.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS. Report the actual count.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/sync/sync.ts packages/core/src/sync/sync.test.ts
git commit -m "feat(core): sync the settings store with a per-key merge"
```

---

### Task 4: Resolve a connector reference to a real server

**Files:**
- Modify: `packages/core/src/mcp/catalog.ts`
- Test: `packages/core/src/mcp/catalog.test.ts` (create if absent)

**Interfaces:**
- Consumes: what `packages/core/src/mcp/catalog.ts` ALREADY exports — `getConnector(id): McpConnector | undefined`, `missingRequiredInputs(connector, values): ConnectorInput[]`, and `connectorToServerConfig(connector, values): McpServerConfig`.
- Produces: `resolveConnector(ref: { id: string; inputs: Record<string, string> }): McpServerConfig | null` — returns `null` for an unknown id or a missing required input, and always sets `enabled: false`.

**This is the security-critical unit of the plan.** The gist is untrusted input. `resolveConnector` is the wall: a reference names a catalogue entry, and the command comes from the LOCAL catalogue.

The catalogue already does all the real work, so this is composition, not new logic — do not reimplement input handling or server building.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveConnector } from "./catalog";

describe("resolveConnector", () => {
  it("builds a server from the local catalogue, not from the reference", () => {
    const server = resolveConnector({ id: "filesystem", inputs: { root: "/tmp/project" } });
    expect(server).not.toBeNull();
    expect(server!.type).toBe("stdio");
    expect(server!.enabled).toBe(false);
  });

  it("returns null for an unknown id", () => {
    expect(resolveConnector({ id: "definitely-not-real", inputs: {} })).toBeNull();
  });

  it("ignores a command smuggled in the reference", () => {
    const ref = { id: "filesystem", inputs: { root: "/tmp" }, command: "curl", args: ["evil.sh"] } as never;
    const server = resolveConnector(ref);
    expect(JSON.stringify(server)).not.toContain("curl");
    expect(JSON.stringify(server)).not.toContain("evil.sh");
  });

  it("returns null when a required input is missing", () => {
    expect(resolveConnector({ id: "filesystem", inputs: {} })).toBeNull();
  });

  it("always arrives disabled", () => {
    const server = resolveConnector({ id: "filesystem", inputs: { root: "/tmp" } });
    expect(server!.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run packages/core/src/mcp/catalog.test.ts`
Expected: FAIL — `resolveConnector` is not exported.

- [ ] **Step 3: Implement**

Add to `packages/core/src/mcp/catalog.ts`:

```ts
export interface ConnectorRef {
  id: string;
  inputs: Record<string, string>;
}

export function resolveConnector(ref: ConnectorRef): McpServerConfig | null {
  const connector = getConnector(ref.id);
  if (!connector) return null;

  const inputs = ref.inputs ?? {};
  if (missingRequiredInputs(connector, inputs).length > 0) return null;

  return { ...connectorToServerConfig(connector, inputs), enabled: false };
}
```

Every value flows from `connector` — which came from the local catalogue by id — and never from `ref` beyond the id and the input strings. That is the whole security property: `ref.command` cannot exist in the output because nothing reads it.

If spreading over the union upsets TypeScript, narrow on `type` rather than casting; a cast here would defeat the schema that makes this safe.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run packages/core/src/mcp/catalog.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/mcp/catalog.ts packages/core/src/mcp/catalog.test.ts
git commit -m "feat(core): resolve a connector reference against the local catalogue"
```

---

### Task 5: The settings panel

**Files:**
- Create: `app/src/components/settings-panel.tsx`
- Modify: `app/src/pages/dashboard.tsx`

**Interfaces:**
- Consumes: `readSession` from `@/lib/session`; `findSyncGist`, `readStore`, `writeStore` from `@/lib/gist`.
- Produces: `<SettingsPanel />`, replacing the dashboard's fake `settings` tab body.

States, all four of which must render:
- **Not signed in** → "Sign in to manage your settings."
- **Signed in with Google (no token)** → "Settings sync needs a GitHub sign-in — it rides on your private gist." plus a link to sign in with GitHub. No controls.
- **Signed in with GitHub, no sync gist yet** → "Run `/sync` in the app once and your settings appear here." No controls.
- **Ready** → the controls.

Controls: theme, language, default model, display name. Each writes `{ value, updatedAt: Date.now() }` into the `settings` store on change, optimistically, reverting on failure. Beneath them, an honest line: "Changes reach the app next time it syncs — run `/sync`."

Do NOT build the connector UI in this task; that is Task 6.

- [ ] **Step 1: Implement the panel**

Follow `licence-panel.tsx` for structure and styling — it already solves the same problems (a state machine, an optimistic write, an honest empty state) in this codebase's idiom. Reuse `Row`/`Badge`/`Stat` from `dashboard.tsx` where they fit rather than inventing new primitives.

The panel must read the session inside `useEffect`, never during render: these pages are prerendered by a real `react-dom/server` pass, and touching `localStorage` during render crashes the build.

- [ ] **Step 2: Replace the fake settings tab**

In `dashboard.tsx`, replace the `{tab === "settings" && ( ... )}` block's body with `<SettingsPanel />`, deleting the `SETTINGS` sample constant and its rows. The `sample` badge on that tab must go — it is no longer a sample.

- [ ] **Step 3: Build and verify**

Run: `cd app && npx tsc -b --force && npm run build && node verify.mjs`
Expected: no typecheck errors, `11 route(s) prerendered.`, verify passing.

- [ ] **Step 4: Check the states in a browser**

Run: `cd app && npx vite preview --port 4215`, open `http://localhost:4215/TermCoder/dashboard.html`.

Plant sessions in localStorage to reach each state and confirm what renders:

```js
localStorage.setItem("tc-session", JSON.stringify({ provider: "google", name: "G", email: "g@e.com", avatar: "", token: "", sub: "google:1", session: "" }));
```

Expected: the GitHub-only message, and NO controls. Then confirm the signed-out state. Report exactly what you saw.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/settings-panel.tsx app/src/pages/dashboard.tsx
git commit -m "feat(app): a real settings panel on the dashboard"
```

---

### Task 6: Connectors in the dashboard, confirmed in the app

**Files:**
- Modify: `app/src/components/settings-panel.tsx`
- Modify: the desktop settings UI (find where MCP servers are listed today — `packages/desktop/src/renderer/Settings.tsx`)

**Interfaces:**
- Consumes: `resolveConnector` (Task 4), the `settings` store's `connectors` key (Task 2).
- Produces: no new exports.

The dashboard writes `connectors: [{ id, inputs }]` into the `settings` store. It writes an id and input values and NOTHING else — no command, no args. The desktop resolves each reference through `resolveConnector`, which yields a disabled server, and shows a confirmation before enabling.

- [ ] **Step 1: Add the connector list to the dashboard panel**

The available connectors and their inputs come from the catalogue. The dashboard has no access to `packages/core`, so the catalogue must be reachable from the site — the honest options are to publish a small JSON of `{id, name, inputs}` at build time from the core catalogue, or to hand-mirror it. Prefer generating it, so the two cannot drift: a hand-copy that goes stale means the dashboard offers a connector the app will not resolve. Say which you did and why in your report.

Rendering an input marked `kind: "env"` means the user may type a token into a web form which is then written to a gist. Do NOT accept secrets here in this task: render only connectors whose required inputs are all `kind: "arg"`, and show the others as "configure in the app". Secrets in the sync gist are out of scope and contradict the "API keys never sync" invariant.

- [ ] **Step 2: Confirm before enabling, in the desktop**

Where the desktop applies pulled settings, each `connectors` entry goes through `resolveConnector`. A `null` result is ignored silently — it is an unknown id, which is exactly the case this design exists to make harmless. A resolved server arrives `enabled: false` and is surfaced to the user as a prompt naming the connector, showing the resolved command, and requiring an explicit approve. Never auto-enable.

- [ ] **Step 3: Test the desktop side**

Add a test asserting that a pulled `connectors` entry with an unknown id produces no server and no prompt, and that a known id produces a disabled server awaiting confirmation. Run the covering test file and report the command and output.

- [ ] **Step 4: Build and verify both sides**

Run: `npx vitest run` (from the repo root) and `cd app && npm run build && node verify.mjs`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: enable a vetted connector from the dashboard, confirmed in the app"
```

---

## Manual acceptance

- [ ] Star a model in the dashboard → `/sync` → it is favourited in the app.
- [ ] Set the theme in the app; set the default model in the dashboard; `/sync`. **Both survive.** This is the whole point of the per-key merge — if either is lost, Task 3 is wrong.
- [ ] Hand-edit the gist's `settings.json` to contain an unknown key and a bogus connector id, then `/sync`. Nothing is written to local config and nothing executes.
- [ ] Sign in with Google → the settings panel says it needs GitHub and offers no controls.
- [ ] Enable a connector from the dashboard → the app asks before it runs, showing the resolved command.
