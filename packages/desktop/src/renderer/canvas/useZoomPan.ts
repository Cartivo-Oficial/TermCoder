import { useCallback, useRef, useState } from "react";

const MIN = 0.25;
const MAX = 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function computeFit(content: { w: number; h: number }, viewport: { w: number; h: number }): { scale: number; tx: number; ty: number } {
  const w = content.w || 1;
  const h = content.h || 1;
  const scale = clamp(Math.min(viewport.w / w, viewport.h / h) * 0.9, MIN, MAX);
  return { scale, tx: (viewport.w - w * scale) / 2, ty: (viewport.h - h * scale) / 2 };
}

export function useZoomPan() {
  const [t, setT] = useState({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const viewport = useRef({ w: 0, h: 0 });
  const content = useRef({ w: 0, h: 0 });

  const setViewport = useCallback((w: number, h: number) => { viewport.current = { w, h }; }, []);
  const setContent = useCallback((w: number, h: number) => { content.current = { w, h }; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setT((prev) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = clamp(prev.scale * factor, MIN, MAX);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / prev.scale;
      return { scale: next, tx: px - (px - prev.tx) * k, ty: py - (py - prev.ty) * k };
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: t.tx, ty: t.ty };
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      setT((prev) => ({ ...prev, tx: drag.current!.tx + (ev.clientX - drag.current!.x), ty: drag.current!.ty + (ev.clientY - drag.current!.y) }));
    };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [t.tx, t.ty]);

  const fit = useCallback(() => { setT(computeFit(content.current, viewport.current)); }, []);
  const zoomIn = useCallback(() => setT((p) => ({ ...p, scale: clamp(p.scale * 1.2, MIN, MAX) })), []);
  const zoomOut = useCallback(() => setT((p) => ({ ...p, scale: clamp(p.scale / 1.2, MIN, MAX) })), []);
  const reset = useCallback(() => setT({ scale: 1, tx: 0, ty: 0 }), []);

  return { ...t, onWheel, onPointerDown, fit, zoomIn, zoomOut, reset, setViewport, setContent };
}
