# Live Room Call-First Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the live-room panel into a call-first layout — video stage as the hero, an always-visible control bar (camera/screen discoverable before joining), invite/participants/chat as a secondary rail.

**Architecture:** Presentation only. `RoomView` is restructured; a `RoomControls` component owns the two-state control bar; a `RoomInvite` component owns the share button + address disclosure. The `useRoom` contract, signaling, and WebRTC are unchanged.

**Tech Stack:** React, TypeScript, CSS, existing i18n (`useI18n`), existing `Icons`.

## Global Constraints

- **No code comments.** Do not add comments to any code you write.
- **Preserve CRLF** on all `packages/desktop/**` files. Match exact existing text with Edit; do not normalize to LF (`core.autocrlf=true`, so `git show` renders LF — that's normal).
- **Do not change `useRoom`, `webrtc.ts`, or any signaling/WebRTC code.** This is presentational.
- Components live in `packages/desktop/src/renderer/room/` and import `../Icons`, `../i18n`, `./useRoom`.
- pnpm workspace. Typecheck: `pnpm --filter @termcoder/desktop typecheck` (if it fails resolving `@termcoder/server`, run `pnpm --filter @termcoder/core build && pnpm --filter @termcoder/server build` first). Web build: `pnpm --filter @termcoder/desktop build:web`.
- **All new user-facing strings go through i18n in all three locales** (English ~line 351, Portuguese ~line 778, Spanish ~line 1205 in `i18n.ts`).

---

### Task 1: New i18n strings + `RoomControls` + `RoomInvite`

The two leaf components and their strings, built in isolation. Verified by typecheck + review.

**Files:**
- Modify: `packages/desktop/src/renderer/i18n.ts`
- Create: `packages/desktop/src/renderer/room/RoomControls.tsx`
- Create: `packages/desktop/src/renderer/room/RoomInvite.tsx`

**Interfaces produced:**
- `RoomControls({ call, actions }: { call: UseRoomResult["call"]; actions: UseRoomResult["actions"] })` — the control bar; pre-join shows Join + disabled camera/screen; in-call shows mute/camera/screen/leave.
- `RoomInvite({ links }: { links: string[] })` — a Share button that copies `links[0]`, plus an "other addresses" disclosure for `links.slice(1)`; empty `links` → the no-LAN hint.

- [ ] **Step 1: Add the i18n keys**

In `packages/desktop/src/renderer/i18n.ts`, add five keys to EACH locale, immediately after the `"room.callAlone"` line in that locale's block.

English (after line 376 `"room.callAlone": "Waiting for others to join the call…",`):
```ts
  "room.joinFirst": "Join the call first",
  "room.editingAs": "editing as",
  "room.share": "Share link",
  "room.otherAddresses": "Other addresses",
  "room.shareToInvite": "Share the link to bring someone in.",
```

Portuguese (after `"room.callAlone": "Esperando os outros entrarem na chamada…",`):
```ts
  "room.joinFirst": "Entre na chamada primeiro",
  "room.editingAs": "editando como",
  "room.share": "Compartilhar link",
  "room.otherAddresses": "Outros endereços",
  "room.shareToInvite": "Compartilhe o link para trazer alguém.",
```

Spanish (after `"room.callAlone": "Esperando a que otros se unan a la llamada…",`):
```ts
  "room.joinFirst": "Únete a la llamada primero",
  "room.editingAs": "editando como",
  "room.share": "Compartir enlace",
  "room.otherAddresses": "Otras direcciones",
  "room.shareToInvite": "Comparte el enlace para invitar a alguien.",
```

- [ ] **Step 2: Create `RoomControls.tsx`**

```tsx
import { useI18n } from "../i18n";
import { IconMic, IconShare } from "../Icons";
import type { UseRoomResult } from "./useRoom";

export function RoomControls({
  call,
  actions,
}: {
  call: UseRoomResult["call"];
  actions: UseRoomResult["actions"];
}) {
  const { t } = useI18n();

  if (!call.inCall) {
    return (
      <div className="room-controls">
        <button className="room-ctrl primary" onClick={actions.join}>
          <IconMic /> {t("room.joinCall")}
        </button>
        <button className="room-ctrl" disabled title={t("room.joinFirst")}>
          {t("room.cameraOn")}
        </button>
        <button className="room-ctrl" disabled title={t("room.joinFirst")}>
          <IconShare /> {t("room.shareScreen")}
        </button>
      </div>
    );
  }

  return (
    <div className="room-controls">
      <button className={`room-ctrl ${call.muted ? "" : "active"}`} onClick={actions.toggleMute}>
        <IconMic /> {call.muted ? t("room.unmute") : t("room.mute")}
      </button>
      <button className={`room-ctrl ${call.cameraOn ? "active" : ""}`} onClick={actions.toggleCamera}>
        {call.cameraOn ? t("room.cameraOff") : t("room.cameraOn")}
      </button>
      <button className={`room-ctrl ${call.sharing ? "active" : ""}`} onClick={actions.toggleScreen}>
        <IconShare /> {call.sharing ? t("room.stopShare") : t("room.shareScreen")}
      </button>
      <button className="room-ctrl danger" onClick={actions.leave}>
        {t("room.leaveCall")}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `RoomInvite.tsx`**

```tsx
import { useState } from "react";
import { useI18n } from "../i18n";
import { IconChevron, IconCopy } from "../Icons";

export function RoomInvite({ links }: { links: string[] }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  if (!links.length) return <p className="hint">{t("room.noLan")}</p>;

  const primary = links[0]!;
  const rest = links.slice(1);
  const copy = (url: string) => {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="room-invite">
      <button className="room-share-btn" onClick={() => copy(primary)}>
        <IconCopy /> {copied ? t("room.copied") : t("room.share")}
      </button>
      {rest.length ? (
        <>
          <button className={`room-invite-more ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)}>
            <IconChevron /> {t("room.otherAddresses")}
          </button>
          {open ? (
            <div className="room-links">
              {rest.map((url) => (
                <div className="room-link" key={url}>
                  <code>{url}</code>
                  <button className="settings-btn sm" onClick={() => copy(url)}>
                    {t("room.copy")}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @termcoder/desktop typecheck`
Expected: no errors. (The components are unused until Task 2 — TypeScript does not error on unused exports; if it flags unused, it will be resolved when Task 2 imports them. If typecheck fails only with `@termcoder/server` module resolution, build core+server first as noted in Global Constraints.)

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/renderer/i18n.ts packages/desktop/src/renderer/room/RoomControls.tsx packages/desktop/src/renderer/room/RoomInvite.tsx
git commit -m "feat(desktop): room control bar and share components for the call-first layout"
```

---

### Task 2: Restructure `RoomView` and the CSS

Swap the form-stack layout for stage-hero + control bar + secondary rail, using the Task 1 components. Verified by typecheck, web build, and the manual gate (screenshots).

**Files:**
- Modify: `packages/desktop/src/renderer/room/RoomView.tsx` (replace the whole component body/return)
- Modify: `packages/desktop/src/renderer/styles.css` (the `.room-*` block ~659-702)

**Interfaces consumed:** `RoomControls`, `RoomInvite` from Task 1; `useRoom`'s `self/participants/chat/links/call/actions` unchanged.

- [ ] **Step 1: Replace `RoomView.tsx`**

Replace the entire file contents with:

```tsx
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { IconClose, IconEdit } from "../Icons";
import type { UseRoomResult } from "./useRoom";
import { RoomControls } from "./RoomControls";
import { RoomInvite } from "./RoomInvite";

interface RoomViewProps {
  room: UseRoomResult;
  myName: string;
  onChangeName: (name: string) => void;
  onClose: () => void;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase() || "?";
}

function Tile({
  name,
  speaking,
  connected,
  stream,
  muted,
}: {
  name: string;
  speaking: boolean;
  connected?: boolean;
  stream: MediaStream | null;
  muted?: boolean;
}) {
  return (
    <div className={`room-tile${speaking ? " speaking" : ""}`}>
      {stream ? (
        <video
          autoPlay
          playsInline
          muted={muted}
          ref={(el) => {
            if (el && el.srcObject !== stream) el.srcObject = stream;
          }}
        />
      ) : (
        <span className="room-tile-avatar">{initials(name)}</span>
      )}
      {connected === false ? <span className="call-dot room-tile-dot" aria-hidden="true" /> : null}
      <span className="room-tile-name">{name}</span>
    </div>
  );
}

export function RoomView({ room, myName, onChangeName, onClose }: RoomViewProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [room.chat.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    room.actions.sendChat(text);
    setDraft("");
  }

  const { call } = room;
  const alone = call.remotes.length === 0;

  return (
    <div className="room-view">
      <div className="room-view-head">
        <h3>{t("room.title")}</h3>
        <div className="room-head-right">
          {editingName ? (
            <input
              className="settings-input room-name-input"
              value={myName}
              maxLength={40}
              autoFocus
              onChange={(e) => onChangeName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditingName(false);
              }}
              placeholder={t("room.you")}
            />
          ) : (
            <button className="room-name-edit" onClick={() => setEditingName(true)}>
              <IconEdit /> {t("room.editingAs")} <b>{myName || t("room.me")}</b>
            </button>
          )}
          <button className="icon sm" title={t("room.close")} onClick={onClose}>
            <IconClose />
          </button>
        </div>
      </div>

      <div className="room-view-body">
        <div className="room-stage-wrap">
          <div className="room-stage">
            <Tile name={room.self.name || t("room.me")} speaking={call.selfSpeaking} stream={call.selfVideo} muted />
            {call.remotes.map((tile) => (
              <Tile
                key={tile.key}
                name={tile.name}
                speaking={tile.speaking}
                connected={tile.connected}
                stream={tile.stream}
              />
            ))}
            {alone ? (
              <div className="room-stage-empty">
                <p className="hint">{t("room.shareToInvite")}</p>
                <RoomInvite links={room.links} />
              </div>
            ) : null}
          </div>
          {call.error ? <p className="room-call-err">{call.error}</p> : null}
          <RoomControls call={call} actions={room.actions} />
        </div>

        <div className="room-rail">
          <label className="room-label">
            {t("room.participants")} · {room.participants.length}
          </label>
          <div className="room-people">
            {room.participants.length ? (
              room.participants.map((p, i) => (
                <span key={`${p}-${i}`} className={`room-chip ${p === room.self.name ? "me" : ""}`}>
                  {p}
                </span>
              ))
            ) : (
              <span className="hint">{t("room.alone")}</span>
            )}
          </div>

          <label className="room-label">{t("room.invite")}</label>
          <RoomInvite links={room.links} />

          <label className="room-label">{t("room.chat")}</label>
          <div className="room-log" ref={logRef}>
            {room.chat.length === 0 ? (
              <p className="hint">{t("room.chatEmpty")}</p>
            ) : (
              room.chat.map((m, i) => (
                <div key={i} className={`room-msg ${m.kind}`}>
                  <span className="room-from">{m.from}</span>
                  {m.kind === "prompt" ? <span className="room-tag">{t("room.asked")}</span> : null}
                  <span className="room-text">{m.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="room-compose">
            <input
              className="settings-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder={t("room.chatPlaceholder")}
            />
            <button className="settings-btn" onClick={send}>
              {t("room.send")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the CSS**

In `packages/desktop/src/renderer/styles.css`, replace the body/main/chat/stage/control-bar rules. Find these existing lines (~690-702) and replace them:

Replace:
```css
.room-view-body { flex: 1; min-height: 0; display: flex; gap: 20px; padding: 18px 20px; overflow: hidden; }
.room-view-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow-y: auto; }
.room-view-chat { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--border); padding-left: 18px; }
.room-view-chat .room-log { flex: 1; }
.room-stage { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
```
with:
```css
.room-view-body { flex: 1; min-height: 0; display: flex; gap: 20px; padding: 18px 20px; overflow: hidden; }
.room-stage-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.room-rail { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--border); padding-left: 18px; }
.room-rail .room-log { flex: 1; max-height: none; }
.room-stage { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); grid-auto-rows: 1fr; gap: 10px; align-content: stretch; }
.room-stage-empty { aspect-ratio: auto; }
```

Then, keep the existing `.room-control-bar` rule but add the new control + head + invite rules. After the `.room-control-bar { ... }` line (~702) add:
```css
.room-controls { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; padding: 4px 0 2px; }
.room-ctrl { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text); background: var(--elev); border: 1px solid var(--border); border-radius: 999px; padding: 8px 14px; cursor: pointer; transition: border-color .12s ease, background .12s ease, opacity .12s ease; }
.room-ctrl:hover:not(:disabled) { border-color: var(--accent); }
.room-ctrl.primary { background: var(--accent); color: #0b0b0d; border-color: var(--accent); font-weight: 600; }
.room-ctrl.active { border-color: var(--accent); color: var(--accent); }
.room-ctrl.danger:hover:not(:disabled) { border-color: #e5484d; color: #e5484d; }
.room-ctrl:disabled { opacity: 0.45; cursor: not-allowed; }
.room-head-right { display: flex; align-items: center; gap: 10px; }
.room-name-edit { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); background: transparent; border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; cursor: pointer; }
.room-name-edit:hover { border-color: var(--accent); color: var(--text); }
.room-name-edit b { color: var(--text); font-weight: 600; }
.room-name-input { width: 200px; }
.room-invite { display: flex; flex-direction: column; gap: 6px; }
.room-share-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12.5px; color: #0b0b0d; background: var(--accent); border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 600; }
.room-share-btn:hover { opacity: 0.92; }
.room-invite-more { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--muted); background: transparent; border: none; cursor: pointer; padding: 2px 0; }
.room-invite-more svg { transition: transform .12s ease; }
.room-invite-more.open svg { transform: rotate(90deg); }
```

- [ ] **Step 3: Typecheck and web build**

Run: `pnpm --filter @termcoder/desktop typecheck`
Expected: no errors.

Run: `pnpm --filter @termcoder/desktop build:web`
Expected: builds `dist-web` with no error.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer/room/RoomView.tsx packages/desktop/src/renderer/styles.css
git commit -m "feat(desktop): call-first live room layout"
```

- [ ] **Step 5: Record the manual gate**

Cannot be automated here (needs the running app + a controller to drive it with screenshots). Note for the controller:
- Open the room. The video stage is the hero and fills the panel; the control bar sits beneath it.
- **Before joining**, the Camera and Share-screen controls are visible but disabled (tooltip "join first"), and Join is the primary button — the discoverability fix.
- Click Join → controls enable; mute toggles label/state.
- The stage-empty CTA shows the share hint + Share button when alone; clicking Share copies the link ("Copied").
- The rail shows participants, the Share affordance with an "other addresses" disclosure (when >1 link), and chat that still sends.
- The name edit in the header toggles to an input and back.
- Check both light and dark themes.

---

## Self-Review

**Spec coverage:**
- Slim header with inline name edit → Task 2 Step 1 (`room-head-right`, `room-name-edit`). ✅
- Stage as hero, fills height → Task 2 Step 2 (`.room-stage-wrap` flex:1, `.room-stage` flex:1 grid-auto-rows). ✅
- Alone-state Share CTA → Task 2 Step 1 (`room-stage-empty` + `RoomInvite`). ✅
- Always-visible control bar, camera/screen discoverable pre-join disabled → Task 1 Step 2 (`RoomControls` pre-join branch). ✅
- In-call controls reflect muted/cameraOn/sharing → Task 1 Step 2. ✅
- Secondary rail (participants + invite + chat) → Task 2 Step 1 (`room-rail`). ✅
- Invite as Share + "other addresses" disclosure → Task 1 Step 3 (`RoomInvite`). ✅
- i18n in all 3 locales → Task 1 Step 1. ✅
- No change to useRoom/webrtc/signaling → only RoomView/CSS/new components touched. ✅

**Placeholder scan:** No TBD/TODO; every code step is complete, including the full RoomView replacement.

**Type consistency:** `RoomControls({call, actions})` and `RoomInvite({links})` signatures match their usage in RoomView. `call`/`actions` typed via `UseRoomResult["call"]`/`["actions"]`. `IconEdit`, `IconChevron`, `IconCopy`, `IconMic`, `IconShare`, `IconClose` all confirmed exported. Removed imports (`IconCopy`, `IconMic`, `IconShare`) from RoomView are no longer referenced there (moved into the child components) — the new RoomView imports only `IconClose`, `IconEdit`.

**Note:** `room.call`, `room.callAlone`, `room.invite`, `room.nameHint` keys stay defined; `nameHint`/`callAlone` become unused by the new RoomView but are left in i18n (removing them is out of scope and risks other references).
