import { useRef, type ReactNode } from "react";
import { resizeTracks } from "./terminal/grid";
import { useGridLayout } from "./terminal/useGridLayout";

const MIN_CELL_PX = 120;

export function TerminalGrid({
  terminals,
  activeId,
  onActivate,
  renderPane,
}: {
  terminals: number[];
  activeId: number;
  onActivate: (id: number) => void;
  renderPane: (id: number) => ReactNode;
}) {
  const count = terminals.length;
  const { cols, rows, setCols, setRows, resetCol, resetRow } = useGridLayout(count);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  function startDrag(
    axis: "col" | "row",
    boundary: number,
    e: React.PointerEvent,
  ) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const body = bodyRef.current;
    if (!body) return;
    const startTracks = axis === "col" ? cols.slice() : rows.slice();
    const start = axis === "col" ? e.clientX : e.clientY;
    const axisSize = axis === "col" ? body.clientWidth : body.clientHeight;
    if (axisSize <= 0) return;
    const minFraction = Math.min(0.45, MIN_CELL_PX / axisSize);
    const move = (ev: PointerEvent) => {
      const now = axis === "col" ? ev.clientX : ev.clientY;
      const deltaFraction = (now - start) / axisSize;
      const next = resizeTracks(startTracks, boundary, deltaFraction, minFraction);
      if (axis === "col") setCols(next);
      else setRows(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const cumulative = (tracks: number[], i: number) =>
    tracks.slice(0, i + 1).reduce((a, b) => a + b, 0);

  return (
    <div
      ref={bodyRef}
      className="term-deck-body grid"
      style={{
        gridTemplateColumns: cols.map((f) => `${f}fr`).join(" "),
        gridTemplateRows: rows.map((f) => `${f}fr`).join(" "),
      }}
    >
      {terminals.map((id) => (
        <div
          key={id}
          className={`term-pane-cell ${id === activeId ? "focused" : ""}`}
          onMouseDown={() => onActivate(id)}
        >
          {renderPane(id)}
        </div>
      ))}
      {rows.slice(0, -1).map((_, i) => (
        <div
          key={`r${i}`}
          className="term-grid-gutter row"
          style={{ top: `${cumulative(rows, i) * 100}%` }}
          onPointerDown={(e) => startDrag("row", i, e)}
          onDoubleClick={() => resetRow(i)}
        />
      ))}
      {cols.slice(0, -1).map((_, i) => (
        <div
          key={`c${i}`}
          className="term-grid-gutter col"
          style={{ left: `${cumulative(cols, i) * 100}%` }}
          onPointerDown={(e) => startDrag("col", i, e)}
          onDoubleClick={() => resetCol(i)}
        />
      ))}
    </div>
  );
}
