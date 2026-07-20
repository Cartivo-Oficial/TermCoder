# Live Room — call-first redesign

base: 975be31 (0.11.2 in progress)
status: design (awaiting user review)

## Problem

The live-room panel (`RoomView`) reads like a settings form: a vertical stack of labeled sections (name input, a small tile stage, a call bar, raw invite URLs, participant chips) in a left column with chat on the right. Two concrete failures:

1. **It feels low-level** ("está em baixo nível ainda") — the form-stack hierarchy buries the thing that matters (the people on the call) under configuration.
2. **Camera and screen share are undiscoverable.** The camera/screen buttons only render inside `call.inCall` (`RoomView.tsx:126-145`). Before joining, the bar shows only "Join call", so a user can't tell screen sharing exists. (Screen share itself works — `webrtc.ts` `getDisplayMedia` + the main-process `setDisplayMediaRequestHandler` — it's purely a discovery gap.)

Decision (user): restructure to a **call-first** layout, not just spot fixes.

## Approach

Reorder the panel around the call: the video stage becomes the hero, a control bar sits directly beneath it and is always present, and the secondary material (invite, participants, chat) moves into a right rail that reads as support, not co-equal form fields. Nothing about signaling, WebRTC, or the `useRoom` contract changes — this is presentation only.

The `useRoom` interface is unchanged and consumed as-is:
`self`, `participants`, `chat`, `links`, `call { inCall, muted, cameraOn, sharing, error, selfSpeaking, selfVideo, remotes }`, `actions { join, toggleMute, toggleCamera, toggleScreen, leave, sendChat }`.

## Layout

Full-panel overlay (keep `.room-view` inset:0 / z-index). Three regions:

### 1. Slim header
Title on the left; on the right, an inline **"you"** control — the display name shown as `editando como <name>` that turns into the existing input on click (replaces the big top-of-form name field), plus the close button. Name editing stops occupying prime space.

### 2. Stage (hero, `flex: 1`)
The tile grid fills the main area and scales to fill the available height (not a fixed `minmax(180px)` row that leaves dead space). Self tile + remote tiles. Speaking ring and video/​avatar fallback are kept from the current `Tile`.

- **Alone state:** instead of a small dashed placeholder, a centered call-to-action inside the stage — a short line ("share the link to bring someone in") and a primary **Share** button (copies the primary invite link). This is the empty-stage hero.

### 3. Control bar (always visible, beneath the stage)
A single centered bar present in **both** states, so the capabilities are always visible:

- **Before joining:** a primary **Join** button (mic icon) plus **Camera** and **Share screen** shown but **disabled**, each with a title/tooltip "join the call first". This is the discoverability fix — the user sees camera and screen exist before joining.
- **In call:** Mute/unmute · Camera on/off · Share/stop screen · Leave, each reflecting `call.muted` / `call.cameraOn` / `call.sharing`.
- `call.error` renders as a small line under the bar (unchanged copy).

### 4. Right rail (support)
A narrower rail than today's co-equal column, visually secondary:
- **Participants** as chips (count in the label).
- **Invite** collapses to a **Share** affordance: a button that copies the primary link, with a small disclosure ("other addresses") revealing the remaining LAN URLs for multi-interface machines — instead of two raw `<code>` URL blocks always shown.
- **Chat** log + compose, unchanged behavior (this already works).

On a narrow panel the rail can stack under the stage; not required for v1 (the panel is desktop-sized).

## Components

- `RoomView.tsx` — restructured JSX into header / stage / controls / rail. Stays the orchestrator.
- `RoomControls.tsx` (new) — the control bar, taking `call` + `actions`; renders the pre-join (Join + disabled camera/screen) and in-call states. Isolating the two-state logic keeps `RoomView` readable and makes the states independently reasoned about.
- `RoomInvite.tsx` (new) — the Share button + "other addresses" disclosure, taking `links` + a copy handler. Encapsulates the copy/disclosure state.
- `Tile` — unchanged (kept inline in `RoomView` or moved beside it; behavior identical).
- CSS (`styles.css`, the `.room-*` block ~659-702) — restructured: stage grows to fill, control bar styling, rail narrowed and de-emphasized, pre-join disabled-control affordance, share button. New i18n keys for the pre-join hints and the share/disclosure copy, in all three locales (en/pt/es).

## Data flow

`App` → `RoomView` (owns local draft/copied/name-edit UI state) → `RoomControls` (stateless, `call`+`actions`) and `RoomInvite` (owns its disclosure/copied state) → `useRoom` actions. No change to signaling or the room WS.

## Discoverability fix (the must-fix, restated)

Camera and Share-screen controls render in **every** state. Pre-join they are disabled with a "join first" tooltip; joining enables them. A user can no longer miss that screen sharing exists.

## Error handling / edge cases

- Screen-share cancelled (`call.error = "Screen share was cancelled."`) already surfaces via `call.error`; kept.
- No LAN links (`links` empty) → the Share affordance shows the existing "no LAN" hint instead of a copy button.
- Alone (no remotes) → stage shows the Share CTA; control bar still present.
- Name empty → tile falls back to initials "?" (existing `initials`).

## Testing

- No new pure logic; the change is presentational. `initials` already has whatever coverage exists; `inviteLinks` is already tested.
- Manual gate (driven in the running app, with screenshots): open the room — the stage is the hero, camera and screen controls are visible (disabled) before joining; join — controls enable, mic toggles; the Share button copies the link; the "other addresses" disclosure reveals the second LAN URL; chat still sends; the alone-state CTA shows when no one else is in. Verify light and dark themes.

## Out of scope (logged)

- Actual multi-machine call verification (the standing 2-machine manual gate) — unchanged by this presentational work.
- Grid/speaker-view switching, tile pinning, background blur — future.
- Mobile/narrow responsive stacking beyond the desktop panel.
