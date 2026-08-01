import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import appShot from "@/assets/app-hero.png";
import { Mark } from "@/components/mark";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Section, Eyebrow, Heading, Lead } from "@/components/site/section";
import { CardGrid } from "@/components/site/card-grid";
import { Screenshot } from "@/components/site/screenshot";
import { FeatureBlock } from "@/components/site/feature-block";
import { FAQ } from "@/components/site/faq";
import { BrandIcon } from "@/components/site/brand-icon";
import { Glyph, IconTile } from "@/components/site/glyph";
import { Invite } from "@/components/site/invite";
import { InlineLink } from "@/components/site/arrow-link";

// [name, simple-icons slug, mono label, one line]. Five of these — OpenAI,
// Groq, xAI, Together, Cerebras — have no entry in simple-icons, so the slug
// resolves to nothing and the row falls back to a monogram rather than to an
// invented mark.
const PROVIDERS: [string, string, string, string][] = [
  ["Anthropic", "anthropic", "sonnet · haiku", "Claude through your own key, on the tier you pay for."],
  ["OpenAI", "openai", "gpt-4o · 4o-mini", "The models most tooling assumes, straight from your account."],
  ["Google", "google", "gemini-2.5 pro · flash", "Pro for the hard turns, Flash for everything else."],
  ["Groq", "groq", "llama · fast", "Open models answered quickly enough to feel local."],
  ["Mistral", "mistral", "large · codestral", "Codestral is built for the completion half of the job."],
  ["DeepSeek", "deepseek", "chat · coder", "A budget-priced reasoning and coding pair, hosted for you."],
  ["xAI", "xai", "grok", "Grok, if that is the key you already hold."],
  ["OpenRouter", "openrouter", "anything", "One key in front of nearly every model on the market."],
  ["Together", "together", "open models", "Open weights, hosted, without you renting a GPU."],
  ["Cerebras", "cerebras", "very fast", "Open models served on custom inference silicon, not GPUs."],
  ["Ollama", "ollama", "local · private", "Whatever you have pulled. Nothing leaves the machine."],
  ["termcoderfree", "termcoderfree", "free · no key", "The default it opens on. No card, no account, no setup."],
];

const TOOLS: [string, string][] = [
  ["read", "open a file"], ["edit", "change a file"], ["write", "create a file"], ["bash", "run a command"],
  ["grep", "search contents"], ["glob", "find by pattern"], ["ls", "list a folder"], ["symbols", "go to definition"],
  ["repomap", "map the project"], ["memory", "recall & save"], ["skill", "load a playbook"], ["recipe", "run a workflow"],
  ["webfetch", "read a URL"], ["websearch", "search the web"], ["diagnostics", "read LSP errors"], ["task", "spawn a sub-agent"],
  ["run_code", "run confined code"],
];

const FACTS = ["MIT", "12 providers", "17 tools", "Windows", "macOS", "Linux", "no telemetry"];

const NOT_NEEDED = ["a credit card", "an account", "an API key", "a config file"];

const ROUNDS: { round: string; what: string; result: string; ok: boolean }[] = [
  { round: "round 1", what: "edit → npm run build", result: "✗ 2 type errors", ok: false },
  { round: "round 2", what: "fix types → build", result: "✗ 1 test failing", ok: false },
  { round: "round 3", what: "fix test → build", result: "✓ passed", ok: true },
];

