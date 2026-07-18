# Live Rooms Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the desktop live-room as a real call UI, stop the invite from leaking the session id, and diagnose+fix whatever breaks a real A/V call.

**Architecture:** The WebRTC engine (`CallManager`) and the server signaling relay are structurally complete and reused. The server gains a rotatable room join token so the invite carries `?room=<token>` instead of the session id; the desktop UI is split into a `useRoom` controller (owns the CallManager + socket) and a presentational `RoomView`; the A/V is fixed by running it, since perfect negotiation is already implemented so glare is not the bug.

**Tech Stack:** TypeScript, Node HTTP + `ws` (server), Electron + React (desktop renderer), WebRTC (`RTCPeerConnection`, STUN), vitest.

**Spec:** `docs/superpowers/specs/2026-07-17-rooms-refactor-design.md`

## Global Constraints

- **Code carries no comments.** Hard repo rule, stated twice by the user, emphatically. Explanations go in commit messages. (Pre-existing comments in files you touch may stay.)
- **The invite link must never carry the session id.** It carries a room join token only. The session id stays private to the host.
- **Do not rewrite `CallManager` or the signaling relay.** They are reused; perfect negotiation (`webrtc.ts:165`, `polite = myId > from`) already handles offer glare — do not "fix" it.
- **Do not regress the Pro gate.** An unlicensed host still gets one free guest; the third participant is blocked (`server.ts:1150`, `sockets.size >= 2`). Keep that behaviour and its test.
- **Honest security boundary:** over http on the LAN the token still crosses the wire in plaintext. This plan removes the session-id leak and makes the room credential rotatable — TLS/auth on the LAN server is the separate deferred security block, OUT of scope.
- Tests run with vitest from the WORKTREE ROOT: `npx vitest run`.
- The desktop is Electron; a live A/V call between two machines is the **user's manual gate** — it cannot be automated here.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/server/src/rooms/token.ts` (new) | mint / validate a room join token (pure) |
| `packages/server/src/server.ts` | store the token on the Room; resolve `?room=<token>`/`/sessions/<token>/stream` to the session; keep the relay + gate |
| `packages/desktop/src/renderer/room/invite.ts` (new) | build invite links from LAN addresses + room token (pure) |
| `packages/desktop/src/renderer/room/useRoom.ts` (new) | owns the `CallManager` + signaling socket; exposes call state + actions |
| `packages/desktop/src/renderer/room/RoomView.tsx` (new) | the presentational call UI |
| `packages/desktop/src/renderer/App.tsx` | mount `RoomView`/`useRoom` in place of the modal `RoomPanel`; pass the room token through |
| `packages/desktop/src/renderer/RoomPanel.tsx` | deleted once RoomView replaces it |

---

### Task 1: Room join token in the server

**Files:**
- Create: `packages/server/src/rooms/token.ts`
- Test: `packages/server/src/rooms/token.test.ts`
- Modify: `packages/server/src/server.ts` (the `Room` interface ~`:118`, `getRoom` ~`:1040-1073`, the WS upgrade/join path that reads the session id from the URL, and the room-welcome payload ~`:1164`)

**Interfaces:**
- Produces: `mintRoomToken(): string` (base64url, ≥16 random bytes, URL-safe, no `=`); `roomTokenPattern: RegExp` matching a valid token shape. Server-side: `ctx.roomTokens: Map<string, string>` (token → sessionId); a room's record carries `joinToken: string`; the WS join resolves a path segment that is a room token to its session id before `getRoom`.

- [ ] **Step 1: Write the failing test for the pure token helper**

Create `packages/server/src/rooms/token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mintRoomToken, roomTokenPattern } from "./token";

describe("room token", () => {
  it("mints a url-safe token with no padding", () => {
    const t = mintRoomToken();
    expect(t).toMatch(roomTokenPattern);
    expect(t).not.toContain("=");
    expect(t).not.toContain("+");
    expect(t).not.toContain("/");
    expect(t.length).toBeGreaterThanOrEqual(22);
  });

  it("mints a different token each call", () => {
    const seen = new Set(Array.from({ length: 50 }, () => mintRoomToken()));
    expect(seen.size).toBe(50);
  });

  it("the pattern rejects a session-id-shaped uuid and empty input", () => {
    expect(roomTokenPattern.test("6c23f822-b569-42ea-a20d-0a65e4cf3412")).toBe(false);
    expect(roomTokenPattern.test("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/server/src/rooms/token.test.ts`
Expected: FAIL — cannot resolve `./token`.

- [ ] **Step 3: Implement the helper**

Create `packages/server/src/rooms/token.ts`:

