import { useState, useEffect } from "react";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Dither } from "@/components/dither";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readSession, type Session } from "@/lib/session";
import { openCheckout, payConfigured } from "@/lib/paddle";

const FREE: string[] = [
  "The full coding agent — every model, every provider",
  "Sub-agents, skills, memory, retrieval, checkpoints",
  "The study tutor, flashcards and the SM-2 scheduler",
  "Join any live room or classroom — unlimited",
  "Desktop app, CLI and the session viewer",
  "The source, MIT — fork it, ship it, sell it",
];

const PRO: string[] = [
  "Host a live room for more than one guest",
  "Run a classroom — roster, assignments, grading",
  "Sync your sessions across machines",
];

const MATRIX: [string, string, boolean][] = [
  ["Use the agent, on any model", "free", false],
  ["Learn with the tutor", "free", false],
  ["Join a room someone else hosts", "free", false],
  ["Join a classroom as a student", "free", false],
  ["Host a room, one guest", "free", false],
  ["Host a room, more than one guest", "pro", true],
  ["Teach a classroom", "pro", true],
  ["Sync across machines", "pro", true],
];

function Row({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">{children}</p>;
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3 max-w-[20ch] font-display text-3xl font-light leading-[1.1] tracking-[-0.03em] text-foreground sm:text-4xl">
      {children}
    </h2>
  );
}

function Check({ tone = "warm" }: { tone?: "warm" | "cool" }) {
  return <span className={cn("select-none", tone === "cool" ? "text-study" : "text-primary")}>✓</span>;
}