const SECONDARY: [string, string, string][] = [
  [
    "file",
    "Agents, skills, commands, recipes",
    "Everything it knows about your project is markdown in your repo — .termcoder/agents/ (own model, prompt, tools, permissions), commands/ (slash commands with $ARGUMENTS), skills/ (playbooks loaded only when needed), recipes/ (saved multi-step workflows) and memory/ (facts it keeps about the project). Readable, diffable, reviewable in a pull request, not settings in someone else's dashboard. Skills load progressively: only the name and a one-line description sit in the prompt until the agent reaches for the body.",
  ],
  [
    "plug",
    "MCP connectors",
    "A curated catalog — filesystem, git, github, postgres, fetch, brave-search, slack, puppeteer, memory, sequential-thinking. Pick one, fill in the inputs it asks for, and it writes the config. No memorising transports or npx incantations.",
  ],
  [
    "cap",
    "The tutor",
    "The part no other coding agent has. Built because students shouldn't need a credit card to learn — and because copying an answer teaches nothing. It explains step by step in your language, and hands homework back as worked steps instead of a solution to paste. /flashcards builds a deck, /review grades you 0–5, /decks shows what is due, /quiz runs a practice exam — all scheduled with SM-2.",
  ],
  [
    "people",
    "Classrooms and live rooms",
    "A teacher creates a class, shares packs of agents and skills, sets assignments and grades submissions — all of it riding on a private gist, with nothing to host. Live rooms are peer to peer: voice, camera, screen share and chat straight between you, with no media server in the middle. Joining is always free.",
  ],
];

const SECURITY: [string, string, string][] = [
  ["disk", "Local first", "Your config, your memory and your sessions are plain files on disk. Nothing is uploaded to be read back later, and you can delete any of it with rm."],
  ["eyeOff", "No telemetry", "No analytics, no crash pings, no usage counters. Nothing about what you build is collected, ever."],
  ["route", "Direct to your provider", "Prompts go from your machine to the model you chose and nowhere else. There is no TermCoder server in the middle to trust."],
  ["noAccount", "No account", "Nothing to sign up for. It opens on a free model that needs no key, and connecting your own key is a line in a file you own."],
  ["shield", "Five permission gates", "Bash, writes, edits, MCP calls and network access each default to asking first. Reading is cheap; running a command or writing a file asks first."],
];

const PROOF: [string, string][] = [
  ["MIT", "licence"],
  ["17", "tools"],
  ["12", "providers"],
  ["0", "servers holding your code"],
];

const FAQ_ITEMS = [
  { q: "Do I need an API key?",
    a: "No. It opens on a free, community-hosted model with no sign-up and no card. It is rate-limited when busy, and prompts go to a third party we do not run — point it at a local Ollama to keep everything on your machine." },
  { q: "Is it really free?",
    a: "The agent and the tutor are MIT licensed and free forever, and joining any room or class is free. Only hosting a room is paid." },
  { q: "Does it work offline?",
    a: "With a local model, yes. Point it at Ollama and nothing leaves your machine — retrieval, memory and the tool loop all run locally." },
  { q: "Does it run on Windows?",
    a: "Yes. The CLI runs on Windows, macOS and Linux, and the desktop app ships installers for all three with Node bundled." },
  { q: "Where does my code go?",
    a: "To the model provider you choose, and nowhere else. There is no TermCoder server in the middle, no telemetry, and no account. Your config, memory and sessions are plain files on disk." },
  { q: "How is this different from Claude Code?",
    a: "It is provider-agnostic rather than tied to one vendor, it routes each turn to a model tier on its own, and it has a study mode — flashcards, quizzes and worked homework — that no other coding agent ships." },
];

const INSTALL = "npm install -g @termcoder/tui";

