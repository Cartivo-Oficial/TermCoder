import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Section, Eyebrow, Heading, Lead } from "@/components/site/section";

const STEPS: [string, string, string | null, string][] = [
  [
    "Install it",
    "One command on Windows, macOS or Linux. It adds two equivalent binaries — `term` and `termcoder`.",
    "npm install -g @termcoder/tui",
    "Needs Node 20 or newer. No Node? Grab the desktop app instead — it bundles its own.",
  ],
  [
    "Type term anywhere",
    "Open any project folder and run it. The first time in a folder it asks whether you trust it — it will not read anything until you say yes.",
    "term",
    "The trust prompt appears before the interface, once per folder.",
  ],
  [
    "Ask for the change",
    "Plain language. It reads the repo, plans, edits with minimal diffs, runs your tests, and shows the diff before applying anything that touches your machine.",
    "❯ add a --version flag and run the tests",
    "Nothing to configure — it opens on a free, keyless model.",
  ],
  [
    "Bring a better model (optional)",
    "The free model is a fine on-ramp, but it is small and gets busy. Connect a provider whenever you want — or sign in with a subscription instead of paying per token.",
    "/setup",
    "`/key <provider> <key>` sets one directly · `/login-claude` uses a Claude Pro/Max subscription (experimental).",
  ],
];

const INSTALL = "npm install -g @termcoder/tui";
const SUBHEAD = "text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.025em] text-foreground";
const CMD_BOX =
  "mt-4 inline-flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-border bg-muted px-3.5 py-2.5 font-mono text-[13px]";
const BTN = "h-11 rounded-lg px-5 text-[14px]";

function withInlineCode(text: string) {
  return text.split(/`([^`]+)`/).map((part, j) =>
    j % 2 === 1 ? (
      <span key={j} className="font-mono text-[0.9em] text-foreground">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export default function Install() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="install" />

      {/* ── 01 · hero ────────────────────────────────────────────────── */}
      <Section bordered={false} className="pb-2">
        <Eyebrow>Install</Eyebrow>
        <Heading level={1}>One command, every platform.</Heading>
        <Lead>No account, no API key, no config file. Install it and ask it something — that is the whole setup.</Lead>
        <div className="mt-8 inline-flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-border bg-muted px-4 py-3 font-mono text-[14px]">
          <code className="text-foreground">{INSTALL}</code>
          <CopyButton text={INSTALL} />
        </div>
      </Section>

      {/* ── 02 · the four steps ──────────────────────────────────────── */}
      <Section>
        <Eyebrow>Four steps</Eyebrow>
        <Heading>From zero to a running agent.</Heading>
        <Lead>Everything below happens on your machine — nothing to sign up for first.</Lead>
        <ol className="relative mt-12">
          <span aria-hidden className="absolute left-[15px] top-4 bottom-4 hidden w-px bg-border sm:block" />
          {STEPS.map(([title, body, cmd, note], i) => (
            <li key={title} className="relative grid gap-5 pb-12 last:pb-0 sm:grid-cols-[32px_1fr]">
              <span className="relative z-10 hidden h-8 w-8 items-center justify-center rounded-full border border-border bg-background font-mono text-[12px] text-foreground sm:flex">
                {i + 1}
              </span>
              <div className="max-w-2xl">
                <h3 className={SUBHEAD}>{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{withInlineCode(body)}</p>
                {cmd && (
                  <div className={CMD_BOX}>
                    <code className="text-foreground">{cmd}</code>
                    <CopyButton text={cmd.replace(/^❯\s*/, "")} />
                  </div>
                )}
                <p className="mt-3 font-mono text-[11.5px] leading-relaxed text-muted-foreground/60">
                  {withInlineCode(note)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── 03 · other ways in ───────────────────────────────────────── */}
      <Section>
        <Eyebrow>Other ways in</Eyebrow>
        <Heading>Prefer something else?</Heading>
        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className={SUBHEAD}>Rather have a window?</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              The desktop app is the same engine with chat, an editor and a real terminal side by side — and it
              bundles Node, so it needs nothing installed first.
            </p>
            <a href="download.html" className={cn(buttonVariants(), BTN, "mt-5")}>
              Get the app
            </a>
          </div>
          <div>
            <h3 className={SUBHEAD}>Want it private?</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Point it at a local model and nothing leaves your machine — no account, no third party, no limits.
            </p>
            <div className="mt-4 space-y-2 font-mono text-[12.5px] text-muted-foreground">
              <div>
                <span aria-hidden>❯</span> ollama pull qwen2.5-coder
              </div>
              <div>
                <span aria-hidden>❯</span> /model <span className="text-muted-foreground/60">→ pick it under Local</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Footer />
    </div>
  );
}
