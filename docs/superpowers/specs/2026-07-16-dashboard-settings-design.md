# Dashboard settings — configuring the desktop from the web

**Date:** 2026-07-16
**Status:** draft, awaiting review

## Problem

The dashboard's Settings tab shows Display name, Theme, Default model and Sync via GitHub. None of it does anything — it is sample markup. The user's words: it has "basically no options for people". They want to configure real, technical things there and have the desktop app obey.

## The only channel

The dashboard is static on GitHub Pages. There is no backend and no database, and the no-hosted-compute guardrail stands. The desktop app runs on the user's machine. The **only** thing both sides can already reach is the private `termcoder:sync` gist.

So: the dashboard writes to the gist with the token it already holds (`gist` scope, from OAuth), and the desktop pulls on `/sync`. No new infrastructure.

## Facts this design is built on (verified in code)

- `DEFAULT_SYNC_STORES = ["favorites", "drafts", "decks", "progress"]` — `packages/core/src/sync/sync.ts`. **There is no `settings` store.** The dashboard's Settings tab has nowhere to write, which is exactly why it is fake.
- `favorites` already syncs, so favourite models are reachable from the dashboard with almost no core change.
- `pullSync` does `writeFileSync` of a whole store file. **Last write wins, no merge.**
- Sign-in with Google returns **no token** (`worker.js`'s `google()` deliberately omits it). Gist-backed settings are **GitHub-only**.
- API keys never sync. Documented invariant; keys stay on the machine.
- `McpServerSchema` (`packages/core/src/config/config.ts`) is a discriminated union: `stdio` carries `command`, `args`, `env`; `http` carries `url`, `headers`. **A stdio server config is an arbitrary command line.**
- A curated connector catalogue already exists at `packages/core/src/mcp/catalog.ts`.

## Decisions taken

**Scope: safe preferences + MCP connectors.** Agent permissions are excluded.

**Delivery: pull on `/sync`.** No polling — it would burn GitHub rate limit and mutate config under a running session.

## The security line

`config.ts` lets an agent carry `permission: { bash, write }` per path. If the web could write those, anyone holding the gist token — which lives in browser `localStorage` — could make the local agent auto-approve `bash`. That is privilege escalation, and it is why agent permissions are out of scope. This is not a "later" item; it is a boundary.

**MCP connectors are the same risk in smaller clothes.** A stdio server is a command line, so a gist-delivered `command` is remote code execution against the machine that pulls it. Two mitigations, both required:

1. **The gist never carries a command.** The dashboard writes a *catalogue reference*, not a server config:

   ```json
   { "id": "github", "env": { "GITHUB_TOKEN": "" }, "enabled": true }
   ```

   The desktop resolves `id` against its OWN local copy of the catalogue and builds the real `command`/`args` itself. An `id` that is not in the local catalogue is ignored, not executed. A connector the dashboard cannot name cannot run.

2. **The app confirms before enabling.** A connector arriving from the gist lands disabled and surfaces as "the dashboard wants to enable GitHub — allow?". Never enable something merely because it appeared in a file.

Anything the dashboard cannot express safely stays in the app. That is not a gap; it is the design.

## What the dashboard may set

| Setting | Store | Notes |
|---|---|---|
| Favourite models | `favorites` | already syncs — ship this first |
| Default model | `settings` | validated against the model catalogue |
| Theme | `settings` | one of the app's named themes |
| Display name | `settings` | shown in live rooms |
| Language | `settings` | one of en/pt/es |
| MCP connectors | `settings` | catalogue `id` + params only, arrive disabled |

Explicitly **not** settable from the web: API keys, agent definitions, agent permissions, arbitrary MCP commands, trusted folders.

## The merge problem

`pullSync` overwrites whole files, so a dashboard edit can silently destroy a newer local change — and the reverse. This must be solved before any button ships.

Chosen: **per-key last-write-wins with timestamps**, not per-file. Each settings key is stored as `{ value, updatedAt }`. `pullSync` for the `settings` store merges key by key, keeping whichever side has the newer `updatedAt`. A key edited on the desktop after the dashboard wrote it survives the pull; an untouched key takes the dashboard's value.

This changes `pullSync`'s contract for one store only. The other stores keep their current whole-file behaviour — widening this is out of scope.

## Google users

They have no token, so they cannot read or write the gist. The Settings tab must say so plainly — "settings sync needs a GitHub sign-in, because it rides on your private gist" — and offer to sign in with GitHub. It must not render a panel of controls that silently do nothing.

## Components

| Unit | Responsibility |
|---|---|
| `packages/core/src/sync/settings.ts` | the `settings` store: schema, per-key merge |
| `packages/core/src/sync/sync.ts` | add `settings` to the stores; route it to the merge |
| `packages/core/src/mcp/catalog.ts` | resolve a catalogue `id` to a real server config |
| `app/src/lib/gist.ts` | read/write the sync gist from the browser |
| `app/src/components/settings-panel.tsx` | the controls, and the GitHub-only empty state |
| desktop confirm prompt | approve a gist-delivered connector before enabling |

## Testing

- **Merge**: a key edited locally after a remote write survives the pull; an untouched key takes the remote value; a key present on only one side is kept. Pure function, no network.
- **Catalogue resolution**: a known `id` resolves to the expected command; an unknown `id` is ignored and never executed; a gist-supplied `command` field is ignored even if present.
- **Connector arrival**: a connector from the gist lands `enabled: false` and requires confirmation.
- **Validation**: an unknown theme/model/language from the gist is rejected rather than written into local config.
- **Browser**: the Google empty state; a real round-trip (dashboard write → `/sync` → app reads).

## Order of work

1. `favorites` from the dashboard — proves the whole channel (dashboard → gist → `/sync` → app) at the lowest possible risk. Nothing to design in core.
2. The `settings` store + per-key merge in core.
3. Preferences in the dashboard on top of it.
4. MCP connectors, catalogue-referenced, with the desktop confirmation.

## Out of scope

- Agent permissions, agent definitions, API keys, trusted folders.
- Polling / live apply.
- Widening the per-key merge to the other sync stores.
- Settings for Google-only users (blocked on them having a token at all).
