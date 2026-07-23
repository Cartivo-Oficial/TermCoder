# @termcoder/sdk — typed client for the local server (v1: session/chat core)

Date: 2026-07-23
Status: approved design, pending implementation plan
Package: `@termcoder/sdk` (new), consuming `@termcoder/server`'s HTTP + WebSocket API

## Summary

A new internal package `@termcoder/sdk` gives a **typed, hand-written TypeScript client** over the termcoder local server's HTTP + WebSocket API. v1 covers the **session/chat core** — the surface a VSCode extension (the next Tier-2 slice) and the desktop need: status/models/config, session CRUD + settings, and a streaming session driver (prompt → typed events → stop, with permission responses). No codegen; the client is small enough (~12 endpoints) to hand-write. Rich domain types are reused from `@termcoder/core` via `import type` (no duplication, no runtime coupling); only the thin HTTP request/response envelopes are defined in the SDK.

## Goals

- One typed entry point: `createClient({ baseUrl, token?, fetch?, WebSocket? }) → TermClient`.
- Cover the core surface: `status()`, `models()`, `config()`; `sessions.{create,list,get,delete,deleteAll,setModel,setSettings,setTitle}`; `sessions.stream(id)` returning a `SessionStream` (async-iterable of typed events + `prompt/background/stop/respondPermission/close`).
- Transport-injectable and universal: works in Node (VSCode extension host) and the browser (Electron renderer). Defaults to `globalThis.fetch`/`globalThis.WebSocket`; a consumer can inject `ws` in Node.
- Testable: unit tests via an injected fake transport; an integration/contract test that drives a real in-process `createServer()` end-to-end (validating SDK types against real server responses).

## Non-goals (v1)

- The VSCode extension itself (next slice) and migrating the desktop's raw `fetch`/`WebSocket` calls to the SDK (a later follow-up).
- Non-core routes: study, classroom, live-rooms/WebRTC signaling, recipes, skills, memory, agents CRUD, providers/auth, MCP, transcribe, license.
- Codegen / OpenAPI. npm publishing / third-party packaging (SDK stays internal, `"private": true`, `workspace:*`).

## Existing context (verified against the live server)

Server routes and shapes the SDK wraps (from `packages/server/src/server.ts`):

- `POST /sessions` body `{ cwd?, title?, mode?: "plan"|"build", agent?, temperature?, maxSteps? }` → `201 SessionRecord`.
- `GET /sessions` → `200 SessionSummary[]` (`ctx.store.list()`).
- `GET /sessions/:id` → `200 SessionRecord` | `404 { error }`.
- `DELETE /sessions/:id` → `200 { id }` | `404 { error }`.
- `DELETE /sessions` → `200 { removed: number }`.
- `POST /sessions/:id/model` body `{ model }` → `200 { model }` | `404`.
- `POST /sessions/:id/settings` body `{ mode?, agent?, temperature?, maxSteps? }` → `200 { mode, agent, temperature, maxSteps }` | `404`.
- `POST /sessions/:id/title` body `{ title }` → `200 { title }` | `404`.
- `GET /status` → `200 { model: string, providers: Array<{ name: string; configured: boolean }>, mcp, lsp, plugins }` (`{ model, providers } & ServerStatus`).
- `GET /models` → `200` model-catalog entries, each with an added `configured: boolean`.
- `GET /config` → `200 redactConfig(config)`.

Types (all exported from `@termcoder/core` unless noted):
- `SessionRecord` (`packages/core/src/storage/storage.ts`): `{ id, title, createdAt, updatedAt, cwd, model, mode?, agent?, temperature?, maxSteps?, messages: ModelMessage[], usage?: { tokensIn, tokensOut } }`.
- `SessionSummary`: `SessionRecord` minus `messages` (same head fields).
- `SessionEvent` (`packages/core/src/session/session.ts`): union `text-delta | reasoning-delta | reasoning-end | tool-call | tool-result | usage | subagent-start | subagent-end | done | error`, each `& { sourceId? }`.
- `ServerStatus` (`packages/server/src/server.ts:102`, exported): `{ mcp, lsp, plugins }`.

