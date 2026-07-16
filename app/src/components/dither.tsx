import { useEffect, useRef } from "react";

const WARM = [
  [255, 122, 69], [255, 122, 69], [255, 171, 82], [255, 92, 51],
  [255, 63, 107], [193, 99, 255], [234, 234, 239],
];
const COOL = [
  [49, 208, 180], [49, 208, 180], [127, 240, 221], [56, 176, 200],
  [99, 140, 255], [193, 99, 255], [234, 234, 239],
];

type Tone = "warm" | "cool" | "seam";
type Side = "both" | "left" | "right" | "top" | "field";

interface Cell {
  x: number;
  y: number;
  ny: number;
  prox: number;
  phase: number;
  speed: number;
  colorBase: number;
  colorRate: number;
}

export function Dither({
  className,
  side = "both",
  tone = "warm",
  band = 0.24,
  density = 0.9,
}: {
  className?: string;
  side?: Side;
  tone?: Tone;
  band?: number;
  density?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const cell = 9;
    let cells: Cell[] = [];
    let W = 0;
    let H = 0;
    let raf = 0;

    const paletteFor = (ny: number) => {
      if (tone === "warm") return WARM;
      if (tone === "cool") return COOL;
      return ny < 0.5 ? WARM : COOL;
    };

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
          const nx = cols > 1 ? x / (cols - 1) : 0;
          const ny = rows > 1 ? y / (rows - 1) : 0;
          let prox = 0;
          if (side === "both") prox = Math.max(1 - nx / band, 1 - (1 - nx) / band, 0);
          else if (side === "left") prox = Math.max(1 - nx / band, 0);
          else if (side === "right") prox = Math.max(1 - (1 - nx) / band, 0);
          else if (side === "top") prox = Math.max(1 - ny / band, 0);
          else prox = 0.42 + 0.35 * Math.sin(nx * 7.5) * Math.cos(ny * 5.5);
          if (prox <= 0.02) continue;
          const fade = side === "top" || side === "field" ? 1 : 1 - ny * 0.4;
          if (Math.random() > prox * prox * density * fade) continue;
          const pal = paletteFor(ny);
          cells.push({
            x: x * cell,
            y: y * cell,
            ny,
            prox: Math.min(prox, 1),
            phase: Math.random() * Math.PI * 2,
            speed: 0.6 + Math.random() * 1.2,
            colorBase: (Math.random() * pal.length) | 0,
            colorRate: 0.15 + Math.random() * 0.4,
          });
        }
      }
    };

    const drawFrame = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const ts = t * 0.001;
      for (const p of cells) {
        const twinkle = 0.5 + 0.5 * Math.sin(ts * p.speed + p.phase);
        const alpha = p.prox * (0.16 + 0.84 * twinkle);
        if (alpha < 0.03) continue;
        const pal = paletteFor(p.ny);
        const rgb = pal[(p.colorBase + Math.floor(ts * p.colorRate + p.phase)) % pal.length];
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

    let tries = 0;
    let retry: ReturnType<typeof setTimeout>;
    const attempt = () => {
      start();
      if (lastW === 0 && tries++ < 40) retry = setTimeout(attempt, 120);
    };

    const ro = new ResizeObserver(() => start());
    ro.observe(c);
    attempt();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(retry);
      ro.disconnect();
    };
  }, [side, tone, band, density]);

  return <canvas ref={ref} aria-hidden className={className} style={{ mixBlendMode: "screen" }} />;
}
