import { cn } from "@/lib/utils";
import appShot from "@/assets/app-hero.png";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Section, Eyebrow, Heading, Lead } from "@/components/site/section";
import { CardGrid } from "@/components/site/card-grid";
import { Screenshot } from "@/components/site/screenshot";
import { FeatureBlock } from "@/components/site/feature-block";
import { Glyph, IconTile } from "@/components/site/glyph";
import { ArrowLink } from "@/components/site/arrow-link";

const FACTS = ["9 built-in agents", "17 tools", "5 permission gates", "MIT"];

const NOT_NEEDED = ["a credit card", "an account", "an API key", "a config file"];

const KEYS: [string, string][] = [
  ["shift+tab", "switch between Build and Plan"],
  ["@", "mention a file, with a preview"],
  ["/", "slash commands, with a live menu"],
  ["$", "hand the task to a sub-agent"],
  ["ctrl+p", "the command palette"],
  ["esc", "interrupt the running turn"],
];

// The built-in sub-agents, straight from BUILTIN_AGENTS in core. `build` and
// `plan` are the two primary modes rather than sub-agents, so they belong to
// the modes section above and not to this table.
const AGENTS: [string, string, string][] = [
  ["general", "mutate", "full access, for multi-step work"],
  ["explore", "read-only", "navigates the codebase, reports back"],
  ["scout", "read-only", "docs and dependency research"],
  ["reviewer", "read-only", "critiques the code and the diff"],
  ["architect", "read-only", "designs the approach before anyone edits"],
  ["tester", "mutate", "writes and runs focused tests"],
  ["debugger", "mutate", "reproduces, root-causes, then fixes"],
];

const BACKBONE: [string, string, string][] = [
  [
    "disk",
    "/sync",
    "Favourites, drafts, decks, progress and settings mirror to one private gist, so a second machine picks up where you left off. Nothing to host, nothing to sign up for beyond the GitHub account you already have.",
  ],
  [
    "file",
    "/publish",
    "Publishes the session as a gist and opens it in a read-only viewer, so you can hand someone the transcript without handing them the repo. /import pulls a shared one back in.",
  ],
  [
    "people",
    "/pack install",
    "A pack bundles your agents, skills and commands into one gist. A team — or a class — installs the whole setup in a single command instead of copying files around.",
  ],
];

const EXTEND: [string, string, string][] = [
  [
    "plug",
    "MCP connectors",
    "A curated one-click catalogue — filesystem, git, github, postgres, fetch, brave-search, slack, puppeteer, memory and sequential-thinking. Fill in the inputs it asks for and their tools sit next to the built-ins.",
  ],
  [
    "route",
    "Language servers",
    "A language server gives it a diagnostics tool that returns your real compiler errors, so it reads the failure your editor sees instead of inferring one from the source.",
  ],
  [
    "shield",
    "Plugins",
    "A plugin is a module that exports { name, register } and can add tools, commands and hooks. Anything that fails to load is reported by name and never blocks startup.",
  ],
];

const CARD = "rounded-xl border border-border bg-card p-6";
const PANEL = "rounded-xl border border-border bg-muted p-5 font-mono text-[12.5px] leading-relaxed";
const CARD_TITLE = "text-[15px] font-medium tracking-tight text-foreground";
const SUBHEAD = "text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.025em] text-foreground";