WebSocket protocol (`handleSocket`, `packages/server/src/server.ts:1209`):
- Connect: `ws://<host>/sessions/:id/stream?name=<label>`.
- On connect the server sends `{ type: "room-welcome", you, peerId, participants, peers, joinToken }`, then presence.
- Client (driver) → server messages (verified at `server.ts:1275-1299`): `{ type: "prompt", text, images? }`, `{ type: "background", goal }`, `{ type: "stop" }`, `{ type: "permission-decision", id, decision }`, plus room-only `chat`/`signal` (out of scope).
- Server → client frames the SDK maps: the driver's `{ type: "room-prompt", from, text }` echo; the streamed `SessionEvent`s (broadcast as `{ type: <event.type>, ... }`); `{ type: "permission-request", id, request }`; `{ type: "stopped" }`; `{ type: "error", error }`; `{ type: "room-locked", error }`. Ignored in v1: `room-welcome`, presence/peers, `room-chat`, `signal`, `peer-left`, and the `background-*` control frames (the autonomous run's underlying `SessionEvent`s still flow through as `event`). Note the `type: "error"` collision — a `SessionEvent` of type `"error"` and a control `{ type: "error", error }` are both mapped to `{ kind: "error" }`, which is acceptable (both are errors surfaced to the consumer).

## Architecture

New package `packages/sdk` → `@termcoder/sdk`, `"private": true`, one `workspace:*` dep on `@termcoder/core` (type-only imports) and a `ws` devDependency (integration test only). Files, each one responsibility:

- `src/types.ts` — HTTP envelopes (request bodies + non-record responses) and re-exports of the core domain types the SDK surfaces:
  ```ts
  import type { SessionRecord, SessionSummary, SessionEvent, ModelEntry } from "@termcoder/core";
  export type { SessionRecord, SessionSummary, SessionEvent, ModelEntry };

  export interface CreateSessionInput { cwd?: string; title?: string; mode?: "plan" | "build"; agent?: string; temperature?: number; maxSteps?: number; }
  export interface SessionSettingsInput { mode?: "plan" | "build"; agent?: string; temperature?: number; maxSteps?: number; }
  export type ModelInfo = ModelEntry & { configured: boolean };
  export interface StatusResponse { model: string; providers: Array<{ name: string; configured: boolean }>; mcp: unknown[]; lsp: unknown[]; plugins: unknown[]; }
  export type PermissionDecision = "allow" | "allow-always" | "deny";

  export type StreamEvent =
    | { kind: "event"; event: SessionEvent }
    | { kind: "prompt"; from: string; text: string }
    | { kind: "permission"; id: string; request: unknown }
    | { kind: "stopped" }
    | { kind: "error"; error: string };
  ```
  Domain types (`SessionRecord`, `SessionSummary`, `SessionEvent`, `ModelEntry`) are imported type-only from `@termcoder/core` (all verified exported); `ModelInfo` is core's `ModelEntry` plus the server-added `configured`. `StatusResponse` is defined inline (its `mcp`/`lsp`/`plugins` arrays are typed loosely as `unknown[]` — v1 consumers use `model`/`providers`), so the SDK needs no dependency on `@termcoder/server`.

- `src/http.ts` — `class HttpError extends Error { status: number; body: unknown }` and a typed `request<T>(method, path, { body?, query? }): Promise<T>` bound to `{ baseUrl, token?, fetch }`. Non-2xx throws `HttpError` (parses a `{ error }` body when present). `Authorization: Bearer <token>` set when `token` is given.

