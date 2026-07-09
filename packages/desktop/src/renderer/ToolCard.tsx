import { useState } from "react";

const isDiff = (t: string) => /^[+-] /m.test(t);

export function DiffBlock({ text }: { text: string }) {
  return (
    <pre className="diff">
      {text.split("\n").map((line, i) => (
        <div key={i} className={line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "ctx"}>
          {line}
        </div>
      ))}
    </pre>
  );
}

export function DiffBody({ content }: { content: string }) {
  return (
    <pre className="viewer-body diff">
      {content.split("\n").map((line, i) => {
        const cls =
          line.startsWith("+") && !line.startsWith("+++") ? "add"
          : line.startsWith("-") && !line.startsWith("---") ? "del"
          : line.startsWith("@@") ? "hunk"
          : "ctx";
        return (
          <div key={i} className={cls}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

export function ToolCard({
  name,
  text,
  status,
  detail,
  defaultOpen,
}: {
  name?: string;
  text?: string;
  status?: "running" | "done" | "error";
  detail?: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const mark = status === "error" ? "✗" : status === "done" ? "✓" : "•";
  return (
    <div className={`tool-card ${status ?? "running"}`}>
      <button className="tool-card-head" onClick={() => detail && setOpen((v) => !v)} disabled={!detail}>
        <span className={`status ${status ?? "running"}`}>{mark}</span>
        <span className="toolname">{name}</span>
        {text ? <span className="tool-title">{text}</span> : null}
        {detail ? <span className="tool-caret">{open ? "▾" : "▸"}</span> : null}
      </button>
      {detail && open ? (isDiff(detail) ? <DiffBlock text={detail} /> : <pre className="detail">{detail}</pre>) : null}
    </div>
  );
}
