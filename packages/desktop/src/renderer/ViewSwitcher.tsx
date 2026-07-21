import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n";
import { IconAgents, IconChat, IconServer } from "./Icons";

type View = "chat" | "terminal" | "canvas";

function ViewIcon({ v }: { v: View }) {
  if (v === "terminal") return <IconServer />;
  if (v === "canvas") return <IconAgents />;
  return <IconChat />;
}

export function ViewSwitcher({ view, onSelect }: { view: View; onSelect: (v: View) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label: Record<View, string> = {
    chat: t("tab.chat"),
    terminal: t("tab.terminal"),
    canvas: t("canvas.tab"),
  };
  const views: View[] = ["chat", "terminal", "canvas"];

  return (
    <div className="view-switcher" ref={ref}>
      <button className="vs-trigger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <ViewIcon v={view} />
        <span>{label[view]}</span>
        <svg className="vs-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="view-menu">
          {views.map((v) => (
            <button
              key={v}
              className={`vs-item ${v === view ? "sel" : ""}`}
              onClick={() => {
                onSelect(v);
                setOpen(false);
              }}
            >
              <ViewIcon v={v} />
              <span>{label[v]}</span>
              {v === view ? (
                <svg className="vs-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l5 5L20 6" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