const CARD = "rounded-xl border border-border bg-card p-6";
const PANEL = "rounded-xl border border-border bg-muted p-5 font-mono text-[12.5px] leading-relaxed";
const CARD_TITLE = "text-[15px] font-medium tracking-tight text-foreground";
const BTN = "h-11 rounded-lg px-5 text-[14px]";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="home" />

      {/* ── 01 · hero ────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-[1120px] px-6 pt-16 pb-2 sm:pt-24">
          <Heading level={1}>
            One terminal. <span className="text-muted-foreground">Two minds.</span>
          </Heading>
          <Lead>
            One is a <span className="text-foreground">builder</span> — it reads your repo, edits files, runs your
            tests and loops until they pass. The other is a <span className="text-foreground">tutor</span> — it
            explains, drills you with flashcards and tracks what you actually learned. Same engine, same install,
            no API key.
          </Lead>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="download.html" className={cn(buttonVariants(), BTN)}>Get the app</a>
            <a href="install.html" className={cn(buttonVariants({ variant: "outline" }), BTN)}>Install the CLI</a>
          </div>
          <p className="mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
            {FACTS.map((f, i) => (
              <span key={f} className="inline-flex items-center gap-2.5">
                {i > 0 && <span aria-hidden>·</span>}
                {f}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ── 02 · anchor shot ─────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-[1120px] px-6 pb-16 sm:pb-24">
          <Screenshot
            src={appShot}
            width={1034}
            height={740}
            priority
            alt="The TermCoder desktop app on open: the session rail on the left, the Chat and Terminal tabs across the top, and a composer with the model picker at the bottom."
            caption="The desktop app on open — the session rail, the Chat and Terminal tabs, and the composer with the model picker."
          />
        </div>
      </section>

      {/* ── 03 · providers ───────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Bring your own model — or none at all</Eyebrow>
        <Heading>It opens on a free model. Twelve more are one command away.</Heading>
        <Lead>
          No card, no sign-up. Connect a key when you want one, or sign in with a Claude or ChatGPT subscription
          instead of paying per token — both experimental.
        </Lead>
        {/* One white card, subdivided by hairlines, rather than twelve floating
            ones — the rules do the separating so the page keeps its calm. */}
        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid sm:grid-cols-2">
            {PROVIDERS.map(([name, slug, label, blurb]) => (
              <div
                key={name}
                className={cn(
                  "border-t border-border px-5 py-4",
                  "[&:first-child]:border-t-0 sm:[&:nth-child(2)]:border-t-0",
                  "sm:[&:nth-child(odd)]:border-r",
                )}
              >
                <div className="flex items-center gap-3">
                  <IconTile className="h-8 w-8 rounded-lg">
                    <BrandIcon
                      slug={slug}
                      size={15}
                      fallback={
                        slug === "termcoderfree"
                          ? <Mark size={14} />
                          : <span className="font-mono text-[12px] leading-none">{name.slice(0, 1).toUpperCase()}</span>
                      }
                    />
                  </IconTile>
                  <span className={CARD_TITLE}>{name}</span>
                  <span className="ml-auto truncate pl-3 font-mono text-[11.5px] text-muted-foreground">{label}</span>
                </div>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">{blurb}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div>
            <h3 className="text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.025em] text-foreground">
              The right model, per turn.
            </h3>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
              <span className="font-mono text-[14px] text-foreground">termcoder/auto</span> classifies the prompt and
              picks a tier. There is no model in the routing loop — it is a regex and a table, so it costs nothing
              and never stalls.
            </p>
          </div>
          <pre className={cn(PANEL, "overflow-x-auto text-foreground")}>
<span className="text-muted-foreground">{"// classify(prompt)"}</span>{"\n"}
len &gt; 600                        → complex{"\n"}
/architect|debug|race|security/  → complex{"\n"}
/across|codebase|multiple files/ → complex{"\n"}
else                             → simple{"\n"}
{"\n"}
<span className="text-muted-foreground">{"// route(complexity)"}</span>{"\n"}
simple   → tier.fast     <span className="text-muted-foreground">gemini-flash · haiku · 4o-mini</span>{"\n"}
complex  → tier.strong   <span className="text-muted-foreground">gemini-pro · sonnet · 4o</span>
          </pre>
        </div>
      </Section>

      {/* ── 04 · the builder ─────────────────────────────────────────── */}
      <Section id="build">
        <FeatureBlock
          level={2}
          eyebrow="The builder"
          title="A real agent loop, with real tools."
          body="Not a prompt box with autocomplete. It maps the stack, the scripts and the entry points before you type anything, then plans, edits with minimal diffs, runs your command, reads the failure and goes again until it passes. Every turn is checkpointed, so you can walk any of it back."
        >
          <Screenshot
            src={appShot}
            width={1034}
            height={740}
            className="mt-0"
            alt="The builder mid-turn: a plan in the chat pane, a minimal diff with added and removed lines, and the test command running underneath."
            caption="A turn in full — the plan, the diff it proposes, and the test run that decides whether it goes again."
          />
        </FeatureBlock>

        <div className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h3 className="text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.025em] text-foreground">
              Seventeen real tools.
            </h3>
            <p className="text-[14px] text-muted-foreground">Reading and search run freely. Running a command, writing a file, reaching the network or executing code asks first.</p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-x-10 sm:grid-cols-3 lg:grid-cols-4">
            {TOOLS.map(([t, d]) => (
              <div key={t} className="flex items-baseline gap-2 border-b border-border py-3">
                <span className="font-mono text-[13px] text-foreground">{t}</span>
                <span className="truncate text-[12px] text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={cn(CARD, "mt-10 flex flex-wrap items-center gap-x-6 gap-y-3")}>
          <span className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            To start you need none of this
          </span>
          {NOT_NEEDED.map((x) => (
            <span key={x} className="font-mono text-[13px] text-muted-foreground">
              <span aria-hidden>✗</span> <s>{x}</s>
            </span>
          ))}
          <span className="font-mono text-[13px] text-foreground">Just run it.</span>
        </div>
      </Section>

      {/* ── 05 · a real shell ────────────────────────────────────────── */}
      <Section>
        <FeatureBlock
          level={2}
          reverse
          eyebrow="Chat and terminal"
          title="A real shell, in the same window."
          body="The Terminal tab is a real shell, not a transcript of one — run the build, tail a log, poke at git, and hand the output straight back to the agent in the next message. Nothing to alt-tab to, nothing to copy and paste. The whole interface speaks eleven languages, including yours."
        >
          <Screenshot
            src={appShot}
            width={1034}
            height={740}
            className="mt-0"
            alt="The Terminal tab of the desktop app running a build command next to the Chat tab, both inside the same window."
            caption="The Terminal tab — a real shell one click from the conversation about it."
          />
        </FeatureBlock>
      </Section>

      {/* ── 06 · memory + retrieval ──────────────────────────────────── */}
      <Section>
        <FeatureBlock
          level={2}
          eyebrow="Memory and retrieval"
          title="It remembers you, and it finds the file."
          body="Tell it once that you use pnpm and it keeps that across sessions — shared with your team through git, or kept private on your machine. Finding things is lexical ranking over your own project: no embeddings, no index server, no new dependency, cheap enough to run every turn."
        >
          <Screenshot
            src={appShot}
            width={1034}
            height={740}
            className="mt-0"
            alt="The memory pane listing the facts the agent has kept about the project, beside a symbol lookup resolving a function to its file and line."
            caption="What it kept about this project, and how it gets from a symbol name to a line number."
          />
        </FeatureBlock>

        <div className="mt-16 grid gap-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className={PANEL}>
              <div className="text-muted-foreground">~/.termcoder/memory/project.md</div>
              <div className="mt-3 space-y-1.5 text-foreground">
                <div>· uses pnpm, never npm</div>
                <div>· the auth module is fragile — tread carefully</div>
                <div>· no barrel files</div>
                <div>· tests run with npm test, not a watcher</div>
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Plain markdown you can edit, review in a pull request or delete. A guard refuses to store anything that
              looks like a secret.
            </p>
          </div>
          <div>
            <div className={PANEL}>
              <div className="text-muted-foreground">{"// retrieval — pointers, not file bodies"}</div>
              <div className="mt-3 space-y-1.5 text-foreground">
                <div><span aria-hidden>❯</span> symbols resolveModel</div>
                <div className="text-muted-foreground">provider.ts:98 · function</div>
                <div><span aria-hidden>❯</span> repomap</div>
                <div className="text-muted-foreground">pnpm monorepo · 4 packages · vitest</div>
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              It sends the agent a pointer instead of a file, so it stops re-reading the repo to work out where a
              thing lives — and your context stays cheap.
            </p>
          </div>
        </div>
      </Section>

      {/* ── 07 · autonomous ──────────────────────────────────────────── */}
      <Section>
        <FeatureBlock
          level={2}
          reverse
          eyebrow="Autonomous"
          title="Give it a goal and a way to check."
          body="Hand it a command that tells the truth about your project — a build, a test run, a linter — and it works, runs the command, reads the failure and goes again until the command exits zero. Auto-approve is on for the run, so every round is checkpointed and any of it can be walked back."
        >
          <div className={PANEL}>
            <div className="text-muted-foreground"><span aria-hidden>❯</span> termcoder --background &quot;make the build green&quot;</div>
            <ol className="mt-4 space-y-3">
              {ROUNDS.map(({ round, what, result, ok }) => (
                <li key={round} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="w-16 flex-none text-foreground">{round}</span>
                  <span className="text-muted-foreground">{what}</span>
                  <span className={cn("ml-auto", ok ? "text-ok" : "text-bad")}>{result}</span>
                </li>
              ))}
            </ol>
          </div>
        </FeatureBlock>
      </Section>

      {/* ── 08 · secondary ───────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Everything else in the box</Eyebrow>
        <Heading>Teach it your way, or learn from it.</Heading>
        <Lead>
          The same install carries the parts that are not the agent loop — the customisation that lives in your repo,
          the connectors, the tutor, and the classrooms and rooms built on top of it.
        </Lead>
        <Screenshot
          src={appShot}
          width={1034}
          height={740}
          alt="The study side of the app: a flashcard deck mid-review with a grading row, next to the class panel listing assignments."
          caption="The tutor and the classroom — the half of the product that is not about shipping."
        />
        <CardGrid cols={4}>
          {SECONDARY.map(([icon, title, body]) => (
            <div key={title} className={CARD}>
              <IconTile><Glyph name={icon} /></IconTile>
              <h3 className={cn(CARD_TITLE, "mt-4")}>{title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* ── 09 · security is a feature ───────────────────────────────── */}
      <Section>
        <Eyebrow>Security is a feature</Eyebrow>
        <Heading>Your code never leaves a path you chose.</Heading>
        <Lead>
          The privacy story is not a policy page — it is the architecture. There is nowhere for your code to go
          except the model you pointed it at.
        </Lead>
        <CardGrid cols={2}>
          {SECURITY.map(([icon, title, body], i) => (
            <div key={title} className={cn(CARD, i === SECURITY.length - 1 && "sm:col-span-2")}>
              <IconTile><Glyph name={icon} /></IconTile>
              <h3 className={cn(CARD_TITLE, "mt-4")}>{title}</h3>
              <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* ── 10 · technical proof ─────────────────────────────────────── */}
      <Section>
        <Eyebrow>Built in the open</Eyebrow>
        <Heading>Nothing here asks you to take our word for it.</Heading>
        <div className="mt-12 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map(([value, label]) => (
            <div key={label} className="border-t border-border pt-5">
              <div className="text-[clamp(32px,4.5vw,48px)] font-semibold leading-none tracking-[-0.03em] text-foreground">
                {value}
              </div>
              <div className="mt-3 max-w-[20ch] text-[14px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-12 text-[16px] leading-relaxed text-muted-foreground">
          Every claim on this page is a file you can read.{" "}
          <InlineLink href="https://github.com/Cartivo-Oficial/TermCoder">Read the source on GitHub</InlineLink>.
        </p>
      </Section>

      {/* ── 11 · the invite ──────────────────────────────────────────── */}
      <Section>
        <Invite />
      </Section>

      {/* ── 12 · faq ─────────────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Questions</Eyebrow>
        <Heading>The ones people actually ask.</Heading>
        <FAQ items={FAQ_ITEMS} />
      </Section>

      {/* ── 13 · final cta ───────────────────────────────────────────── */}
      <Section className="text-center">
        <div className="mx-auto w-fit">
          <Heading>One install. Both minds.</Heading>
        </div>
        <p className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
          It runs the moment it opens — no account, no key, nothing to configure.
        </p>
        <div className="mx-auto mt-9 inline-flex max-w-full flex-wrap items-center gap-4 rounded-xl border border-border bg-muted px-4 py-3 font-mono text-[13px]">
          <code className="text-foreground">{INSTALL}</code>
          <CopyButton text={INSTALL} />
        </div>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a href="download.html" className={cn(buttonVariants(), BTN)}>Get the app</a>
          <a href="docs.html" className={cn(buttonVariants({ variant: "outline" }), BTN)}>Read the docs</a>
        </div>
      </Section>

      <Footer />
    </div>
  );
}
