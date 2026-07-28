import type { ReactNode } from "react";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";

export const SELLER = "Eduardo Maciel Wanka";
export const CONTACT = "eduardo.wankax@gmail.com";
export const UPDATED = "28 July 2026";

export function LegalPage({
  active,
  title,
  intro,
  children,
}: {
  active: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active={active} />
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/50">legal</div>
          <h1 className="mt-3 font-display text-4xl font-light tracking-[-0.03em] text-foreground">{title}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{intro}</p>
          <p className="mt-6 font-mono text-[11.5px] text-muted-foreground/50">Last updated: {UPDATED}</p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-3xl px-6 py-14">{children}</section>
      <Footer />
    </div>
  );
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="mt-10 first:mt-0">
      <h2 className="font-display text-[22px] font-light tracking-[-0.02em] text-foreground">{heading}</h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
