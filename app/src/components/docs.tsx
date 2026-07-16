import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface NavGroup {
  group: string;
  items: [string, string][];
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-12 first:border-t-0 first:pt-0">
      <h2 className="font-display text-[26px] font-light tracking-[-0.03em] text-foreground sm:text-3xl">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-3 font-display text-lg font-normal tracking-tight text-foreground">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">{children}</p>;
}

export function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.88em] text-foreground">{children}</code>
  );
}

export function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-normal text-foreground">{children}</strong>;
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      {children}
    </a>
  );
}

export function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-[#0d0c0e] p-4 font-mono text-[12.5px] leading-relaxed text-[#d7d2cc]">
      {children}
    </pre>
  );
}

export function Cm({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/45">{children}</span>;
}

export function Pm({ children }: { children: React.ReactNode }) {
  return <span className="text-primary">{children}</span>;
}

export function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-study">{children}</span>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl rounded-md border border-border border-l-2 border-l-primary/50 bg-card px-5 py-4 text-[13.5px] leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="max-w-2xl space-y-2 text-[14.5px] leading-relaxed text-muted-foreground">{children}</ul>;
}

export function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="select-none text-primary/50">—</span>
      <span>{children}</span>
    </li>
  );
}

export function Ol({ children }: { children: React.ReactNode }) {
  return (
    <ol className="max-w-2xl list-decimal space-y-2 pl-5 text-[14.5px] leading-relaxed text-muted-foreground marker:font-mono marker:text-[12px] marker:text-primary/70">
      {children}
    </ol>
  );
}

export function Table({ head, children }: { head: [string, string]; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl overflow-x-auto">
      <table className="w-full min-w-[420px] text-left">
        <thead>
          <tr className="border-b border-border font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground/50">
            <th className="w-[34%] pb-2 font-normal">{head[0]}</th>
            <th className="pb-2 font-normal">{head[1]}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ k, children }: { k: React.ReactNode; children: React.ReactNode }) {
  return (
    <tr className="border-b border-border/60 align-top">
      <td className="py-2.5 pr-4 font-mono text-[12.5px] text-primary">{k}</td>
      <td className="py-2.5 text-[13px] leading-relaxed text-muted-foreground">{children}</td>
    </tr>
  );
}

const SPY_LINE = 88;

export function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    let queued = false;

    const compute = () => {
      queued = false;
      const line = window.scrollY + SPY_LINE;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= line) current = id;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) current = ids[ids.length - 1];
      setActive(current);
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      setTimeout(compute, 0);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);

  return active;
}

export function Sidebar({ nav, active }: { nav: NavGroup[]; active: string }) {
  return (
    <nav className="space-y-6">
      {nav.map(({ group, items }) => (
        <div key={group}>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/40">{group}</div>
          <ul className="mt-2 space-y-px">
            {items.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={cn(
                    "block border-l border-border py-1.5 pl-3 text-[13px] transition-colors",
                    active === id
                      ? "border-l-primary text-foreground"
                      : "text-muted-foreground/70 hover:border-l-muted-foreground/40 hover:text-foreground",
                  )}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
