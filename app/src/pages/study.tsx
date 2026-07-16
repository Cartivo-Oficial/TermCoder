import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Dither } from "@/components/dither";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COMMANDS: [string, string][] = [
  ["/flashcards <topic>", "generate a deck from anything"],
  ["/review", "front → reveal → grade 0–5"],
  ["/decks", "what is due, and your streak"],
  ["/quiz", "a practice exam on a topic"],
  ["/class join <gist>", "join a teacher's class"],
  ["/class submit <id>", "hand in an assignment"],
];

const SCHEDULE: [string, string, string][] = [
  ["5", "perfect", "in 6 days"],
  ["4", "easy", "in 4 days"],
  ["3", "correct, with effort", "in 2 days"],
  ["2", "wrong, but familiar", "tomorrow"],
  ["1", "wrong", "today, again"],
  ["0", "no idea", "today, again"],
];

function Row({ children }: { children: React.ReactNode }) {
  return <section className="border-t border-border py-16"><div className="mx-auto max-w-6xl px-6">{children}</div></section>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-study">{children}</p>;
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 max-w-[20ch] font-display text-3xl font-light leading-[1.1] tracking-[-0.03em] text-foreground sm:text-4xl">{children}</h2>;
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{children}</p>;
}

export default function Study() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav />

      <section className="relative overflow-hidden border-b border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-70" side="both" tone="cool" band={0.2} />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            <span className="text-study">❯</span> termexplorer · the tutor
          </p>
          <h1 className="mt-5 max-w-[14ch] font-display text-5xl font-light leading-[1] tracking-[-0.035em] text-foreground sm:text-6xl">
            A tutor is built in.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            The part no other coding agent has. Built because students shouldn&apos;t need a credit card to learn — and
            because copying an answer teaches nothing.
          </p>
        </div>
      </section>

      {/* one model change */}
      <Row>
        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            <Label>one model change</Label>
            <Title>From coder to tutor.</Title>
            <Body>
              Pick <span className="font-mono text-foreground">termexplorer/auto</span> and the whole personality changes —
              the prompt, the tools it reaches for, and the way it talks to you. It stops assuming you are a programmer,
              explains step by step in your language, and answers homework with worked steps instead of a solution to
              paste.
            </Body>
            <Body>
              Same install, same engine, same free model underneath. Nothing extra to download, and no separate account.
            </Body>
          </div>
          <div className="rounded-md border border-study/20 bg-[#0d0c0e] p-5 font-mono text-[12.5px] leading-relaxed">
            <div className="text-muted-foreground/50">/model</div>
            <div className="mt-3 space-y-1.5">
              <div className="text-muted-foreground/60">✦ termcoder AI</div>
              <div className="pl-3 text-muted-foreground/50">termcoder/auto <span className="text-muted-foreground/30">· ships code</span></div>
              <div className="pl-3 text-study">termexplorer/auto <span className="text-muted-foreground/50">· teaches it</span> ✓</div>
            </div>
            <div className="mt-4 border-t border-border pt-3 text-[11.5px] text-muted-foreground/60">
              In the desktop app it is a first-run choice: <span className="text-foreground">Code</span> or{" "}
              <span className="text-study">Study</span>.
            </div>
          </div>
        </div>
      </Row>

      {/* spaced repetition */}
      <Row>
        <Label>spaced repetition</Label>
        <Title>Cards come back at the right time.</Title>
        <Body>
          Generate a deck from any topic, then grade yourself honestly. A real SM-2 scheduler — the algorithm behind Anki —
          decides when each card returns: the ones you nearly forgot come back tomorrow, the ones you know drift weeks out.
        </Body>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-left">
              <thead>
                <tr className="border-b border-border font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
                  <th className="pb-2 font-normal">grade</th>
                  <th className="pb-2 font-normal">you said</th>
                  <th className="pb-2 font-normal">it returns</th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE.map(([g, said, back]) => (
                  <tr key={g} className="border-b border-border/60">
                    <td className="py-2.5 font-mono text-[13px] text-study">{g}</td>
                    <td className="py-2.5 text-[13px] text-muted-foreground">{said}</td>
                    <td className="py-2.5 font-mono text-[12px] text-muted-foreground/60">{back}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 font-mono text-[11.5px] text-muted-foreground/50">
              Intervals shown for a fresh card — the scheduler adapts per card, per person.
            </p>
          </div>
          <div className="rounded-md border border-study/20 bg-[#0d0c0e] p-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-study/70">card 3 / 8 · deck &ldquo;concurrency&rdquo;</div>
            <p className="mt-3 text-[15px] text-foreground">Why does a retry make a race worse?</p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
              It adds a second writer to the same window — the loser overwrites the winner.
            </p>
            <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 font-mono text-[12px]">
              <span className="text-muted-foreground/60">how well did you know it?</span>
              <span className="ml-auto text-study">0 1 2 3 4 5</span>
            </div>
          </div>
        </div>
      </Row>

      {/* progress */}
      <Row>
        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            <Label>progress</Label>
            <Title>A streak you can actually keep.</Title>
            <Body>
              Reviews a day and consecutive days, counted on your machine — not on a dashboard we own. Sync it to your own
              private gist and your streak follows you to another computer.
            </Body>
          </div>
          <div className="rounded-md border border-study/20 bg-card p-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-study">this week</div>
            <div className="mt-5 flex items-end gap-1.5">
              {[3, 5, 2, 6, 4, 7, 5].map((h, i) => <span key={i} className="flex-1 rounded-sm bg-study/70" style={{ height: h * 8 }} />)}
            </div>
            <div className="mt-3 flex justify-between font-mono text-[10.5px] text-muted-foreground/50"><span>mon</span><span>sun</span></div>
            <div className="mt-5 space-y-1.5 border-t border-border pt-4 font-mono text-[12.5px]">
              <div className="flex justify-between"><span className="text-muted-foreground">streak</span><span className="text-study">6 days</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">due today</span><span className="text-foreground">12 cards</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">scheduler</span><span className="text-foreground">SM-2</span></div>
            </div>
          </div>
        </div>
      </Row>

      {/* not just coders */}
      <Row>
        <Label>not just coders</Label>
        <Title>Bring it to your next study session.</Title>
        <Body>
          It is a terminal tool, but the tutor does not assume you write code. Ask it about history, biology or calculus
          and you get the same patient explanation, the same flashcards, and the same streak. The desktop app hides the
          developer panels when you choose Study, so it stops looking like an IDE.
        </Body>
        <div className="mt-8 grid gap-x-10 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {COMMANDS.map(([c, d]) => (
            <div key={c} className="flex items-baseline gap-3 border-b border-border/60 py-2.5">
              <code className="font-mono text-[12.5px] text-study">{c}</code>
              <span className="truncate text-[11.5px] text-muted-foreground/60">{d}</span>
            </div>
          ))}
        </div>
      </Row>

      {/* classrooms */}
      <Row>
        <Label>classrooms · live rooms</Label>
        <Title>Learn together — with no server to run.</Title>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="border-l-2 border-study/40 pl-6">
            <h3 className="font-display text-xl font-normal tracking-tight text-foreground">A class is a gist.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The teacher creates a class, shares packs of agents and skills, sets assignments and grades submissions with
              feedback. Joins, submissions and the roster ride on gist comments, so it works asynchronously — nothing to
              host, nothing to pay for, and it survives the school firewall.
            </p>
          </div>
          <div className="border-l-2 border-study/40 pl-6">
            <h3 className="font-display text-xl font-normal tracking-tight text-foreground">Rooms are peer to peer.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Share a link and someone joins your session — voice, camera, screen share and chat, straight between the two
              of you over STUN. No media server in the middle. Joining is always free; only hosting a room for more than
              one guest needs a licence.
            </p>
          </div>
        </div>
      </Row>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground sm:text-4xl">
            One install. Both minds.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Free forever for a student — no card, no key, no account.
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
