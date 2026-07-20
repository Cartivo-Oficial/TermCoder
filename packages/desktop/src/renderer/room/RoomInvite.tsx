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
