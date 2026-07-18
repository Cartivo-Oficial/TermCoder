import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { IconClose, IconCopy, IconMic, IconShare } from "../Icons";
import type { UseRoomResult } from "./useRoom";

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
  const [copied, setCopied] = useState<string | null>(null);
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

  function copyLink(url: string) {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1200);
    });
  }

  const { call } = room;
  const alone = call.remotes.length === 0;

  return (
    <div className="room-view">
      <div className="room-view-head">
        <h3>{t("room.title")}</h3>
        <button className="icon sm" title={t("room.close")} onClick={onClose}>
          <IconClose />
        </button>
      </div>

      <div className="room-view-body">
        <div className="room-view-main">
          <label className="room-label">{t("room.you")}</label>
          <input
            className="settings-input"
            value={myName}
            maxLength={40}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder={t("room.you")}
          />
          <p className="hint" style={{ marginTop: 4 }}>
            {t("room.nameHint")}
          </p>

          <div className="room-stage">
            <Tile name={room.self.name || t("room.me")} speaking={call.selfSpeaking} stream={call.selfVideo} muted />
            {call.remotes.map((tile) => (
              <Tile key={tile.key} name={tile.name} speaking={tile.speaking} connected={tile.connected} stream={tile.stream} />
            ))}
            {alone ? (
              <div className="room-stage-empty">
                <p className="hint">{t("room.alone")}</p>
                {room.links[0] ? (
                  <button className="settings-btn sm" onClick={() => copyLink(room.links[0]!)}>
                    <IconCopy /> {copied === room.links[0] ? t("room.copied") : t("room.copy")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {call.error ? <p className="room-call-err">{call.error}</p> : null}

          <label className="room-label">{t("room.call")}</label>
          <div className="room-control-bar">
            {call.inCall ? (
              <>
                <button className={`btn-2 ${call.muted ? "" : "go"}`} onClick={room.actions.toggleMute}>
                  <IconMic /> {call.muted ? t("room.unmute") : t("room.mute")}
                </button>
                <button className={`btn-2 ${call.cameraOn ? "sharing" : ""}`} onClick={room.actions.toggleCamera}>
                  {call.cameraOn ? t("room.cameraOff") : t("room.cameraOn")}
                </button>
                <button className={`btn-2 ${call.sharing ? "sharing" : ""}`} onClick={room.actions.toggleScreen}>
                  <IconShare /> {call.sharing ? t("room.stopShare") : t("room.shareScreen")}
                </button>
                <button className="btn-2" onClick={room.actions.leave}>
                  {t("room.leaveCall")}
                </button>
              </>
            ) : (
              <button className="btn-2 go" onClick={room.actions.join}>
                <IconMic /> {t("room.joinCall")}
              </button>
            )}
          </div>

          <label className="room-label">{t("room.invite")}</label>
          {room.links.length ? (
            <div className="room-links">
              {room.links.map((url) => (
                <div className="room-link" key={url}>
                  <code>{url}</code>
                  <button className="settings-btn sm" onClick={() => copyLink(url)}>
                    {copied === url ? t("room.copied") : t("room.copy")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">{t("room.noLan")}</p>
          )}

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
        </div>

        <div className="room-view-chat">
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
