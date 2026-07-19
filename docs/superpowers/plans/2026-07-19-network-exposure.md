# Close the LAN Server Hole — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the embedded server localhost-only by default, exposing a hardened room-only listener on the LAN solely while a Live Room is being hosted.

**Architecture:** Two listeners sharing one `ctx`. The API listener binds `127.0.0.1` (owner-only, full API). A second listener binds `0.0.0.0`, is created lazily when the host opens a room (`GET /room/addresses`), and serves only static web files + the room WebSocket gated by a valid room token; every other route is `404`. Because the owner API is never on the LAN, the host-impersonation chain is removed by construction rather than authenticated around.

**Tech Stack:** Node `http` + `ws`, TypeScript, Vitest. Desktop is Electron; renderer is browser-safe.

## Global Constraints

- **No code comments.** Do not add comments to any code you write. (Repo-wide rule.)
- **Preserve CRLF line endings.** Every file under `packages/server` and `packages/desktop` uses `\r\n`. The Edit tool preserves them when you match exact existing text — do not normalize to LF.
- **Do not touch the renderer for port wiring.** The guest derives its origin from `Number(location.port)` and `location.hostname` (`App.tsx:85-87`); `useRoom` funnels `/room/addresses`'s `port` into the invite. The whole port swap is server-side.
- **Preserve the room observer machinery.** `ctx.roomTokens`, `isGuest`, the guest `chat`/`signal` allowlist (`server.ts:1199`), and the phantom-room reject (`server.ts:1150`) must remain intact.
- Run commands from the worktree root: `C:\Users\Purple\Downloads\Open Source\.claude\worktrees\net-security`.
- Server test command: `npm run -w @termcoder/server test`. Typecheck: `npm run -w @termcoder/server typecheck`.

---

### Task 1: API listener binds localhost (with a `HOST` opt-in for the CLI)

Bind the always-on API server to loopback. Add a tiny testable helper so the CLI keeps an explicit LAN escape hatch (`HOST=0.0.0.0`) while the desktop is hardcoded to loopback.

**Files:**
- Create: `packages/server/src/host.ts`
- Test: `packages/server/src/host.test.ts`
- Modify: `packages/server/src/serve.ts` (the `server.listen` call)
- Modify: `packages/desktop/src/main/index.ts` (the `server.listen(0, resolve)` call)

**Interfaces:**
- Produces: `apiHost(env?: NodeJS.ProcessEnv): string` — returns `env.HOST` when set and non-empty, else `"127.0.0.1"`.

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/host.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { apiHost } from "./host";