```ts
import { randomBytes } from "node:crypto";

export const roomTokenPattern = /^[A-Za-z0-9_-]{22,}$/;

export function mintRoomToken(): string {
  return randomBytes(18).toString("base64url");
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run packages/server/src/rooms/token.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire the token into the Room and the join path**

Read `server.ts` around `interface Room` (~`:118`), `getRoom` (~`:1040`), the WS join that extracts the session id from the URL path (search for where the room stream connection reads `sessionId` from `parts`/the URL, near `getRoom(ctx, sessionId)` ~`:1149`), and `ctx` construction (~`:150`).

Add to `Ctx` and its construction: `roomTokens: Map<string, string>` (token → sessionId), initialised `new Map()`.

Add `joinToken: string` to `interface Room`. In `getRoom`, when a room is created (the block that builds the room object ~`:1046` and does `ctx.rooms.set(sessionId, room)` ~`:1073`), mint a token and register it:

```ts
    joinToken: (() => {
      const token = mintRoomToken();
      return token;
    })(),
```

Immediately after `ctx.rooms.set(sessionId, room)`, add `ctx.roomTokens.set(room.joinToken, sessionId);`.

At the top of the WS room-join handler — BEFORE `const room = getRoom(ctx, sessionId)` — resolve a token to a session id, so a guest connecting with a token in the id position joins the existing room rather than creating a new one keyed by the token:

```ts
    const resolvedSessionId = ctx.roomTokens.get(sessionId) ?? sessionId;
```

Then use `resolvedSessionId` everywhere the handler currently uses `sessionId` for the room (the `getRoom` call and any room keying). Do NOT change how the host connects (it uses the real session id, which is not in `roomTokens`, so `?? sessionId` leaves it unchanged).

Include the `joinToken` in the `room-welcome` payload (~`:1164`) so the host UI can build the invite:

```ts
      ws.send(JSON.stringify({ type: "room-welcome", ..., joinToken: room.joinToken }));
```

Import `mintRoomToken` at the top of `server.ts`.

- [ ] **Step 6: Write a server test for token-based join**

Add to `packages/server/src/server.test.ts` (reuse its existing room test scaffolding — the WebSocket + `room-welcome` pattern already there around the licensed/unlicensed room tests):

```ts
  it("lets a guest join by room token without knowing the session id", async () => {
    const record = (await (
      await fetch(`${base()}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cwd: dir }) })
    ).json()) as { id: string };

    const ws1 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Host`);
    const welcome = await new Promise<Record<string, unknown>>((r) =>
      ws1.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.type === "room-welcome") r(m); }));
    const token = welcome.joinToken as string;
    expect(token).toBeTruthy();
    expect(token).not.toBe(record.id);

    const ws2 = new WebSocket(`ws://localhost:${port}/sessions/${token}/stream?name=Guest`);
    const type = await new Promise<string>((r) => ws2.on("message", (raw) => r(JSON.parse(raw.toString()).type as string)));
    ws1.close();
    ws2.close();
    expect(type).toBe("room-welcome");
  });

  it("a bogus room token creates its own empty room, never joins another", async () => {
    const record = (await (
      await fetch(`${base()}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cwd: dir }) })
    ).json()) as { id: string };
    const ws1 = new WebSocket(`ws://localhost:${port}/sessions/${record.id}/stream?name=Host`);
    await new Promise<void>((r) => ws1.on("message", (raw) => { if (JSON.parse(raw.toString()).type === "room-welcome") r(); }));
    const ws2 = new WebSocket(`ws://localhost:${port}/sessions/deadbeefdeadbeefdeadbeef01/stream?name=Nobody`);
    const w2 = await new Promise<Record<string, unknown>>((r) => ws2.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.type === "room-welcome") r(m); }));
    ws1.close();
    ws2.close();
    expect(w2.participants).toEqual(["Nobody"]);
  });
```

- [ ] **Step 7: Run the server tests, then the full suite**

Run: `npx vitest run packages/server/src/server.test.ts` then `npx vitest run`
Report the real count. Confirm the existing Pro-gate room tests still pass (no regression).

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/rooms/token.ts packages/server/src/rooms/token.test.ts packages/server/src/server.ts packages/server/src/server.test.ts
git commit -m "feat(server): rotatable room join token, so a guest joins without the session id"
```

---

### Task 2: Build the invite link from the room token

**Files:**
- Create: `packages/desktop/src/renderer/room/invite.ts`
- Test: `packages/desktop/src/renderer/room/invite.test.ts`

**Interfaces:**
- Produces: `inviteLinks(opts: { addresses: string[]; port: number; joinToken: string; secure?: boolean }): string[]` — one URL per address, `http(s)://<addr>:<port>?room=<token>`. Never emits `?session=`.

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/src/renderer/room/invite.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { inviteLinks } from "./invite";