export default function Features() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="features" />

      {/* ── 01 · hero ────────────────────────────────────────────────── */}
      <Section bordered={false} className="pb-2">
        <Eyebrow>The builder</Eyebrow>
        <Heading level={1}>Everything it does.</Heading>
        <Lead>
          A real agent loop with real tools, on your machine, behind permissions you control. Not a prompt box with
          autocomplete — it reads, plans, edits with minimal diffs, runs your command, and reviews its own work before
          it hands anything back.
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
          caption="The same engine behind the CLI, in the desktop app — session rail, Chat and Terminal tabs, and the composer with the model picker."
        />
      </Section>

      {/* ── 03 · no key ──────────────────────────────────────────────── */}
      <Section>
        <FeatureBlock
          level={2}
          eyebrow="No key"
          title="It runs before you configure anything."
          body="TermCoder opens on a keyless, community-hosted model. It is rate-limited when busy and your prompts go to a third party we do not run — so it is an on-ramp, not the destination. Point it at Ollama for privacy, or connect a provider for quality. Both take one command."
        >
          <div className={PANEL}>
            <div className="text-muted-foreground">To start you need none of this</div>
            <div className="mt-3 space-y-1.5 text-muted-foreground">
              {NOT_NEEDED.map((x) => (
                <div key={x}>
                  <span aria-hidden>✗</span> <s>{x}</s>
                </div>
              ))}
            </div>
            <div className="mt-3 text-foreground">
              <span aria-hidden>❯</span> just run it
            </div>
          </div>
        </FeatureBlock>
      </Section>

      {/* ── 04 · terminal-first ──────────────────────────────────────── */}
      <Section>
        <Eyebrow>Terminal-first</Eyebrow>
        <Heading>Built for the keyboard.</Heading>
        <Lead>
          Multi-line input with real cursor movement, @file mentions that preview the first lines of the file, a live
          slash-command menu, syntax highlighting, diffs with line numbers, and a prompt asking whether you trust the
          folder before the interface ever appears.
        </Lead>
        <div className="mt-10 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {KEYS.map(([k, d]) => (
            <div key={k} className="flex items-baseline gap-3 border-b border-border py-3">
              <code className="font-mono text-[13px] text-foreground">{k}</code>
              <span className="truncate text-[12px] text-muted-foreground">{d}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 05 · modes and routing ───────────────────────────────────── */}
      <Section>
        <Eyebrow>Modes and routing</Eyebrow>
        <Heading>Plan first, or just go.</Heading>
        <Lead>
          Plan reads and proposes without touching a file. Build carries it out. shift+tab flips between them
          mid-session, so you can think before you commit to a change — and on the auto model, the turn does not end
          the moment the edits land.
        </Lead>
        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className={SUBHEAD}>It reviews its own diff.</h3>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
              When the auto model finishes a build turn that changed files, it reads the real{" "}
              <span className="font-mono text-[14px] text-foreground">git diff</span> back to a strict reviewer — bugs
              and broken logic only, no style notes. If the review finds something, it fixes it before handing back.
              One pass per turn, so it cannot argue with itself forever.
            </p>
            <div className={cn(PANEL, "mt-6")}>
              <div className="text-muted-foreground">{"// after a build turn that changed files"}</div>
              <div className="mt-3 space-y-1.5 text-foreground">
                <div><span aria-hidden>❯</span> git diff --no-color</div>
                <div className="text-muted-foreground">reviewing changes…</div>
                <div>the empty-list branch returns undefined</div>
                <div className="text-muted-foreground">fixing the review&apos;s findings…</div>
                <div><span aria-hidden>✓</span> review passed</div>
              </div>
            </div>
          </div>
          <div>
            <h3 className={SUBHEAD}>It recovers without you.</h3>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
              A rate limit or an overloaded provider is retried with a backoff. If the model keeps failing, the turn
              moves to another model you already have a key for and says so in the stream rather than dying with a
              stack trace.
            </p>
            <div className={cn(PANEL, "mt-6")}>
              <div className="text-muted-foreground">{"// a provider goes down mid-turn"}</div>
              <div className="mt-3 space-y-1.5 text-foreground">
                <div>attempt 1 <span className="text-muted-foreground">429 rate limited</span></div>
                <div>retry <span className="text-muted-foreground">after a backoff</span></div>
                <div>switching to google/gemini-2.5-flash…</div>
                <div className="text-muted-foreground">the turn continues where it stopped</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 06 · specialists ─────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Specialists</Eyebrow>
        <Heading>Sub-agents, each with its own permissions.</Heading>
        <Lead>
          Hand a focused sub-task to a specialist and it works in a nested session, then reports back a summary. A
          read-only agent cannot edit — the tools that would let it are filtered out of the set it is given, rather
          than left in place and asked nicely.
        </Lead>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-border text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <th className="pb-3 font-medium">agent</th>
                <th className="pb-3 font-medium">access</th>
                <th className="pb-3 font-medium">what it is for</th>
              </tr>
            </thead>
            <tbody>
              {AGENTS.map(([name, access, what]) => (
                <tr key={name} className="border-b border-border">
                  <td className="py-3 font-mono text-[13px] text-foreground">{name}</td>
                  <td
                    className={cn(
                      "py-3 font-mono text-[12px]",
                      access === "mutate" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {access}
                  </td>
                  <td className="py-3 text-[13px] text-muted-foreground">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
          Drop a markdown file in{" "}
          <span className="font-mono text-[14px] text-foreground">.termcoder/agents/</span> to define your own — with
          its own model, prompt, tool list and permissions.
        </p>
      </Section>

      {/* ── 07 · permissions ─────────────────────────────────────────── */}
      <Section>
        <FeatureBlock
          level={2}
          reverse
          eyebrow="Permissions and checkpoints"
          title="Nothing happens without you."
          body="Bash, writes, edits, MCP calls and network access are five separate gates, each asking before it acts, and any answer can be made sticky for the rest of the session. Scope them per path in an agent file — let it edit docs and nothing else. And because the old contents of every file a turn touches are captured first, reverting that turn puts them back."
        >
          <div className={PANEL}>
            <div className="text-muted-foreground">.termcoder/agents/docs-writer.md</div>
            <div className="mt-3 space-y-1.5 text-foreground">
              <div className="text-muted-foreground">---</div>
              <div>permission:</div>
              <div>
                {"  "}edit: {"{"} <span className="text-ok">&quot;docs/**&quot;: allow</span>,{" "}
                <span className="text-bad">&quot;**&quot;: deny</span> {"}"}
              </div>
              <div>{"  "}bash: ask</div>
              <div className="text-muted-foreground">---</div>
            </div>
            <p className="mt-5 font-sans text-[13px] leading-relaxed text-muted-foreground">
              Last match wins, so the broad deny at the end closes everything the line before it did not open.
            </p>
          </div>
        </FeatureBlock>
      </Section>

      {/* ── 08 · github backbone ─────────────────────────────────────── */}
      <Section>
        <Eyebrow>GitHub backbone</Eyebrow>
        <Heading>Sync, share and packs — with no server.</Heading>
        <Lead>
          The parts that usually need a backend run on gists in your own GitHub account instead. There is nothing of
          ours in the middle, and nothing to pay for.
        </Lead>
        <CardGrid cols={3}>
          {BACKBONE.map(([icon, title, body]) => (
            <div key={title} className={CARD}>
              <IconTile><Glyph name={icon} /></IconTile>
              <h3 className={cn(CARD_TITLE, "mt-4 font-mono")}>{title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* ── 09 · extend ──────────────────────────────────────────────── */}
      <Section>
        <Eyebrow>Extend</Eyebrow>
        <Heading>MCP, language servers, plugins.</Heading>
        <Lead>
          Three ways to give it more than it ships with, none of which asks you to fork it.
        </Lead>
        <CardGrid cols={3}>
          {EXTEND.map(([icon, title, body]) => (
            <div key={title} className={CARD}>
              <IconTile><Glyph name={icon} /></IconTile>
              <h3 className={cn(CARD_TITLE, "mt-4")}>{title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </CardGrid>
      </Section>

      {/* ── 10 · to the tutor ────────────────────────────────────────── */}
      <Section className="text-center">
        <div className="mx-auto w-fit">
          <Heading>And when you want to learn it, not just ship it —</Heading>
        </div>
        <p className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
          the same install has a tutor inside. Same engine, different mind.
        </p>
        <div className="mt-9 flex justify-center">
          <ArrowLink href="study.html">Meet the tutor</ArrowLink>
        </div>
      </Section>

      <Footer />
    </div>
  );
}
