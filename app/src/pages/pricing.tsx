import { useState, useEffect } from "react";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Section, Eyebrow, Heading, Lead } from "@/components/site/section";
import { FeatureBlock } from "@/components/site/feature-block";
import { FAQ } from "@/components/site/faq";
import { InlineLink } from "@/components/site/arrow-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readSession, type Session } from "@/lib/session";
import { openCheckout, payConfigured } from "@/lib/paddle";

const FACTS = ["$0 to use", "$9 for the host", "one year, never renews", "MIT"];

// Everything outside the three licence gates in packages/server/src/server.ts.
// Nothing in the provider or model path checks a licence, so "Pro does not
// unlock a better agent" is a statement about the code, not a promise.
const FREE: string[] = [
  "The full coding agent — twelve providers, seventeen tools",
  "Sub-agents, skills, memory, retrieval, checkpoints",
  "The study tutor, flashcards and the SM-2 scheduler",
  "Join any live room or classroom someone else hosts",
  "Decks, drafts, favourites and progress synced to your own gist",
  "Desktop app, CLI and the session viewer",
  "The source, MIT — fork it, ship it, sell it",
];

// The complete list of licence checks in the product: server.ts:1262 (the
// third socket in a room), server.ts:590 (classroom create, assign, grade)
// and server.ts:1057 (session sync). There is no fourth.
const PRO: string[] = [
  "Host a live room for more than one guest",
  "Run a classroom — roster, assignments, grading",
  "Sync your sessions across machines",
];

const MATRIX: [string, boolean][] = [
  ["Use the agent, on any model", true],
  ["Learn with the tutor", true],
  ["Join a room someone else hosts", true],
  ["Join a classroom, submit work, read your grade", true],
  ["Host a room with one guest", true],
  ["Sync decks, drafts and progress to your gist", true],
  ["Host a room with more than one guest", false],
  ["Create a class, set assignments, grade them", false],
  ["Sync your sessions across machines", false],
];

const FAQ_ITEMS = [
  {
    q: "Does it renew?",
    a: "No. A licence is one payment of 9 USD covering one year from the date of purchase. It is not a subscription, there is nothing to cancel, and you are never charged a second time.",
  },
  {
    q: "What happens when the year ends?",
    a: "The three Pro features stop and everything else carries on exactly as before. The agent, the tutor, your decks, your sessions and your memory are on your machine under the MIT licence, and none of them check a key.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes — within 30 days, no questions asked. Paddle is the merchant of record and returns the money to the original payment method.",
  },
  {
    q: "Do the people I invite need to pay?",
    a: "No. The licence is per host: guests joining your room and students in your class never need a licence, an account or a key of their own.",
  },
  {
    q: "How does the key reach me?",
    a: "Immediately, and digitally. After checkout the key appears in your dashboard on this site; you paste it into the app under Settings to activate Pro. Activating a licence needs TermCoder 0.11.5 or newer.",
  },
];

const CARD = "rounded-xl border border-border bg-card p-6";
const PANEL = "rounded-xl border border-border bg-muted p-5";
const CARD_TITLE = "text-[15px] font-medium tracking-tight text-foreground";
const SUBHEAD = "text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.025em] text-foreground";
const BTN = "h-11 rounded-lg px-5 text-[14px]";

