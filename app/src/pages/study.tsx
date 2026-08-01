import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import appShot from "@/assets/app-hero.png";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Section, Eyebrow, Heading, Lead } from "@/components/site/section";
import { CardGrid } from "@/components/site/card-grid";
import { Screenshot } from "@/components/site/screenshot";
import { FeatureBlock } from "@/components/site/feature-block";
import { Glyph, IconTile } from "@/components/site/glyph";
import { ArrowLink, InlineLink } from "@/components/site/arrow-link";

const FACTS = ["SM-2 scheduler", "grades 0–5", "11 languages", "MIT"];

// Straight from COMMANDS in packages/tui/src/commands.ts and the /class
// subcommands the handler actually accepts. There is no /quiz — the tutor
// writes practice questions in the conversation, but no command spawns one.
const COMMANDS: [string, string][] = [
  ["/flashcards <topic>", "make a deck about anything"],
  ["/review [deck]", "reveal, then grade yourself 0–5"],
  ["/decks", "what is due, and your streak"],
  ["/class join <code>", "join a teacher's class"],
  ["/class submit <id>", "hand in an assignment"],
  ["/sync", "decks and progress to your own gist"],
];

// The grades and their labels are the ones the app prints; the effect on the
// card is what schedule() in packages/core/src/study/decks.ts does with them.
const GRADES: [string, string, string][] = [
  ["0–2", "blackout, or wrong", "back tomorrow, and the run of correct answers resets to zero"],
  ["3", "hard", "counts as correct — but the card's ease drops by 0.14"],
  ["4", "good", "counts as correct — the ease holds where it is"],
  ["5", "easy", "counts as correct — the ease rises by 0.10"],
];

// A card answered "good" every time, with the ease left at its 2.5 default.
const LADDER: [string, string][] = [
  ["1st correct answer", "tomorrow"],
  ["2nd", "in 6 days"],
  ["3rd", "in 15 days"],
  ["4th", "in 38 days"],
  ["5th", "in 95 days"],
];

// Decorative only — the numbers underneath carry the meaning. Heights are an
// example of what a week of reviews looks like, not a measurement of anyone's.
const EXAMPLE_WEEK = [3, 5, 2, 6, 4, 7, 5];

const TOGETHER: [string, string, string][] = [
  [
    "people",
    "A class is a private gist",
    "The teacher creates a class and it becomes one private gist in their own GitHub account: the manifest holds the name, the assignments and the packs of agents and skills students get on joining. Joins, submissions and grades are gist comments, so the roster and the marks are just a thread — asynchronous, nothing to host, and it survives the school firewall. Creating a class, posting an assignment and grading a submission need a Pro licence; joining, submitting and reading your grade never do.",
  ],
  [
    "route",
    "A live room is peer to peer",
    "Open a room and the app on your machine hands out an invite link on your local network. Someone opens it and lands in your session — chat, voice, camera and screen share travel straight between the two of you, discovered through a public STUN server. There is no media server in the middle and no relay: nothing of ours ever sees the stream.",
  ],
];

const CARD = "rounded-xl border border-border bg-card p-6";
const PANEL = "rounded-xl border border-border bg-muted p-5 font-mono text-[12.5px] leading-relaxed";
const CARD_TITLE = "text-[15px] font-medium tracking-tight text-foreground";
const SUBHEAD = "text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.025em] text-foreground";
const BTN = "h-11 rounded-lg px-5 text-[14px]";

