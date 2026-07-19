# Network exposure — close the LAN server hole

base: 7b4295b
status: design (awaiting user review)

## Problem

The embedded server binds to **all interfaces** with **no authentication**:

- `packages/server/src/serve.ts` — `server.listen(port, () => …)` (no host arg → `0.0.0.0`).
- `packages/desktop/src/main/index.ts` — `server.listen(0, resolve)` (port 0, no host → `0.0.0.0`).

Consequences on any shared LAN (café, office, coworking Wi‑Fi):

- `GET /sessions` returns every session id, unauthenticated (`ctx.store.list()`).
- With a real id, a LAN attacker connects `/sessions/<realId>/stream`. Because `isGuest = ctx.roomTokens.has(id)` is `false` for a real id, the socket is treated as **host** — it can drive the agent, approve permissions, and stop runs. This bypasses the room observer boundary built in the rooms refactor.
- `GET /memory` exposes user memory bodies; `DELETE /sessions` wipes all sessions. Both unauthenticated.

Decision (user): **localhost by default + LAN opt‑in with token**, and **fix the critical (the open server) first**.

## Key insight

A room **guest** needs only two things over the network:

1. the static web app (so their browser loads the UI), and
2. the room WebSocket `/sessions/<roomToken>/stream`.

Verified against the guest path in `App.tsx`: a `?room=` guest short‑circuits startup to `connect(JOIN_ROOM)` and never calls the owner HTTP routes; its incidental `/agents`, `/commands`, `/models`, `/config` fetches are each `.catch(() => {})` and non‑essential for an observer.

Therefore the **owner API never needs to be on the LAN at all**. We remove the host‑impersonation chain by construction rather than authenticating around it.

## Architecture — two listeners, one shared `ctx`

`createServer` today builds `ctx` (holding `store`, `rooms`, `roomTokens`, `config`, …) internally and returns one `http.Server`. We hoist `ctx` construction so two listeners can share the same state.

### 1. API listener — `127.0.0.1`, always on

The full API, exactly as today, bound to loopback. Reachable only by local processes: the desktop renderer, the `term` CLI, a local browser. This is the entire fix for anyone who never opens a room — `GET /sessions`, `/memory`, `DELETE /sessions`, `/config` become unreachable from any other machine.

Change is the host argument only:

- `serve.ts`: `server.listen(port, "127.0.0.1", …)`.
- `main/index.ts`: `server.listen(0, "127.0.0.1", resolve)`.

The renderer already targets `http://localhost:<port>` / `ws://localhost:<port>` — unaffected (`localhost` resolves to `127.0.0.1`).

### 2. Room listener — `0.0.0.0`, on only while ≥1 room is open

A second `http.Server` + `WebSocketServer` sharing the same `ctx`, created when the first room opens and closed when the last room closes. It enforces a **hard allowlist** (`lanOnly` mode):

- Static web files (GET) — so a guest browser loads the app.
- `GET /sessions/<id>/stream` **iff `ctx.roomTokens.has(id)`** — a valid room token. A raw session id is rejected (close 1008 / 404), even though it exists in the store.
- Every other method+path → `404`. `/sessions`, `/sessions/:id/*`, `/memory`, `/config`, `/status`, `DELETE /sessions`, POST routes, etc. are not routable here.

Port: OS‑assigned random free port (bind `0.0.0.0:0`), read back after `listen`. Chosen over a fixed port so there is zero firewall/config ceremony; the invite carries the chosen port.

### Invite change

`inviteLinks({ addresses, port, joinToken, secure? })` currently emits `http://<addr>:<port>/?room=<token>` using the API port. It now takes the **room listener port**: `http://<addr>:<roomPort>/?room=<token>`. The `?room=` token form is unchanged; only the port source changes.

### Lifecycle