describe("apiHost", () => {
  it("defaults to loopback", () => {
    expect(apiHost({})).toBe("127.0.0.1");
  });

  it("honors an explicit HOST override", () => {
    expect(apiHost({ HOST: "0.0.0.0" })).toBe("0.0.0.0");
  });

  it("treats an empty HOST as unset", () => {
    expect(apiHost({ HOST: "" })).toBe("127.0.0.1");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm run -w @termcoder/server test -- host`
Expected: FAIL — `Cannot find module './host'`.

- [ ] **Step 3: Write the helper**

Create `packages/server/src/host.ts`:

```ts
export function apiHost(env: NodeJS.ProcessEnv = process.env): string {
  return env.HOST && env.HOST.trim() ? env.HOST.trim() : "127.0.0.1";
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm run -w @termcoder/server test -- host`
Expected: PASS (3 tests).

- [ ] **Step 5: Bind the CLI server to `apiHost()`**

In `packages/server/src/serve.ts`, add the import next to the existing `createServer` import (line 11):

```ts
import { apiHost } from "./host";
```

Change the listen call (currently `server.listen(port, () => {`) to pass the host:

```ts
  server.listen(port, apiHost(), () => {
```

Leave the callback body unchanged. `listen(port, host, callback)` is the correct signature.

- [ ] **Step 6: Bind the desktop server to loopback**

In `packages/desktop/src/main/index.ts`, change line 71 from:

```ts
  await new Promise<void>((resolve) => server.listen(0, resolve));
```

to:

```ts
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
```

The desktop is hardcoded to loopback (no `HOST` escape hatch): its embedded server is private, and rooms use the dedicated LAN listener from Task 2.

- [ ] **Step 7: Typecheck**

Run: `npm run -w @termcoder/server typecheck`
Expected: no errors. (The desktop package is typechecked in Task 3's full sweep.)

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/host.ts packages/server/src/host.test.ts packages/server/src/serve.ts packages/desktop/src/main/index.ts
git commit -m "feat(server): bind the API listener to localhost by default"
```

---

### Task 2: Room-only LAN listener

Add the second listener. It shares `ctx`, binds `0.0.0.0` on an OS-assigned port, opens lazily on the first `GET /room/addresses`, and enforces a hard allowlist: static GET/HEAD + the room WS gated by a valid room token. It closes when the API server closes.

**Files:**
- Modify: `packages/server/src/server.ts` (Ctx type, `handleHttp`, `handleSocket`, `createServer`, `/room/addresses` handler; add `ensureRoomListener`)
- Test: `packages/server/src/server.test.ts` (extend)

**Interfaces:**
- Consumes: `handleHttp(req, res, ctx)`, `handleSocket(ws, req, ctx)`, `sendJson`, `serveStatic`, `lanAddresses`, `createHttpServer`, `WebSocketServer` — all already in `server.ts`.
- Produces (module-internal): `ensureRoomListener(ctx: Ctx): Promise<number>` — idempotently opens the LAN listener and returns its port. New `Ctx` fields `roomListener` and `roomListenerPending`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/server/src/server.test.ts`, inside the same top-level `describe` block that owns `base()` / `port` / `dir`, a nested block. It boots a room via a host WS on the API port to mint a token, opens the LAN listener via `/room/addresses`, then asserts the LAN listener's posture:

```ts
  describe("room-only LAN listener", () => {
    async function openLan(): Promise<number> {
      const res = await fetch(`${base()}/room/addresses`);
      const body = (await res.json()) as { port: number };
      return body.port;
    }

    async function mintToken(): Promise<string> {
      const record = (await (
        await fetch(`${base()}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cwd: dir }),
        })
      ).json()) as { id: string };
      const host = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Host`);
      const token = await new Promise<string>((resolve, reject) => {
        host.on("message", (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "room-welcome") resolve(String(msg.joinToken));
        });
        host.on("error", reject);
      });
      host.close();
      return token;
    }

    it("opens on a port distinct from the API listener", async () => {
      const lanPort = await openLan();
      expect(lanPort).toBeGreaterThan(0);
      expect(lanPort).not.toBe(port);
    });

    it("serves the static app but 404s the owner API", async () => {
      const lanPort = await openLan();
      expect((await fetch(`http://localhost:${lanPort}/`)).status).toBe(200);
      expect((await fetch(`http://localhost:${lanPort}/sessions`)).status).toBe(404);
      expect((await fetch(`http://localhost:${lanPort}/memory`)).status).toBe(404);
      expect(
        (await fetch(`http://localhost:${lanPort}/sessions`, { method: "DELETE" })).status,
      ).toBe(404);
    });

    it("rejects a WS opened with a real session id, accepts a valid room token", async () => {
      const lanPort = await openLan();
      const record = (await (
        await fetch(`${base()}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cwd: dir }),
        })
      ).json()) as { id: string };

      const impostor = new WebSocket(`ws://localhost:${lanPort}/sessions/${record.id}/stream?name=Mallory`);
      const rejected = await new Promise<boolean>((resolve) => {
        impostor.on("close", (code) => resolve(code === 1008));
        impostor.on("open", () => impostor.send("{}"));
      });
      expect(rejected).toBe(true);

      const token = await mintToken();
      const guest = new WebSocket(`ws://localhost:${lanPort}/sessions/${token}/stream?name=Guest`);
      const welcomed = await new Promise<boolean>((resolve, reject) => {
        guest.on("message", (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "room-welcome") resolve(true);
        });
        guest.on("close", () => resolve(false));
        guest.on("error", reject);
      });
      expect(welcomed).toBe(true);
      guest.close();
    });
  });
```

Also update the existing `"reports LAN addresses for sharing a room"` test (around line 365) so its type annotation matches the new numeric port and asserts the port is real:

```ts
  it("reports LAN addresses for sharing a room", async () => {
    const res = await fetch(`${base()}/room/addresses`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { addresses: string[]; port: number };
    expect(Array.isArray(body.addresses)).toBe(true);
    expect(body.port).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npm run -w @termcoder/server test -- server`
Expected: the new block FAILS — the LAN port equals the API port / `/sessions` returns 200 on it / the impostor WS is accepted — because the room-only listener does not exist yet.

- [ ] **Step 3: Add the `Ctx` fields**

In `packages/server/src/server.ts`, replace the last line of the `Ctx` interface (line 142, `  license: () => LicenseInfo;`) with:

```ts
  license: () => LicenseInfo;
  roomListener?: { server: Server; wss: WebSocketServer; port: number } | null;
  roomListenerPending?: Promise<number> | null;
```

- [ ] **Step 4: Add the `lanOnly` guard to `handleHttp`**

Change the signature (line 321) and insert the guard right after `parts` is computed (after line 327). The result:

```ts
async function handleHttp(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: Ctx,
  lanOnly = false,
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return void res.end();
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);

  if (lanOnly) {
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      ctx.webDir &&
      serveStatic(res, ctx.webDir, url.pathname)
    ) {
      return;
    }
    return sendJson(res, 404, { error: "not found" });
  }
```

Everything below (the existing route matching) is unchanged and runs only when `lanOnly` is false.

- [ ] **Step 5: Add the `lanOnly` guard to `handleSocket`**

Change the signature (line 1141) and reject non-room-token connections before the existing store check. The current lines are:

```ts
function handleSocket(ws: WebSocket, req: IncomingMessage, ctx: Ctx): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 3 || parts[0] !== "sessions" || parts[2] !== "stream") {
    ws.close(1008, "expected /sessions/:id/stream");
    return;
  }
  const sessionId = parts[1]!;
  const resolvedSessionId = ctx.roomTokens.get(sessionId) ?? sessionId;
```

Change to:

```ts
function handleSocket(ws: WebSocket, req: IncomingMessage, ctx: Ctx, lanOnly = false): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 3 || parts[0] !== "sessions" || parts[2] !== "stream") {
    ws.close(1008, "expected /sessions/:id/stream");
    return;
  }
  const sessionId = parts[1]!;
  if (lanOnly && !ctx.roomTokens.has(sessionId)) {
    ws.close(1008, "room token required");
    return;
  }
  const resolvedSessionId = ctx.roomTokens.get(sessionId) ?? sessionId;
```

On the LAN listener only a valid room token passes, so `isGuest` (line 1156) is always true there — the observer allowlist already applies.

- [ ] **Step 6: Add `ensureRoomListener` and wire the close hook**

In `createServer` (lines 159-166), after `wss` is created and before `return http;`, attach the close hook so the LAN listener dies with the API server (this also keeps tests from leaking listeners across cases):

```ts
  const wss = new WebSocketServer({ server: http });
  wss.on("connection", (ws, req) => handleSocket(ws, req, ctx));

  http.on("close", () => {
    ctx.roomListener?.wss.close();
    ctx.roomListener?.server.close();
    ctx.roomListener = null;
    ctx.roomListenerPending = null;
  });

  return http;
```

Then add `ensureRoomListener` as a new module-level function, placed directly after `createServer` closes (before the `CORS` const at line 169):

```ts
function ensureRoomListener(ctx: Ctx): Promise<number> {
  if (ctx.roomListener) return Promise.resolve(ctx.roomListener.port);
  if (ctx.roomListenerPending) return ctx.roomListenerPending;
  ctx.roomListenerPending = new Promise<number>((resolve) => {
    const server = createHttpServer((req, res) => {
      handleHttp(req, res, ctx, true).catch((err) => sendJson(res, 500, { error: String(err) }));
    });
    const wss = new WebSocketServer({ server });
    wss.on("connection", (ws, req) => handleSocket(ws, req, ctx, true));
    server.listen(0, "0.0.0.0", () => {
      const addr = server.address();
      const p = typeof addr === "object" && addr ? addr.port : 0;
      ctx.roomListener = { server, wss, port: p };
      ctx.roomListenerPending = null;
      resolve(p);
    });
  });
  return ctx.roomListenerPending;
}
```

- [ ] **Step 7: Rewrite the `/room/addresses` handler to open the LAN listener**

Replace the current handler (lines 722-726):

```ts
  if (req.method === "GET" && parts.length === 2 && parts[0] === "room" && parts[1] === "addresses") {
    const host = typeof req.headers.host === "string" ? req.headers.host : "";
    const port = host.includes(":") ? host.split(":").pop() ?? "" : "";
    return sendJson(res, 200, { addresses: lanAddresses(), port, rooms: ctx.rooms.size });
  }
```

with:

```ts
  if (req.method === "GET" && parts.length === 2 && parts[0] === "room" && parts[1] === "addresses") {
    const roomPort = await ensureRoomListener(ctx);
    return sendJson(res, 200, { addresses: lanAddresses(), port: roomPort, rooms: ctx.rooms.size });
  }
```

- [ ] **Step 8: Run the tests, verify they pass**

Run: `npm run -w @termcoder/server test -- server`
Expected: the new `room-only LAN listener` block PASSES; the updated LAN-addresses test PASSES; all previously-passing tests still PASS.

- [ ] **Step 9: Typecheck**

Run: `npm run -w @termcoder/server typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add packages/server/src/server.ts packages/server/src/server.test.ts
git commit -m "feat(server): room-only LAN listener; owner API stays on localhost"
```

---

### Task 3: Full verification sweep

No new behavior — prove the change is green end to end and record the manual gate.

**Files:**
- None (verification only). If the desktop typecheck surfaces a break from the `main/index.ts` edit, fix it here.

- [ ] **Step 1: Full server suite**

Run: `npm run -w @termcoder/server test`
Expected: entire server suite green (previous count + the new cases).

- [ ] **Step 2: Server + desktop typecheck**

Run: `npm run -w @termcoder/server typecheck` then `npm run -w @termcoder/desktop typecheck`
Expected: no errors in either.

- [ ] **Step 3: Desktop web build (the artifact the room listener serves)**

Run: `npm run -w @termcoder/desktop build:web`
Expected: `packages/desktop/dist-web` builds without error.

- [ ] **Step 4: Record the manual gate**

The following require two machines and cannot be automated here. Note them for the user in the handoff; do not attempt them:
- Default posture: with no room open, from a second machine on the same LAN, `http://<host-lan-ip>:<apiPort>/sessions` must be unreachable (connection refused), confirming loopback binding.
- Room posture: open a Live Room on the host; the invite URL uses the new LAN port; a guest browser on the second machine loads the app and joins as an observer (can watch + chat, cannot prompt/approve/stop); `http://<host-lan-ip>:<lanPort>/sessions` returns 404.
- Teardown: after quitting the app, the LAN port is no longer listening.

- [ ] **Step 5: Commit (only if a fix was needed in Step 2; otherwise skip)**

```bash
git add -A
git commit -m "fix(desktop): typecheck after localhost binding"
```

---

## Self-Review

**Spec coverage:**
- Localhost default (both entrypoints) → Task 1.
- Room-only LAN listener, static + room-token WS, everything else 404 → Task 2 (Steps 4-7).
- Host-impersonation eliminated (raw session id rejected on LAN) → Task 2 Step 5 + test Step 1.
- Guest stays observer / phantom-room reject preserved → guards inserted before existing logic; unchanged paths.
- Invite uses the room port → server-side via `/room/addresses`; renderer untouched (Global Constraints).
- Listener lifecycle (open on `/room/addresses`, close with API server) → Task 2 Steps 6-7.
- CLI `HOST` opt-in (LAN opt-in for headless use) → Task 1.
- Out-of-scope owner-token / TLS → not built, matches spec.

**Placeholder scan:** No TBD/TODO; every code step shows complete code.

**Type consistency:** `apiHost(env?)` used consistently; `ensureRoomListener(ctx): Promise<number>` awaited in the handler; `Ctx.roomListener` shape matches its construction in `ensureRoomListener` and teardown in the close hook (`.wss.close()`, `.server.close()`, `.port`). `/room/addresses` now returns numeric `port`; the existing test's type annotation updated to match.

**Lifecycle note (accepted simplification, from the spec):** the LAN listener opens on the first `/room/addresses` and closes when the API server closes (app quit), not on Live-Room-panel close. The security property holds regardless of close timing because the owner API is never on the LAN; tightening to close-on-panel-exit is a logged follow-on.