export default function Study() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="study" />

      {/* ── 01 · hero ────────────────────────────────────────────────── */}
      <Section bordered={false} className="pb-2">
        <Eyebrow>The tutor</Eyebrow>
        <Heading level={1}>A tutor is built in.</Heading>
        <Lead>
          The part no other coding agent has. Built because students shouldn&apos;t need a credit card to learn — and
          because copying an answer teaches nothing. Same install, same engine, one model away.
        </Lead>
        <p className="mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
          {FACTS.map((f, i) => (
            <span key={f} className="inline-flex items-center gap-2.5">
              {i > 0 && <span aria-hidden>·</span>}
              {f}
            </span>
          ))}
        </p>
      </Section>

      {/* ── 02 · anchor shot ─────────────────────────────────────────── */}
      <Section bordered={false} className="pt-0">
        <Screenshot
          src={appShot}
          width={1034}
          height={740}
          priority
          alt="The TermCoder desktop app: the session rail on the left, the Chat and Terminal tabs across the top, and the composer with the model picker at the bottom."
          caption="The window the builder works in. Choosing Study closes the session rail and the agent chips and leaves the conversation."
        />
      </Section>

      {/* ── 03 · one model change ────────────────────────────────────── */}
      <Section>
        <FeatureBlock
          level={2}
          eyebrow="One model change"
          title="From coder to tutor."
          body="Pick termexplorer/auto and the system prompt is replaced end to end. It stops assuming you are a programmer, explains step by step in your language, and hands homework back as worked reasoning instead of a solution to paste. It stops indexing your repository too, because the thing you are studying is usually not in it. Underneath, the same router picks the same free model — nothing extra to download, no separate account."
        >
          <div className={PANEL}>
            <div className="text-muted-foreground"><span aria-hidden>❯</span> /model</div>
            <div className="mt-3 space-y-1.5">
              <div className="text-muted-foreground"><span aria-hidden>✦</span> termcoder AI — our models</div>
              <div className="pl-3 text-foreground">
                termcoder/auto <span className="text-muted-foreground">· best available</span>
              </div>
              <div className="pl-3 text-foreground">
                termexplorer/auto <span className="text-muted-foreground">· study &amp; schoolwork tutor</span>{" "}
                <span aria-hidden>✓</span>
              </div>
            </div>
            <p className="mt-5 border-t border-border pt-4 font-sans text-[13px] leading-relaxed text-muted-foreground">
              In the desktop app it is the first thing it asks —{" "}
              <span className="text-foreground">Code</span> or <span className="text-foreground">Study</span> — and a
              switch in Settings afterwards.
            </p>
          </div>
        </FeatureBlock>
      </Section>

      {/* ── 04 · spaced repetition ───────────────────────────────────── */}
      <Section>
        <Eyebrow>Spaced repetition</Eyebrow>
        <Heading>Cards come back at the right time.</Heading>
        <Lead>
          Ask for a deck on any topic and it writes eight cards. Then <span className="text-foreground">/review</span>{" "}
          shows you a front, waits for you to press space, shows the back, and asks how well you knew it. SM-2 — the
          algorithm behind Anki — takes that number and decides when the card comes back.
        </Lead>
        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className={SUBHEAD}>What the number does.</h3>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[380px] text-left">
                <thead>
                  <tr className="border-b border-border text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="pb-3 font-medium">you press</th>
                    <th className="pb-3 font-medium">it means</th>
                    <th className="pb-3 font-medium">what happens</th>
                  </tr>
                </thead>
                <tbody>
                  {GRADES.map(([g, means, effect]) => (
                    <tr key={g} className="border-b border-border">
                      <td className="py-3 pr-4 font-mono text-[13px] text-foreground">{g}</td>
                      <td className="py-3 pr-4 text-[13px] text-muted-foreground">{means}</td>
                      <td className="py-3 text-[13px] text-muted-foreground">{effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
              Anything under 3 sends the card back to the start of the ladder, so a card you nearly had still returns
              tomorrow. Ease has a floor of 1.3 — a card can get harder for you, but it can never collapse to zero.
            </p>
          </div>
          <div>
            <h3 className={SUBHEAD}>How far it drifts.</h3>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
              Every card starts due immediately. Answer it <span className="text-foreground">good</span> each time and
              the gap is one day, then six, then the last gap multiplied by the card&apos;s ease.
            </p>
            <div className={cn(PANEL, "mt-6")}>
              <ol className="space-y-1.5">
                {LADDER.map(([nth, when]) => (
                  <li key={nth} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{nth}</span>
                    <span className="text-foreground">{when}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 border-t border-border pt-3 font-sans text-[13px] leading-relaxed text-muted-foreground">
                Ninety-five days out by the fifth time you get it right — which is the whole point of not reviewing
                everything every night.
              </p>
            </div>
          </div>
        </div>

        <div className={cn(PANEL, "mt-10 max-w-[52ch] font-sans text-[14px]")}>
          <div className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground">
            card 3 / 8 · deck &ldquo;concurrency&rdquo;
          </div>
          <p className="mt-4 text-[15px] text-foreground">Why does a retry make a race worse?</p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            It adds a second writer to the same window — the loser overwrites the winner.
          </p>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border pt-4 font-mono text-[12px]">
            <span className="text-muted-foreground">how well did you know it?</span>
            <span className="text-foreground">0 1 2 3 4 5</span>
          </div>
        </div>
      </Section>

      {/* ── 05 · progress ────────────────────────────────────────────── */}
      <Section>
        <FeatureBlock
          level={2}
          reverse
          eyebrow="Progress"
          title="A streak you can actually keep."
          body="Reviews a day and consecutive days, counted in a JSON file on your machine — not on a dashboard we own. A day you review keeps the streak; a day you skip starts it again at one. /sync mirrors your decks and your progress to one private gist in your own GitHub account, so the streak follows you to another computer without anything of ours in the middle."
        >
          <div className={PANEL}>
            <div className="text-muted-foreground"><span aria-hidden>❯</span> /decks</div>
            {/* An illustration of the readout, not a record of anyone's week —
                the bars are aria-hidden and every number is repeated in text. */}
            <p className="mt-4 font-sans text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
              Example — reviews per day
            </p>
            <div aria-hidden className="mt-3 flex h-14 items-end gap-1.5">
              {EXAMPLE_WEEK.map((h, i) => (
                <span key={i} className="flex-1 rounded-sm bg-foreground/80" style={{ height: `${h * 14}%` }} />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>mon</span>
              <span>sun</span>
            </div>
            <dl className="mt-5 space-y-1.5 border-t border-border pt-4">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">streak</dt>
                <dd className="text-foreground">6 days</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">due today</dt>
                <dd className="text-foreground">12 cards</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">scheduler</dt>
                <dd className="text-foreground">SM-2</dd>
              </div>
            </dl>
          </div>
        </FeatureBlock>
      </Section>

      {/* ── 06 · not just coders ─────────────────────────────────────── */}
      <Section>
        <Eyebrow>Not just coders</Eyebrow>
        <Heading>Bring it to your next study session.</Heading>
        <Lead>
          It is a terminal tool, but the tutor does not assume you write code. Ask it about history, biology or
          calculus and you get the same patient explanation, the same decks and the same streak — and it answers in
          the language you asked in, out of the eleven the interface itself speaks.
        </Lead>
        <div className="mt-10 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {COMMANDS.map(([c, d]) => (
            <div key={c} className="flex items-baseline gap-3 border-b border-border py-3">
              <code className="font-mono text-[13px] text-foreground">{c}</code>
              <span className="truncate text-[12px] text-muted-foreground">{d}</span>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
          The desktop app puts the same three behind a panel — type a topic, get a deck, review it — so nobody has to
          learn a command to start.{" "}
          <InlineLink href="docs.html">The rest of the commands are in the docs</InlineLink>.
        </p>
      </Section>

      {/* ── 07 · together ────────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Classrooms and live rooms</Eyebrow>
        <Heading>Learn together, on infrastructure you already have.</Heading>
        <Lead>
          Two ways to bring someone else in, neither of which asks anyone to run a server. One rides on a gist in the
          teacher&apos;s GitHub account; the other never leaves the room you are both sitting in.
        </Lead>
        <CardGrid cols={2}>
          {TOGETHER.map(([icon, title, body]) => (
            <div key={title} className={CARD}>
              <IconTile><Glyph name={icon} /></IconTile>
              <h3 className={cn(CARD_TITLE, "mt-4")}>{title}</h3>
              <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </CardGrid>
        <div className="mt-10">
          <ArrowLink href="pricing.html">What a Pro licence covers</ArrowLink>
        </div>
      </Section>

      {/* ── 08 · final cta ───────────────────────────────────────────── */}
      <Section className="text-center">
        <div className="mx-auto w-fit">
          <Heading>One install. Both minds.</Heading>
        </div>
        <p className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
          The tutor is MIT licensed and opens on a free model — no card, no key, no account.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a href="download.html" className={cn(buttonVariants(), BTN)}>Get the app</a>
          <a href="install.html" className={cn(buttonVariants({ variant: "outline" }), BTN)}>Install the CLI</a>
        </div>
      </Section>

      <Footer />
    </div>
  );
}
