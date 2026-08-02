import type { ReactNode } from "react";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Section, Eyebrow, Heading, Lead } from "@/components/site/section";
import { Prose } from "@/components/site/prose";

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

      <Section bordered={false} className="pb-2">
        <Eyebrow>Legal</Eyebrow>
        <Heading level={1}>{title}</Heading>
        <Lead>{intro}</Lead>
        <p className="mt-6 font-mono text-[12px] text-muted-foreground">Last updated {UPDATED}</p>
      </Section>

      <Section>
        <Prose>{children}</Prose>
      </Section>

      <Footer />
    </div>
  );
}

// A Fragment, not a div: Prose styles h2 and p as DIRECT children of itself,
// so Clause must not interpose a wrapping element between them. React
// flattens Fragments away, which leaves the heading and every paragraph
// passed in as direct children of the Prose element that renders {children}.
export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <>
      <h2>{heading}</h2>
      {children}
    </>
  );
}
