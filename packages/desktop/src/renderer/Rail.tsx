import { IconChat, IconFolder, IconStudy, IconAgents, IconGear } from "./Icons";
import { useI18n } from "./i18n";

export type RailItem = "chat" | "files" | "study" | "agents";

const ITEMS: Array<{ id: RailItem; icon: typeof IconChat; key: string }> = [
  { id: "chat", icon: IconChat, key: "rail.chat" },
  { id: "files", icon: IconFolder, key: "rail.files" },
  { id: "study", icon: IconStudy, key: "rail.study" },
  { id: "agents", icon: IconAgents, key: "rail.agents" },
];

export function Rail({
  active,
  busy,
  connected,
  onSelect,
  onSettings,
}: {
  active: RailItem | null;
  busy: boolean;
  connected: boolean;
  onSelect: (item: RailItem) => void;
  onSettings: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="rail">
      <span className="brand-mark rail-mark" aria-hidden="true" />
      {ITEMS.map(({ id, icon: Icon, key }) => (
        <button
          key={id}
          className={`rail-btn ${active === id ? "active" : ""}`}
          title={t(key)}
          onClick={() => onSelect(id)}
        >
          <Icon />
        </button>
      ))}
      <div className="rail-spacer" />
      <span
        className={`dot ${busy ? "gen" : connected ? "on" : "off"}`}
        title={connected ? t("chat.connected") : t("chat.connecting")}
      />
      <button className="rail-btn" title={t("nav.settings")} onClick={onSettings}>
        <IconGear />
      </button>
    </nav>
  );
}
