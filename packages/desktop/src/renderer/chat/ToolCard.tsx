import { useState } from "react";
import { Panel } from "../ui";
import { splitPath } from "./summary";

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

export function ToolCard({
  name,
  text,
  status,
  detail,
  target,
  defaultOpen,
}: {
  name?: string;
  text?: string;
  status?: "running" | "done" | "error";
  detail?: string;
  target?: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const state = status ?? "running";
  const mark = state === "error" ? "✗" : state === "done" ? "✓" : "•";
  const path = target && !(text ?? "").includes(target) ? splitPath(target) : null;
  return (
    <Panel
      className={`tool-card ${state}`}
      head={
        <button
          type="button"
          className="tool-card-head"
          onClick={() => detail && setOpen((v) => !v)}
          disabled={!detail}
          aria-expanded={detail ? open : undefined}
        >
          <span className={`status ${state}`}>{mark}</span>
          <span className="toolname">{name}</span>
          {path ? (
            <span className="tool-target" title={target}>
              <span className="tool-dir">{path.dir}</span>
              <span className="tool-base">{path.base}</span>
            </span>
          ) : null}
          {text ? (
            <span className="tool-title" title={text}>
              {text}
            </span>
          ) : null}
          {detail ? <span className="tool-caret">{open ? "▾" : "▸"}</span> : null}
        </button>
      }
    >
      {detail && open ? (isDiff(detail) ? <DiffBlock text={detail} /> : <pre className="detail">{detail}</pre>) : null}
    </Panel>
  );
}
