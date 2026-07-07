import { useMemo } from "react";

const TERM = `█████ █████ ████  █   █
  █   █     █   █ ██ ██
  █   ████  ████  █ █ █
  █   █     █  █  █   █
  █   █████ █   █ █   █`;

const CODER = ` ████  ███  ████  █████ ████
█     █   █ █   █ █     █   █
█     █   █ █   █ ████  ████
█     █   █ █   █ █     █  █
 ████  ███  ████  █████ █   █`;

const GLYPHS = ["·", "+", "✦", "*"];

export function Hero() {
  const stars = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        glyph: GLYPHS[i % GLYPHS.length]!,
        left: `${Math.random() * 96}%`,
        top: `${Math.random() * 90}%`,
        delay: `${Math.random() * 3.2}s`,
      })),
    [],
  );
  return (
    <div className="hero">
      <div className="stars" aria-hidden="true">
        {stars.map((s) => (
          <b key={s.id} style={{ left: s.left, top: s.top, animationDelay: s.delay }}>{s.glyph}</b>
        ))}
      </div>
      <div className="hero-art" aria-hidden="true">
        <pre className="hero-t">{TERM}</pre>
        <pre className="hero-c">{CODER}</pre>
      </div>
      <div className="hero-tag">your terminal coding agent</div>
    </div>
  );
}
