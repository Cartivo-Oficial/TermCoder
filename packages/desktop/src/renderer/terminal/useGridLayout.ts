import { useCallback, useEffect, useRef, useState } from "react";
import { equalTracks, gridColumns, gridRowCount, layoutStorageKey, parseLayout } from "./grid";

type Layout = { cols: number[]; rows: number[] };

function load(count: number): Layout {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(layoutStorageKey(count)) : null;
  return parseLayout(count, raw);
}

export function useGridLayout(count: number) {
  const [layout, setLayout] = useState<Layout>(() => load(count));
  const ref = useRef(layout);
  ref.current = layout;

  useEffect(() => {
    setLayout(load(count));
  }, [count]);

  const persist = useCallback(
    (next: Layout) => {
      setLayout(next);
      try {
        localStorage.setItem(layoutStorageKey(count), JSON.stringify(next));
      } catch {}
    },
    [count],
  );

  const setCols = useCallback((cols: number[]) => persist({ cols, rows: ref.current.rows }), [persist]);
  const setRows = useCallback((rows: number[]) => persist({ cols: ref.current.cols, rows }), [persist]);

  const resetCol = useCallback(
    (boundary: number) => {
      const cols = ref.current.cols.slice();
      if (boundary < 0 || boundary >= cols.length - 1) return;
      const avg = (cols[boundary]! + cols[boundary + 1]!) / 2;
      cols[boundary] = avg;
      cols[boundary + 1] = avg;
      persist({ cols, rows: ref.current.rows });
    },
    [persist],
  );

  const resetRow = useCallback(
    (boundary: number) => {
      const rows = ref.current.rows.slice();
      if (boundary < 0 || boundary >= rows.length - 1) return;
      const avg = (rows[boundary]! + rows[boundary + 1]!) / 2;
      rows[boundary] = avg;
      rows[boundary + 1] = avg;
      persist({ cols: ref.current.cols, rows });
    },
    [persist],
  );

  return {
    cols: layout.cols.length ? layout.cols : equalTracks(gridColumns(count)),
    rows: layout.rows.length ? layout.rows : equalTracks(gridRowCount(count)),
    setCols,
    setRows,
    resetCol,
    resetRow,
  };
}
