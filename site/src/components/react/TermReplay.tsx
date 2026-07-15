import { useEffect, useRef } from "react";

type HeroLine = { kind: "prompt" | "tool" | "text"; text: string };
type HeroSession = { lines: HeroLine[] };

declare global {
  interface Window {
    HERO_SESSION?: HeroSession;
  }
}

export default function TermReplay() {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const data = window.HERO_SESSION;
    const body = bodyRef.current;
    if (!data || !body) return;

    body.textContent = "";
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function render(line: HeroLine, text: string) {
      const el = document.createElement("div");
      el.className = "tline " + line.kind;
      if (line.kind === "prompt") {
        const p = document.createElement("span");
        p.className = "p";
        p.textContent = "❯";
        el.appendChild(p);
        el.appendChild(document.createTextNode(" " + text));
      } else if (line.kind === "tool") {
        const t = document.createElement("span");
        t.className = "tk";
        t.textContent = "✓";
        el.appendChild(t);
        el.appendChild(document.createTextNode(" " + text));
      } else {
        el.textContent = text;
      }
      body.appendChild(el);
      return el;
    }

    if (reduced) {
      data.lines.forEach((line) => render(line, line.text));
      return;
    }

    let i = 0;
    function next() {
      if (i >= data!.lines.length) return;
      const line = data!.lines[i++];
      if (line.kind !== "prompt") {
        render(line, line.text);
        timers.push(setTimeout(next, 420));
        return;
      }
      const el = render(line, "");
      let j = 0;
      function type() {
        if (j < line.text.length) {
          el.appendChild(document.createTextNode(line.text[j++]));
          timers.push(setTimeout(type, 32));
        } else {
          timers.push(setTimeout(next, 520));
        }
      }
      type();
    }
    next();

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return <div className="body-2" id="termBody" ref={bodyRef} />;
}
