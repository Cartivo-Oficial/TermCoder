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
