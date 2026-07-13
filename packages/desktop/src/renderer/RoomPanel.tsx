import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n";

interface RoomMessage {
  from: string;
  text: string;
  kind: "chat" | "prompt";
}

interface CallState {
  inCall: boolean;
  muted: boolean;
  cameraOn: boolean;
  sharing: boolean;
  error: string | null;
  peers: Array<{ id: string; name: string; connected: boolean }>;
  videos: Array<{ key: string; peerId: string; name: string; stream: MediaStream }>;
  localVideo: MediaStream | null;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onShareScreen: () => void;
  onStopShare: () => void;
}

interface RoomPanelProps {
  port: number;
  myName: string;
  onChangeName: (name: string) => void;
  participants: string[];
  messages: RoomMessage[];
  onSendChat: (text: string) => void;
  onClose: () => void;
  call: CallState;
}

export function RoomPanel({ port, myName, onChangeName, participants, messages, onSendChat, onClose, call }: RoomPanelProps) {
  const { t } = useI18n();
  const httpBase = `http://localhost:${port}`;
  const [addresses, setAddresses] = useState<{ addresses: string[]; port: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(`${httpBase}/room/addresses`)
      .then((r) => r.json())
      .then((d) => setAddresses(d as { addresses: string[]; port: string }))
      .catch(() => {});
  }, [httpBase]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    onSendChat(text);
    setDraft("");
  }

  function copyLink(url: string) {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1200);
    });
  }

  const links = (addresses?.addresses ?? []).map((a) => `${httpBase.startsWith("https") ? "https" : "http"}://${a}:${addresses?.port || port}`);

  return (
    <div className="settings" onClick={onClose}>
      <div className="settings-card room-card" style={{ maxWidth: 560, width: "92%", minHeight: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="room-head">
          <h3>{t("room.title")}</h3>
          <button className="icon sm" title={t("room.close")} onClick={onClose}>×</button>
        </div>

        <label className="room-label">{t("room.you")}</label>
        <input
          className="settings-input"
          value={myName}
          maxLength={40}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder={t("room.you")}
        />
        <p className="hint" style={{ marginTop: 4 }}>{t("room.nameHint")}</p>

        <label className="room-label">{t("room.invite")}</label>
        {links.length ? (
          <div className="room-links">
            {links.map((url) => (
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

        <label className="room-label">{t("room.participants")} · {participants.length}</label>
        <div className="room-people">
          {participants.length ? (
            participants.map((p, i) => (
              <span key={`${p}-${i}`} className={`room-chip ${p === myName ? "me" : ""}`}>{p}</span>
            ))
          ) : (
            <span className="hint">{t("room.alone")}</span>
          )}
        </div>

        <label className="room-label">{t("room.call")}</label>
        {call.error ? <p className="room-call-err">{call.error}</p> : null}
        {!call.inCall ? (
          <button className="btn-2 go room-call-join" onClick={call.onJoin}>{t("room.joinCall")}</button>
        ) : (
          <div className="room-call">
            <div className="room-call-ctl">
              <button className={`btn-2 ${call.muted ? "" : "go"}`} onClick={call.onToggleMute}>
                {call.muted ? t("room.unmute") : t("room.mute")}
              </button>
              <button className={`btn-2 ${call.cameraOn ? "sharing" : ""}`} onClick={call.onToggleCamera}>
                {call.cameraOn ? t("room.cameraOff") : t("room.cameraOn")}
              </button>
              <button
                className={`btn-2 ${call.sharing ? "sharing" : ""}`}
                onClick={call.sharing ? call.onStopShare : call.onShareScreen}
              >
                {call.sharing ? t("room.stopShare") : t("room.shareScreen")}
              </button>
              <button className="btn-2" onClick={call.onLeave}>{t("room.leaveCall")}</button>
            </div>
            <div className="room-call-peers">
              {call.peers.length === 0 ? (
                <span className="hint">{t("room.callAlone")}</span>
              ) : (
                call.peers.map((p) => (
                  <span key={p.id} className="room-chip">
                    <span className={`call-dot ${p.connected ? "live" : ""}`} aria-hidden="true" /> {p.name}
                  </span>
                ))
              )}
            </div>
            {call.localVideo || call.videos.length ? (
              <div className="room-screens">
                {call.localVideo ? (
                  <div className="room-screen" key="self">
                    <video
                      autoPlay
                      playsInline
                      muted
                      ref={(el) => {
                        if (el && el.srcObject !== call.localVideo) el.srcObject = call.localVideo;
                      }}
                    />
                    <span className="room-screen-name">{t("room.me")}</span>
                  </div>
                ) : null}
                {call.videos.map((v) => (
                  <div className="room-screen" key={v.key}>
                    <video
                      autoPlay
                      playsInline
                      muted
                      ref={(el) => {
                        if (el && el.srcObject !== v.stream) el.srcObject = v.stream;
                      }}
                    />
                    <span className="room-screen-name">{v.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <label className="room-label">{t("room.chat")}</label>
        <div className="room-log" ref={logRef}>
          {messages.length === 0 ? (
            <p className="hint">{t("room.chatEmpty")}</p>
          ) : (
            messages.map((m, i) => (
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
          <button className="settings-btn" onClick={send}>{t("room.send")}</button>
        </div>
      </div>
    </div>
  );
}
