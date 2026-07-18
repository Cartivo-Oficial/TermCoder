# Live Rooms — refactor: make it work, make it good, stop leaking the session id

**Date:** 2026-07-17
**Status:** draft, awaiting review
**Approach:** A (rebuild the UI, debug the existing A/V by running it, decouple the room token) — chosen over a full A/V rewrite or a UI-only pass.

## Problem

The desktop "Sala ao vivo" is a cramped centred modal (mic / camera / screen-share / leave buttons, an invite link, a participant list, a chat). The user's verdict: it looks bad and "nada funciona" — end to end, treated as fully broken. And the invite link leaks the coding session's id in plaintext.

## What actually exists today (verified in code, not assumed)

The A/V stack is structurally complete — this is a debug-and-redesign, not a build-from-nothing:

- **Client engine:** `packages/desktop/src/renderer/webrtc.ts` — a `CallManager` with `getUserMedia` (mic/camera), `getDisplayMedia` (screen), `RTCPeerConnection` over Google STUN, `onicecandidate`, `ontrack`, and `onnegotiationneeded` (`webrtc.ts:142`) already wired — so renegotiation for camera/screen after an audio call is present, and is probably NOT the break.
- **Signaling:** `App.tsx` sends `{ type: "signal", to, data }`; the server relays it peer-to-peer at `server.ts:1201` (`roomSendTo`). Never stored.
- **Electron media permission:** `main/index.ts:430` grants `media` and uses `desktopCapturer` for screen — so getUserMedia is NOT blocked by the OS layer.
- **Guest web client:** the server serves a static SPA with fallback (`server.ts:989`), so a browser guest opening the invite gets a UI.
- **Presence + gate:** `room-presence`, participant list, and the Pro gate (`room-locked` for >1 guest unlicensed).

Because the plumbing is complete, "nada funciona" is one or more of: (a) a terrible UX that *reads* as broken, (b) a real bug in the connection handshake that only shows when two peers actually run, (c) the user never ran a real 2-machine call. The A/V-correctness work is therefore **debug by running**, not rewrite.

## The security defect

`RoomPanel.tsx:73`: `?session=${sessionId}`. The invite is `http://<LAN-IP>:<port>?session=<sessionId>`. That id is the coding session's id, reachable at the server's HTTP session endpoints. So a leaked invite link (URLs end up in logs, history, chat) hands a LAN peer the session identity, not merely room entry.

## What we build

### 1. A real call UI (replaces the modal)

A full-height room surface (panel/view, not a centred modal), in the app's existing dark/mono theme:

- **Stage** — participant tiles in a responsive grid. With video: the stream. Without: an initial/avatar tile with a ring that lights when that person is speaking (audio-level). Your own tile always present (self-preview when your camera is on).
- **Control bar** (bottom) — Mic (mute toggle with a real on/off state), Camera, Screen share, Leave. Each reflects true state (e.g. camera on shows a live self-tile; muted shows a slashed mic). No dead buttons.
- **Presence** — the participant list, showing muted / speaking.
- **Invite** — the LAN links, now carrying a room token (below), each with a copy button.
- **Chat** — the existing room chat, as a side rail.
- **Empty state** — alone in the room reads as "share a link to invite someone" with the copy button up front, not a limbo "Esperando os outros entrarem…".

The A/V *engine* (`CallManager`) is reused; only the React UI around it is rebuilt. Where the current `RoomPanel.tsx` couples layout and call wiring, split them: a presentational room view + a hook/controller that owns the `CallManager` and the signaling socket, so each is testable and readable.

### 2. A/V correctness — audit by running

Reuse `CallManager` + the signaling relay. Launch the app, open a room, and drive it; fix what breaks. The specific risk areas, in priority order:

