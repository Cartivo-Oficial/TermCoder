import type { ReactNode } from "react";
import { Panel } from "../ui";

export function UserMessage({ text, images }: { text: string; images?: string[] }) {
  return (
    <Panel className="msg-card bubble user">
      {images && images.length ? (
        <div className="msg-images">
          {images.map((src, k) => (
            <img key={k} src={src} alt="attachment" />
          ))}
        </div>
      ) : null}
      {text}
    </Panel>
  );
}

export function AssistantMessage({
  className = "",
  copyLabel,
  copyIcon,
  onCopy,
  stamp,
  children,
}: {
  className?: string;
  copyLabel?: string;
  copyIcon?: ReactNode;
  onCopy?: () => void;
  stamp?: string;
  children: ReactNode;
}) {
  return (
    <Panel className="msg-card assistant-wrap">
      <div className={`bubble assistant ${className}`.trim()}>{children}</div>
      {stamp || onCopy ? (
        <div className="msg-foot">
          <span className="msg-stamp">{stamp}</span>
          {onCopy ? (
            <button className="msg-copy" title={copyLabel} onClick={onCopy}>
              {copyIcon}
            </button>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