export default function Pricing() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => setSession(readSession()), []);

  const getPro = () => {
    const s = readSession();
    if (!s || !payConfigured()) {
      location.href = "login.html";
      return;
    }
    void openCheckout(s).catch(() => {
      location.href = "login.html";
    });
  };

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="pricing" />

      <section className="relative overflow-hidden border-b border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-70" side="both" tone="seam" band={0.2} />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            <span className="text-primary">❯</span> pricing
          </p>
          <h1 className="mt-5 max-w-[15ch] font-display text-5xl font-light leading-[1] tracking-[-0.035em] text-foreground sm:text-6xl">
            The host pays. Everyone else joins free.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            The agent, the tutor and the source are free forever — no key, no account, no quota. One person
            pays only when they lead: a teacher running a class, a lead hosting a room.
          </p>
        </div>
      </section>

      {/* the asymmetric price block — Free is the product, Pro is the support column */}
      <Row>
        <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr]">
          <div className="rounded-lg border border-border bg-card p-8">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60">free</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-5xl font-light tracking-[-0.04em] text-foreground">$0</span>
                  <span className="font-mono text-[13px] text-muted-foreground/60">/ forever</span>
                </div>
              </div>
              <p className="max-w-[22ch] text-right font-mono text-[11.5px] leading-relaxed text-muted-foreground/50">
                not a trial, not a seat count, not a token budget
              </p>
            </div>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Everything one person needs, and everything a person joining someone else needs. This is the
              whole product — Pro does not unlock a better agent, because there isn&apos;t one.
            </p>
            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {FREE.map((f) => (
                <li key={f} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="download.html" className={cn(buttonVariants(), "h-11 rounded-md px-5 font-mono text-[14px] shadow-[0_14px_44px_-14px] shadow-primary/70")}>
                Download the app →
              </a>
              <a href="install.html" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-md px-5 font-mono text-[14px]")}>
                Install the CLI
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-study/25 bg-[#0d0c0e] p-8">
            <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-40" side="field" tone="cool" band={0.55} />
            <div className="relative">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-study">pro · for whoever leads</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-5xl font-light tracking-[-0.04em] text-foreground">$9</span>
                <span className="font-mono text-[13px] text-muted-foreground/60">/ month</span>
              </div>
              <p className="mt-5 text-[14px] leading-relaxed text-muted-foreground">
                One teacher pays; thirty students don&apos;t. That is the whole deal — and it is how the project
                gets funded without putting the agent itself behind a card.
              </p>
              <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
                {PRO.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
                    <Check tone="cool" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={getPro}
                className={cn(buttonVariants({ variant: "outline" }), "mt-7 h-11 w-full rounded-md border-study/40 font-mono text-[14px] text-study hover:bg-study/10")}
              >
                {session ? "Get Pro" : "Sign in to get Pro"}
              </button>
              <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground/60">
                One year, paid once — Pix, card or PayPal. Your key lands in your{" "}
                <a href="dashboard.html" className="text-study underline underline-offset-2">dashboard</a>.
              </p>
            </div>
          </div>
        </div>
      </Row>

      {/* who pays — the room diagram */}
      <Row>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <Label>one licence, one room</Label>
            <Title>Nobody you invite ever sees a paywall.</Title>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Rooms are peer to peer — voice, camera and screen go straight between you over STUN, with no
              media server in the middle. So there is no per-seat cost to pass on, and we don&apos;t invent one.
              Your students join with the same free install everyone else has.
            </p>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              A guest never needs an account, a key or a licence — just the link.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/50">a room in session</div>
            <div className="mt-6 flex flex-wrap items-start gap-3">
              <div className="flex-1 rounded-md border border-primary/40 bg-primary/5 p-4">
                <div className="font-mono text-[11px] uppercase tracking-widest text-primary">host</div>
                <div className="mt-2 text-[13.5px] text-foreground">pays $9 / month</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground/60">one licence</div>
              </div>
              {["guest", "guest", "guest"].map((g, i) => (
                <div key={i} className="flex-1 rounded-md border border-border p-4">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">{g}</div>
                  <div className="mt-2 text-[13.5px] text-study">free</div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground/60">just the link</div>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t border-border pt-5 font-mono text-[11.5px] leading-relaxed text-muted-foreground/60">
              Hosting one guest is free too — the licence starts at the third person in the room.
            </p>
          </div>
        </div>
      </Row>

      {/* the honest matrix */}
      <Row>
        <Label>what actually costs money</Label>
        <Title>The whole list, no asterisks.</Title>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[460px] text-left">
            <thead>
              <tr className="border-b border-border font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
                <th className="pb-2 font-normal">what you want to do</th>
                <th className="w-32 pb-2 font-normal">what it costs</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(([what, cost, paid]) => (
                <tr key={what} className="border-b border-border/60">
                  <td className="py-2.5 text-[13.5px] text-muted-foreground">{what}</td>
                  <td className={cn("py-2.5 font-mono text-[12px]", paid ? "text-study" : "text-primary")}>{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5 max-w-xl font-mono text-[12px] leading-relaxed text-muted-foreground/60">
          If you bring your own provider key, that bill is between you and them — we never take a cut and
          never proxy your prompts.
        </p>
      </Row>

      {/* open core */}
      <Row>
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div className="border-l-2 border-primary/40 pl-6">
            <h3 className="font-display text-xl font-normal tracking-tight text-foreground">The core stays open.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              MIT, in the open, and the solo experience will always be free — no key, no account, no quota.
              If we ever disappeared, the agent on your machine would keep working, and the fork would be
              legal on day one.
            </p>
          </div>
          <div className="border-l-2 border-study/40 pl-6">
            <h3 className="font-display text-xl font-normal tracking-tight text-foreground">Why charge at all, then?</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Because someone has to keep it alive, and we would rather that be a team lead expensing $9 than
              a student who cannot. Collaboration is the one thing worth paying for — so that is the one
              thing we charge for.
            </p>
          </div>
        </div>
      </Row>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground sm:text-4xl">
            Start with the free one.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            It is the same agent. You will know soon enough whether you ever need to host anything.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href="download.html" className={cn(buttonVariants(), "h-11 rounded-md px-5 font-mono text-[14px] shadow-[0_14px_44px_-14px] shadow-primary/70")}>
              Get the app →
            </a>
            <a href="install.html" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-md px-5 font-mono text-[14px]")}>
              Install the CLI
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
