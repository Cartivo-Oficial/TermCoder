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
  sender,
  className = "",
  copyLabel,
  copyIcon,
  onCopy,
  stamp,
  children,
}: {
  sender: string;
  className?: string;
  copyLabel?: string;
  copyIcon?: ReactNode;
  onCopy?: () => void;
  stamp?: string;
  children: ReactNode;
}) {
  return (
    <Panel
      className="msg-card assistant-wrap"
      head={
        <div className="msg-meta">
          <span className="msg-spine" />
          {sender}
        </div>
      }
    >
      <div className={`bubble assistant ${className}`.trim()}>{children}</div>
      {stamp ? <div className="msg-stamp">{stamp}</div> : null}
      {onCopy ? (
        <button className="msg-copy" title={copyLabel} onClick={onCopy}>
          {copyIcon}
        </button>
      ) : null}
    </Panel>
  );
}