- `src/stream.ts` — `openStream({ baseUrl, WebSocket, sessionId, name? }): SessionStream`. Opens the WS, discards `room-welcome`/presence, and exposes:
  ```ts
  interface SessionStream extends AsyncIterable<StreamEvent> {
    prompt(text: string, opts?: { images?: Array<{ dataUrl: string; mediaType: string }> }): void;
    background(goal: string): void;
    stop(): void;
    respondPermission(id: string, decision: PermissionDecision): void;
    close(): void;
  }
  ```
  Incoming frames are JSON-parsed and mapped to `StreamEvent` (a `SessionEvent` `type` → `{ kind: "event", event }`; `room-prompt` → `prompt`; `stopped`/`error`/permission → their kinds). The async iterator is backed by a small queue (mirror `packages/core/src/session/event-queue.ts`'s pattern) that resolves waiting `next()` calls and ends on `close()`/socket close. `close()` closes the socket and terminates the iterator.

- `src/sessions.ts` — `SessionsResource` bound to `http` + `{ baseUrl, WebSocket }`: `create`, `list`, `get`, `delete`, `deleteAll`, `setModel`, `setSettings`, `setTitle`, and `stream(id, opts?) → SessionStream`.

- `src/client.ts` — `createClient(config): TermClient`:
  ```ts
  interface ClientConfig { baseUrl: string; token?: string; fetch?: typeof fetch; WebSocket?: typeof WebSocket; }
  interface TermClient { status(): Promise<StatusResponse>; models(): Promise<ModelInfo[]>; config(): Promise<unknown>; sessions: SessionsResource; }
  ```
  Resolves `fetch`/`WebSocket` from config or `globalThis`; throws a clear error if `WebSocket` is needed (a `stream()` call) but neither provided nor global.

- `src/index.ts` — public exports: `createClient`, all types, `HttpError`.

Build/typecheck mirrors the other packages (tsup or tsc per repo convention; `typecheck` script; vitest picks up `packages/sdk/src/**/*.test.ts` via the root config's existing `packages/*/src/**` glob).

## Data flow

```
createClient({ baseUrl }) resolves fetch/WebSocket (config or global)
  client.status()/models()/config()  -> http.request GET -> typed JSON
  client.sessions.create(input)      -> http POST /sessions -> SessionRecord
  client.sessions.stream(id)         -> openStream: WS /sessions/:id/stream
      .prompt(text)                  -> ws.send {type:"prompt",text}
      for await (const ev of stream) -> {kind:"event", event: SessionEvent} | prompt | permission | stopped | error
      .respondPermission(id, "allow")-> ws.send {type:"permission-decision",id,decision}
      .stop()/.close()               -> ws.send {type:"stop"} / socket close + iterator end
```

## Error handling

- HTTP non-2xx → `HttpError` with `status` and parsed `body` (`{ error }` message surfaced as `.message`). `404` on session routes is a normal `HttpError(404)` the caller can catch.
- Stream: a server `{ type: "error", error }` frame yields `{ kind: "error", error }` (the iterator continues; the server closes the socket on fatal errors, which ends the iterator). Socket close ends the iterator cleanly. `stop()` yields a `{ kind: "stopped" }` when the server acks.
- `stream()` without an available `WebSocket` throws synchronously with a message telling Node consumers to inject `ws`.
- Malformed JSON frames are dropped (logged to `console.warn`), never crash the iterator.

## Testing (vitest, node env)

- `http.test.ts` — inject a fake `fetch`; assert method/path/query/body/headers and that non-2xx throws `HttpError` with status+body. No comments in source (repo rule); tests use descriptive names.
- `stream.test.ts` — inject a fake `WebSocket` (an `EventEmitter`-backed stub with `send`/`close`); push frames and assert the async iterator yields the mapped `StreamEvent`s in order, that `prompt/stop/respondPermission` send the right JSON, and that socket close ends the iterator.
- `client.integration.test.ts` — **contract test**: start a real `createServer({ config, store, registry, runner: scriptedRunner, cwd, ... })` in-process (same pattern as `packages/server/src/server.test.ts`, incl. `store.close()` teardown), `server.listen(0)`, point `createClient` at it with Node's `ws` injected, then: `create` a session, open `stream`, `prompt("hi")`, collect events, assert typed `text-delta`/`done` arrive and that `status()`/`models()`/`list()` return the real shapes. This proves the SDK types match real responses.

## File layout

```
packages/sdk/package.json           ("@termcoder/sdk", private, workspace dep on core type-only, ws devDep for the integration test)
packages/sdk/tsconfig.json          (extends the repo base; noUncheckedIndexedAccess on)
packages/sdk/src/types.ts           (envelopes + re-exported core/server types)
packages/sdk/src/http.ts            (request<T>, HttpError)
packages/sdk/src/stream.ts          (openStream, SessionStream, queue-backed iterator)
packages/sdk/src/sessions.ts        (SessionsResource)
packages/sdk/src/client.ts          (createClient, TermClient)
packages/sdk/src/index.ts           (public exports)
packages/sdk/src/*.test.ts          (http, stream, client integration)
```

## Rollout

Single implementation plan, TDD. Additive: a new package, no change to `@termcoder/core`/`@termcoder/server` runtime (type-only imports). Source carries NO comments (repo rule). Next Tier-2 slice after this: the VSCode extension consuming `@termcoder/sdk`; a later follow-up migrates the desktop's raw `fetch`/`WebSocket` calls onto it.
