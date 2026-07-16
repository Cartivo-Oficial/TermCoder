"use client";

import { useEffect, useRef } from "react";

const PALETTE = [
  [255, 122, 69], [255, 122, 69], [255, 171, 82], [255, 92, 51],
  [255, 63, 107], [193, 99, 255], [67, 220, 196], [234, 234, 239],
];

interface Cell {
  x: number;
  y: number;
  prox: number;
  phase: number;
  speed: number;
  colorBase: number;
  colorRate: number;
}

export function Dither({ className, side = "both" }: { className?: string; side?: "both" | "left" | "right" | "top" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const cell = 9;
    const band = 0.24;
    let cells: Cell[] = [];
    let W = 0;
    let H = 0;
    let raf = 0;

    const build = () => {
      const rect = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      if (!W || !H) return;
      c.width = W * dpr;
      c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.ceil(W / cell);
      const rows = Math.ceil(H / cell);
      cells = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const nx = x / (cols - 1);
          const ny = y / (rows - 1);
          let prox = 0;
          if (side === "both") prox = Math.max(1 - nx / band, 1 - (1 - nx) / band, 0);
          else if (side === "left") prox = Math.max(1 - nx / band, 0);
          else if (side === "right") prox = Math.max(1 - (1 - nx) / band, 0);
          else prox = Math.max(1 - ny / band, 0);
          if (prox <= 0) continue;
          const fade = side === "top" ? 1 : 1 - ny * 0.45;
          if (Math.random() > prox * prox * 0.9 * fade) continue;
          cells.push({
            x: x * cell,
            y: y * cell,
            prox,
            phase: Math.random() * Math.PI * 2,
            speed: 0.6 + Math.random() * 1.1,
            colorBase: (Math.random() * PALETTE.length) | 0,
            colorRate: 0.15 + Math.random() * 0.35,
          });
        }
      }
    };

    const drawFrame = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const ts = t * 0.001;
      for (const p of cells) {
        const twinkle = 0.5 + 0.5 * Math.sin(ts * p.speed + p.phase);
        const alpha = p.prox * (0.18 + 0.82 * twinkle);
        if (alpha < 0.03) continue;
        const idx = (p.colorBase + Math.floor(ts * p.colorRate + p.phase)) % PALETTE.length;
        const rgb = PALETTE[idx];
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fillRect(p.x, p.y, cell - 1, cell - 1);
      }
      ctx.globalAlpha = 1;
    };

    const render = (t: number) => {
      drawFrame(t);
      raf = requestAnimationFrame(render);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastW = 0;
    let lastH = 0;
    const start = () => {
      const rect = c.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (Math.abs(rect.width - lastW) < 1 && Math.abs(rect.height - lastH) < 1) return;
      lastW = rect.width;
      lastH = rect.height;
      build();
      cancelAnimationFrame(raf);
      drawFrame(performance.now());
      if (!reduce) raf = requestAnimationFrame(render);
    };

    const ro = new ResizeObserver(() => start());
    ro.observe(c);
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [side]);

  return <canvas ref={ref} aria-hidden className={className} style={{ mixBlendMode: "screen" }} />;
}