describe("inviteLinks", () => {
  it("builds one ?room= link per address, never ?session=", () => {
    const links = inviteLinks({ addresses: ["192.168.0.103", "172.26.64.1"], port: 55934, joinToken: "abc-DEF_123" });
    expect(links).toEqual([
      "http://192.168.0.103:55934?room=abc-DEF_123",
      "http://172.26.64.1:55934?room=abc-DEF_123",
    ]);
    for (const l of links) expect(l).not.toContain("session=");
  });

  it("uses https when secure", () => {
    expect(inviteLinks({ addresses: ["h"], port: 1, joinToken: "t", secure: true })[0]).toBe("https://h:1?room=t");
  });

  it("returns nothing with no addresses or no token", () => {
    expect(inviteLinks({ addresses: [], port: 1, joinToken: "t" })).toEqual([]);
    expect(inviteLinks({ addresses: ["h"], port: 1, joinToken: "" })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/desktop/src/renderer/room/invite.test.ts`
Expected: FAIL — cannot resolve `./invite`.

- [ ] **Step 3: Implement**

Create `packages/desktop/src/renderer/room/invite.ts`:

```ts
export function inviteLinks(opts: { addresses: string[]; port: number; joinToken: string; secure?: boolean }): string[] {
  if (!opts.joinToken) return [];
  const scheme = opts.secure ? "https" : "http";
  return opts.addresses.map((a) => `${scheme}://${a}:${opts.port}?room=${encodeURIComponent(opts.joinToken)}`);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run packages/desktop/src/renderer/room/invite.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/room/invite.ts packages/desktop/src/renderer/room/invite.test.ts
git commit -m "feat(desktop): build room invite links from the join token, not the session id"
```

---

### Task 3: The call UI — useRoom + RoomView replacing the modal

**Files:**
- Create: `packages/desktop/src/renderer/room/useRoom.ts`
- Create: `packages/desktop/src/renderer/room/RoomView.tsx`
- Modify: `packages/desktop/src/renderer/App.tsx` (where `RoomPanel` is imported ~`:15-20` and rendered; the room state at `:406-410`; the `call()` factory at `:852`; the `?session=` invite building at `RoomPanel.tsx:73` moves here)
- Delete: `packages/desktop/src/renderer/RoomPanel.tsx`
- Test: `packages/desktop/src/renderer/room/RoomView.test.tsx`

**Interfaces:**
- Consumes: `inviteLinks` (Task 2); `CallManager` from `../webrtc`; the room `joinToken` from the `room-welcome` message (Task 1).
- Produces: `useRoom(...)` returning `{ participants, chat, self, links, call: { muted, cameraOn, sharing, remotes }, actions: { toggleMute, toggleCamera, toggleScreen, leave, sendChat } }`; `<RoomView>` rendering that state. `App.tsx` mounts `<RoomView>` when `roomOpen`.

Note: this task is UI-heavy and mostly not unit-testable (Ink/Electron DOM + WebRTC). Keep `useRoom` as the logic seam and `RoomView` presentational so the ONE testable thing — that the view renders the four states from given props without touching WebRTC — can be a component test. The live A/V behaviour is Task 4's running gate.

- [ ] **Step 1: Write a presentational-state test for RoomView**

Follow the desktop's existing component test setup (check `packages/desktop` for how it renders React components in tests — if there is a testing-library setup, use it; if not, keep RoomView a pure function of props and assert on the returned element tree with `react-test-renderer`, adding it as a devDep only if the package already uses it — otherwise skip the render test and rely on Task 4's running gate, and SAY SO in the report).

Create `packages/desktop/src/renderer/room/RoomView.test.tsx` asserting:
- alone (no remotes) → the invite/copy affordance is shown and NOT a bare "waiting" limbo;
- with a muted self → the mic control reflects muted;
- with one remote participant → a tile for them renders.

If the package has no component-test harness, replace this step with a typecheck-only assertion and document that RoomView's visuals are verified by Task 4's run.

- [ ] **Step 2: Implement `useRoom`**

Create `packages/desktop/src/renderer/room/useRoom.ts`. It owns the `CallManager` and the room signaling. Model the current wiring in `App.tsx` (the `call()` factory at `:852-855` sends `{ type: "signal", to, data }`; the socket delivers `signal`, `room-presence`, `room-chat`). Move that logic here so `App.tsx` shrinks. Expose the state/actions in the Interfaces block. Read the `joinToken` from the `room-welcome` message and derive `links` via `inviteLinks`. Keep the mute/camera/screen actions delegating to the `CallManager`'s existing methods (read `webrtc.ts` for their exact names — e.g. the mic/camera/screen toggles).

- [ ] **Step 3: Implement `RoomView`**

Create `packages/desktop/src/renderer/room/RoomView.tsx`: a full-height panel, dark/mono theme (reuse the app's existing room CSS classes / theme tokens where they exist rather than inventing new ones). Layout: a stage grid of participant tiles (video element when a remote stream exists, else an initial tile with a speaking ring), a bottom control bar (mic/camera/screen/leave with real on/off states), a presence list, the invite links with copy buttons, a side chat, and the honest empty state. Consume `useRoom`.

- [ ] **Step 4: Swap it into App.tsx and delete RoomPanel**

In `App.tsx`: replace the `RoomPanel` import and its render with `<RoomView>` driven by `useRoom`. Remove the now-dead `?session=` invite building (it lived in `RoomPanel.tsx:73`). Delete `packages/desktop/src/renderer/RoomPanel.tsx`. Ensure no remaining import references it (`grep -rn RoomPanel packages/desktop/src`).

- [ ] **Step 5: Typecheck + build the desktop**

Run: `cd packages/desktop && npx tsc --noEmit` — confirm no NEW errors in the room files (the pre-existing `@termcoder/core`/`@termcoder/server` module-resolution errors in `src/main/index.ts` are unrelated; your new room files must add none). Then `npm run build` (electron-vite) — confirm it builds.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run` — report the count; the invite + token tests pass, nothing regressed.

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/src/renderer/room/ packages/desktop/src/renderer/App.tsx
git rm packages/desktop/src/renderer/RoomPanel.tsx
git commit -m "feat(desktop): rebuild the live room as a real call UI (RoomView + useRoom)"
```

---

### Task 4: Diagnose and fix the A/V by running it

**Files:** whatever the diagnosis implicates — most likely `packages/server/src/serve.ts` (`findWebDir`) and/or `packages/desktop/src/renderer/webrtc.ts` and the room path in `App.tsx`/`useRoom.ts`.

**This is an exploratory run-and-fix task, not a code-first one.** The A/V stack is structurally complete and perfect negotiation is already implemented, so the fix cannot be written blind — it depends on what actually breaks when run. Do NOT invent a fix; diagnose first.

- [ ] **Step 1: Determine what the invite link actually opens.**
Read `packages/server/src/serve.ts`'s `findWebDir()` and establish what directory it serves. If it serves the built desktop renderer, a browser guest loads the SAME React app as the desktop — which uses Electron-only APIs. Grep the room path (`App.tsx`/`useRoom.ts`, `webrtc.ts`) for `window.electron`, IPC, `desktopCapturer`, or other Electron-only calls that a plain browser lacks. Record whether the guest web client can run the room at all. This is the single most likely cause of "the invite doesn't work / two people never connect."

- [ ] **Step 2: Launch the desktop app and open a room solo.**
Per the repo's run method (Electron needs `ELECTRON_RUN_AS_NODE` stripped to open a window — see the desktop-dev-launch note). Open a room. Verify, and record each result:
- the mic permission prompt appears and a self audio track is acquired;
- toggling camera acquires video and shows a self-preview tile;
- toggling screen share prompts the picker and shows a self screen tile;
- the control buttons change visual state;
- the emitted signaling messages appear (log `wsRef.send` of `type:"signal"`), i.e. an offer is created when a (simulated) second peer id is present;
- the invite links show `?room=<token>` and copy correctly.

- [ ] **Step 3: Fix the concrete breaks found.**
For each thing that failed in Steps 1-2, make the minimal fix (e.g. if the guest web client can't run the room because of Electron-only calls, guard them so the browser path degrades gracefully or is explicitly told to use the desktop app; if `findWebDir` serves nothing, that IS why the link is dead — decide with the user whether a browser guest is in scope or the invite should open the desktop app). Write a regression test for any fix that has a pure, testable core.

- [ ] **Step 4: Report the diagnosis and the two-machine gate.**
Write exactly what broke, what you fixed, and what remains for the user's manual gate: a real call between two machines (host + a guest on another machine or browser), confirming audio, then camera, then screen. State plainly that this final confirmation is the user's to perform — WebRTC needs two real peers on a real network.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(rooms): <the concrete A/V break found and fixed>"
```

---

## Manual acceptance (the user's gate)

- [ ] Host opens a room; the invite shows `http://<ip>:<port>?room=<token>` — no session id anywhere.
- [ ] A guest opens the link on another machine and joins; audio connects both ways.
- [ ] Camera and screen share appear on the other side.
- [ ] Rotating/closing the room makes an old invite link stop working.
- [ ] An unlicensed host still gets one free guest; the third is blocked.
