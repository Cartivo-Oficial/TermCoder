import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette({ items, onClose }: { items: PaletteItem[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return items
      .filter((i) => i.label.toLowerCase().includes(s) || i.hint?.toLowerCase().includes(s))
      .slice(0, 50);
  }, [items, q]);

  useEffect(() => setActive(0), [q]);

  function choose(item: PaletteItem) {
    onClose();
    item.run();
  }

  return (
    <div className="palette" onClick={onClose}>
      <div className="palette-card" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type a command, session or file…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const it = filtered[active];
              if (it) choose(it);
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
        />
        <div className="palette-list">
          {filtered.map((it, idx) => (
            <div
              key={it.id}
              className={`palette-item ${idx === active ? "active" : ""}`}
              onMouseEnter={() => setActive(idx)}
              onClick={() => choose(it)}
            >
              <span className="pi-label">{it.label}</span>
              {it.hint ? <span className="pi-hint">{it.hint}</span> : null}
            </div>
          ))}
          {filtered.length === 0 ? <div className="palette-empty">No matches</div> : null}
        </div>
      </div>
    </div>
  );
}