export default function Pricing() {
  const [session, setSession] = useState<Session | null>(null);
  const [payReady, setPayReady] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setSession(readSession());
    setPayReady(payConfigured());
  }, []);

  const getPro = () => {
    if (!payConfigured()) {
      setNotice("Checkout isn't live yet. The app already activates licence keys under Settings, so a key issued today works today.");
      return;
    }
    const s = readSession();
    if (!s) {
      location.href = "login.html";
      return;
    }
    setNotice("");
    void openCheckout(s).catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : "";
      setNotice(
        reason.includes("sign in")
          ? "Your sign-in is out of date. Please sign out and back in, then try again."
          : "Could not open the checkout window. Please try again in a moment.",
      );
    });
  };

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="pricing" />

      {/* ── 01 · hero ────────────────────────────────────────────────── */}
      <Section bordered={false} className="pb-2">
        <Eyebrow>Pricing</Eyebrow>
        <Heading level={1}>The host pays. Everyone else joins free.</Heading>
        <Lead>
          The agent, the tutor and the source are free — no key, no account, no quota. One person pays only
          when they lead: a teacher running a class, a lead hosting a room.
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

      {/* ── 02 · the two plans ───────────────────────────────────────── */}
      {/* Asymmetric on purpose: Free is the product, Pro is the column that
          funds it, so the grid gives Free the wider half. */}
      <Section>
        <Eyebrow>Two plans</Eyebrow>
        <Heading>One of them is the whole product.</Heading>
        <Lead>
          Pro does not unlock a better agent, because there isn&apos;t one. It unlocks three things, all of
          them about bringing other people in.
        </Lead>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className={CARD}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div>
                <h3 className={cn(CARD_TITLE, "uppercase tracking-[0.14em] text-muted-foreground")}>Free</h3>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-[clamp(36px,5vw,52px)] font-semibold leading-none tracking-[-0.03em] text-foreground">
                    $0
                  </span>
                  <span className="text-[14px] text-muted-foreground">forever</span>
                </p>
              </div>
              <p className="max-w-[24ch] text-[13px] leading-relaxed text-muted-foreground">
                Not a trial, not a seat count, not a token budget.
              </p>
            </div>
            <p className="mt-6 max-w-[56ch] text-[15px] leading-relaxed text-muted-foreground">
              Everything one person needs, and everything a person joining someone else needs. This is the whole
              product — the same engine, the same models, the same tools.
            </p>
            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {FREE.map((f) => (
                <li key={f} className="flex gap-2.5 text-[14px] leading-relaxed text-muted-foreground">
                  <span aria-hidden className="flex-none text-ok">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="download.html" className={cn(buttonVariants(), BTN)}>Get the app</a>
              <a href="install.html" className={cn(buttonVariants({ variant: "outline" }), BTN)}>Install the CLI</a>
            </div>
          </div>

          <div className={CARD}>
            <h3 className={cn(CARD_TITLE, "uppercase tracking-[0.14em] text-muted-foreground")}>
              Pro · for whoever leads
            </h3>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-[clamp(36px,5vw,52px)] font-semibold leading-none tracking-[-0.03em] text-foreground">
                $9
              </span>
              <span className="text-[14px] text-muted-foreground">one payment, one year</span>
            </p>
            <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
              One teacher pays; thirty students don&apos;t. That is the whole deal — and it is how the project
              gets funded without putting the agent itself behind a card.
            </p>
            <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
              {PRO.map((p) => (
                <li key={p} className="flex gap-2.5 text-[14px] leading-relaxed text-muted-foreground">
                  <span aria-hidden className="flex-none text-foreground">→</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <button onClick={getPro} className={cn(buttonVariants(), BTN, "mt-8 w-full")}>
              {!payReady ? "Checkout opens soon" : session ? "Get Pro" : "Sign in to get Pro"}
            </button>
            {notice && (
              <p className={cn(PANEL, "mt-4 text-[13px] leading-relaxed text-muted-foreground")} role="status">
                {notice}
              </p>
            )}
            <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
              Paddle is the merchant of record and handles the payment, the tax and the invoice. Your key appears
              in your <InlineLink href="dashboard.html">dashboard</InlineLink> straight after checkout, and you
              paste it into the app under Settings.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              It never renews. <InlineLink href="refunds.html">Thirty days to change your mind</InlineLink>, no
              questions asked.
            </p>
          </div>
        </div>
      </Section>

      {/* ── 03 · who pays ────────────────────────────────────────────── */}
      <Section>
        <FeatureBlock
          level={2}
          eyebrow="One licence, one room"
          title="Nobody you invite ever sees a paywall."
          body="Rooms are peer to peer — voice, camera and screen go straight between you, discovered through a public STUN server, with no media server and no relay in the middle. So there is no per-seat cost to pass on, and we don't invent one. A guest needs the link and nothing else: no account, no key, no licence of their own."
        >
          <div className={PANEL}>
            <p className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground">
              A room in session
            </p>
            <div className="mt-5 flex flex-wrap items-start gap-3">
              <div className="min-w-[7rem] flex-1 rounded-lg border border-border bg-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">host</p>
                <p className="mt-2 text-[14px] text-foreground">pays $9 once</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">one licence</p>
              </div>
              {["guest", "guest", "guest"].map((g, i) => (
                <div key={i} className="min-w-[7rem] flex-1 rounded-lg border border-border p-4">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{g}</p>
                  <p className="mt-2 text-[14px] text-foreground">free</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">just the link</p>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t border-border pt-5 text-[13px] leading-relaxed text-muted-foreground">
              Hosting one guest is free too — the licence starts at the third person in the room.
            </p>
          </div>
        </FeatureBlock>
      </Section>

      {/* ── 04 · the matrix ──────────────────────────────────────────── */}
      {/* Every row says "included" or "needs Pro" in words; the tick and the
          cross are aria-hidden decoration on top of the label, so the table
          reads the same in monochrome or through a screen reader. */}
      <Section>
        <Eyebrow>What actually costs money</Eyebrow>
        <Heading>The whole list, no asterisks.</Heading>
        <Lead>
          Three licence checks exist in the product. These are all of them, and everything else on this page is
          on the free side of the line.
        </Lead>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left">
            <thead>
              <tr className="border-b border-border text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <th className="pb-3 font-medium">what you want to do</th>
                <th className="w-44 pb-3 font-medium">on the free install</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(([what, free]) => (
                <tr key={what} className="border-b border-border">
                  <td className="py-3 pr-4 text-[14px] text-muted-foreground">{what}</td>
                  <td className={cn("py-3 text-[13px]", free ? "text-ok" : "text-bad")}>
                    <span aria-hidden>{free ? "✓" : "✗"}</span> {free ? "included" : "needs Pro"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
          If you bring your own provider key, that bill is between you and them — we never take a cut and never
          proxy your prompts.
        </p>
      </Section>

      {/* ── 05 · open core ───────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Open core</Eyebrow>
        <Heading>Why charge for anything at all?</Heading>
        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className={SUBHEAD}>The core stays open.</h3>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
              MIT, in the open, and nothing in the solo path checks a key. If we disappeared tomorrow the agent
              on your machine would keep working, and the fork would be legal on day one —{" "}
              <InlineLink href="https://github.com/Cartivo-Oficial/TermCoder">the source is right here</InlineLink>.
            </p>
          </div>
          <div>
            <h3 className={SUBHEAD}>Someone has to keep it alive.</h3>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
              We would rather that be a team lead expensing $9 than a student who cannot. Collaboration is the
              one thing worth paying for, so it is the one thing we charge for.
            </p>
          </div>
        </div>
      </Section>

      {/* ── 06 · faq ─────────────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Questions</Eyebrow>
        <Heading>Before you spend anything.</Heading>
        <FAQ items={FAQ_ITEMS} />
      </Section>

      {/* ── 07 · final cta ───────────────────────────────────────────── */}
      <Section className="text-center">
        <div className="mx-auto w-fit">
          <Heading>Start with the free one.</Heading>
        </div>
        <p className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
          It is the same agent. You will know soon enough whether you ever need to host anything.
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
