import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Section, Eyebrow, Heading, Lead } from "@/components/site/section";
import { RELEASES, inlineMd } from "@/lib/changelog";

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${month} ${d}, ${y}`;
}

export default function Changelog() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="changelog" />

      <Section bordered={false} className="pb-2">
        <Eyebrow>Changelog</Eyebrow>
        <Heading level={1}>What&apos;s new.</Heading>
        <Lead>
          Every release, newest first — what changed in the engine, the CLI, the desktop app and the site. Written
          for people who want to know exactly what moved.
        </Lead>
        <p className="mt-6 font-mono text-[12px] text-muted-foreground">
          {RELEASES.length} releases · latest {RELEASES[0]?.version} · {fmtDate(RELEASES[0]?.date ?? "")}
        </p>
      </Section>

      <Section>
        {RELEASES.map((r) => (
          <article
            key={r.version}
            className="grid gap-6 border-b border-border py-12 first:pt-0 last:border-0 lg:grid-cols-[220px_1fr]"
          >
            <header className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="font-mono text-[26px] font-medium tracking-tight text-foreground">{r.version}</h2>
              <p className="mt-1.5 font-mono text-[12px] text-muted-foreground">{fmtDate(r.date)}</p>
            </header>

            <div>
              {r.intro && (
                <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{r.intro}</p>
              )}
              {r.areas.map((a) => (
                <section key={a.name} className="mb-7 last:mb-0">
                  <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {a.name}
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {a.items.map((item, i) => (
                      <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed text-muted-foreground">
                        <span className="mt-2 h-1 w-1 flex-none rounded-full bg-border" />
                        <span dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </Section>

      <Footer />
    </div>
  );
}
