import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Dither } from "@/components/dither";
import { RELEASES, inlineMd } from "@/lib/changelog";
import { cn } from "@/lib/utils";

const AREA_TONE: Record<string, string> = {
  Core: "text-primary",
  CLI: "text-primary",
  Desktop: "text-primary",
  Website: "text-study",
  Study: "text-study",
};

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

      <section className="relative overflow-hidden border-b border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-70" side="both" tone="seam" band={0.2} />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            <span className="text-primary">❯</span> changelog
          </p>
          <h1 className="mt-5 font-display text-5xl font-light tracking-[-0.035em] text-foreground sm:text-6xl">
            What&apos;s new.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            Every release, newest first — what changed in the engine, the CLI, the desktop app and the site. Written for
            people who want to know exactly what moved.
          </p>
          <p className="mt-6 font-mono text-[12px] text-muted-foreground/60">
            {RELEASES.length} releases · latest {RELEASES[0]?.version} · {fmtDate(RELEASES[0]?.date ?? "")}
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        {RELEASES.map((r) => (
          <article key={r.version} className="grid gap-6 border-b border-border py-12 first:pt-0 last:border-0 lg:grid-cols-[220px_1fr]">
            <header className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="font-display text-3xl font-light tracking-tight text-foreground">
                <span className="bg-gradient-to-r from-[#ff7a45] to-[#31d0b4] bg-clip-text text-transparent">{r.version}</span>
              </h2>
              <p className="mt-1.5 font-mono text-[12px] text-muted-foreground/60">{fmtDate(r.date)}</p>
            </header>

            <div>
              {r.intro && (
                <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{r.intro}</p>
              )}
              {r.areas.map((a) => (
                <section key={a.name} className="mb-7 last:mb-0">
                  <h3 className={cn("font-mono text-[11px] uppercase tracking-widest", AREA_TONE[a.name] ?? "text-muted-foreground")}>
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
      </main>

      <Footer />
    </div>
  );
}