- **Initiator / glare.** When a second peer joins, exactly one side must `createOffer`; if both do, the negotiation collides and neither connects. The fix is a deterministic rule (e.g. the peer with the lexicographically smaller peer id initiates toward the other). Verify who currently initiates and whether a symmetric join causes glare — this is the single most likely cause of "two people never connect."
- **Peer id `to`/`from` mapping.** The offer/answer/ICE must be addressed to the right peer id on both the send (`App.tsx`) and relay (`server.ts:1201`) sides; an id mismatch silently drops signaling.
- **The guest web client.** Confirm the served SPA actually instantiates `CallManager` and joins the same signaling — if the web guest only does chat, a browser participant can never carry A/V, which would read as "the link doesn't work."
- **Track → tile attachment.** `ontrack` must attach the remote stream to that participant's tile; a mis-keyed map shows a connected-but-blank tile.

The acceptance for A/V is a real call between two machines, which is the **user's manual gate** — WebRTC needs two real peers and a real network. Everything reachable by running the app solo (permission prompts, self-preview, button state, signaling messages emitted, the empty/one-peer states) is verified before that gate.

### 3. Decouple the room token from the session id

- On opening a room, the server mints a **random room join token** (e.g. 16+ bytes, base64url), held in the room record, distinct from the session id.
- The invite becomes `http://<IP>:<port>?room=<joinToken>` — no session id.
- The server maps `joinToken → room/session` internally; the WS/HTTP join validates the token, not a raw session id in the URL.
- Closing the room (or a rotate action) invalidates the token, so a leaked link dies.

**Honest boundary:** over http on the LAN this token still crosses the wire in plaintext, so a sniffer on the same network can read it in transit. That is the deferred security block (TLS / auth on the LAN server). This change removes the *session-id* leak and makes the room credential rotatable — a real, scoped improvement, not the whole network story.

## Components and interfaces

| Unit | Responsibility | Notes |
|---|---|---|
| `packages/server/src/rooms/token.ts` (or in server) | mint/validate/rotate a room join token; map token→room | pure-ish, testable |
| `packages/server/src/server.ts` | accept `?room=<token>`; keep `?session=` working only if already joined-by-token; relay signaling (unchanged) | back-compat: see below |
| `packages/desktop/src/renderer/room/useRoom.ts` (new) | owns the `CallManager` + signaling socket; exposes call state + actions | splits logic from view |
| `packages/desktop/src/renderer/room/RoomView.tsx` (new) | the presentational call UI (stage, controls, presence, chat, invite, empty) | replaces the modal `RoomPanel` |
| `packages/desktop/src/renderer/room/invite.ts` | build invite links from addresses + room token | pure, unit-tested |
| `packages/desktop/src/renderer/webrtc.ts` | the A/V engine | reused; bug fixes only |

Back-compat: the token replaces the session id in the invite. If an old `?session=` link must still resolve during the transition, the server may accept it behind the same room lookup, but the **default and only minted** link uses `?room=`. The plan decides whether to keep a `?session=` shim or hard-cut; hard-cut is cleaner if no old links are in circulation.

## Testing

- **Pure units:** room-token mint/validate/rotate (unique, unguessable-length, invalid/expired rejected); invite-link building (correct scheme/host/port, carries `?room=`, never `?session=`); initiator-selection (deterministic, exactly one initiator per pair). Vitest, no network.
- **Server:** joining with a valid token succeeds; a bogus/rotated token is rejected; signaling still relays; the Pro gate still fires at the third participant (don't regress `39eb703`-era behaviour).
- **UI states (run the app):** alone/empty, one remote peer, mic muted, camera on (self-preview), screen sharing — each renders correctly.
- **The real call:** two machines, a genuine connection with audio then camera then screen — **user manual gate**.

## Out of scope

- TLS / general auth on the LAN HTTP server (the deferred security block — the room token is scoped to the invite leak only).
- The terminal grid layout, and the broader security audit (separate work the user sequenced after this).
- Recording, more than the current A/V modalities, or a TURN server (STUN-only P2P stays; symmetric-NAT failures are out of scope).

## Open question for the plan

Whether to keep a `?session=` compatibility shim on the server or hard-cut to `?room=`. Recommendation: hard-cut — rooms are ephemeral and no durable old links exist, so a shim only preserves the very leak we are removing.