- **Open (opt‑in):** the host opening the Live Room panel fetches `GET /room/addresses`, which lazily and idempotently starts the room listener (`ensureRoomListener`, guarded by a pending‑promise so concurrent fetches don't double‑bind), captures its port, and returns it for the invite builder.
- **Close:** the room listener is torn down when the API server closes (app quit), via an `http.on("close")` hook that also clears `ctx.roomListener`.
- **Why not "close when the last room ends":** a "room" (`ctx.rooms` entry) is created for *every* session's WebSocket by `getRoom`, not only when hosting — so `ctx.rooms` is essentially never empty while the app is open with any session. Tying the listener's close to `ctx.rooms.size === 0` would therefore almost never fire and could close the listener during a transient empty state mid‑session. The accepted simplification is app‑quit teardown. This has **no security impact**: with `roomTokens` empty the listener rejects every WS and 404s every non‑static route, so the only residual LAN surface is the *public* built SPA bundle (`dist-web` = `index.html` + hashed assets, no secrets, no owner API, no host WebSocket). Tightening the surface to return to exactly zero when the host closes the Live Room panel requires an explicit host‑intent arm/disarm signal (a client teardown on panel close plus a matching server endpoint) and is a logged follow‑on, not part of the critical fix.
- The listener holds no independent state — it reads/writes the shared `ctx`, so presence/chat/signal flow identically whether a socket arrived via the API listener (host, loopback) or the room listener (guest, LAN).

## What this gives us

- **Default:** localhost‑only, zero LAN surface.
- **Host impersonation: eliminated.** The room listener accepts only room tokens; the owner API is not on the LAN, so there is nothing to impersonate.
- **Guest stays observer.** The existing `isGuest` allowlist (`chat` + `signal` only) on the WS is untouched and still applies on the room listener.
- **Guest DoS gate preserved.** The phantom‑room reject (unknown id that is neither a room token nor an existing session → close 1008) still applies.

## Explicitly out of scope (follow‑ons, logged not built)

- **Owner token on the localhost API.** Owner endpoints live only on `127.0.0.1`; a loopback‑scoped bearer token to defend against hostile *local* processes is a sensible later hardening, not part of the critical fix. Keeping it out keeps this change tight.
- **CLI `HOST` opt‑in has no auth (by design, with a warning).** The standalone `serve` CLI honors a `HOST` env override (default `127.0.0.1`) for headless/LAN use. When `HOST` is non‑loopback, the server prints a stderr warning that the *unauthenticated* API is network‑exposed. Adding auth to that path is the same owner‑token follow‑on above; until then it is a conscious operator opt‑in and is strictly better than the pre‑change behavior (which always bound `0.0.0.0`). The desktop app has no such override — it is hardcoded to loopback.
- `GET /memory` / `DELETE /sessions` authorization semantics beyond removing LAN reachability.
- HTTPS/TLS for the room listener (invite stays `http://` on the LAN; `secure?` flag already threaded for a future TLS story).

## Testable units

- **`lanOnly` routing guard** — pure function `(method, path, isRoomToken) → "allow" | 404`. Table‑tested: static GET allowed; `/sessions/<roomToken>/stream` allowed; `/sessions/<realId>/stream` denied; `/sessions`, `/memory`, `DELETE /sessions` denied.
- **Listener lifecycle** — opens on first room, closes on last; port captured after `listen`; idempotent ensure.
- **Invite port wiring** — `inviteLinks` uses the room port, not the API port; token form unchanged.
- **Binding** — API listener bound to `127.0.0.1` (a connection to a non‑loopback address is refused when no room is open).

## Risks

- **Two listeners can't share one port** (`0.0.0.0:P` overlaps `127.0.0.1:P`). Hence the room listener gets its own port. Documented; the invite change follows from it.
- **Guest incidental 404s** (`/agents`, `/config`, …) are already swallowed by `.catch`; confirm no guest code path treats a 404 as fatal.
- **Ephemeral port per room** — invite URL differs each session. Acceptable per user decision (random port).
