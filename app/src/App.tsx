import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dither } from "@/components/dither";
import { CopyButton } from "@/components/copy-button";
import { Mark } from "@/components/mark";
import appShot from "@/assets/app.png";

const PROVIDERS: [string, string][] = [
  ["Anthropic", "claude-sonnet-5 · haiku"], ["OpenAI", "gpt-4o · 4o-mini"], ["Google", "gemini-2.5 pro · flash"],
  ["Groq", "llama · fast"], ["Mistral", "large · codestral"], ["DeepSeek", "chat · coder"],
  ["xAI", "grok"], ["OpenRouter", "anything"], ["Together", "open models"],
  ["Cerebras", "very fast"], ["Ollama", "local · private"], ["Pollinations", "free · no key"],
];

const TOOLS: [string, string][] = [
  ["read", "open a file"], ["edit", "change a file"], ["write", "create a file"], ["bash", "run a command"],
  ["grep", "search contents"], ["glob", "find by pattern"], ["ls", "list a folder"], ["symbols", "go to definition"],
  ["repomap", "map the project"], ["memory", "recall & save"], ["skill", "load a playbook"], ["recipe", "run a workflow"],
  ["webfetch", "read a URL"], ["websearch", "search the web"], ["diagnostics", "read LSP errors"], ["task", "spawn a sub-agent"],
];

const btn = "h-11 rounded-md px-5 text-[14px] font-mono shadow-[0_14px_44px_-14px] shadow-primary/70";
const btnOutline = "h-11 rounded-md px-5 text-[14px] font-mono";

function Cmd({ children, tone = "build" }: { children: React.ReactNode; tone?: "build" | "study" }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
      <span className={tone === "build" ? "text-primary" : "text-study"}>❯</span> {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 max-w-[22ch] font-display text-4xl font-light leading-[1.05] tracking-[-0.03em] text-balance text-foreground sm:text-5xl">{children}</h2>;
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{children}</p>;
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="border-t border-border"><div className="mx-auto max-w-6xl px-6 py-20">{children}</div></section>;
}

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      {/* ─────────── nav ─────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-7 px-6">
          <a href="#" className="flex items-center gap-2.5">
            <Mark size={20} />
            <span className="font-display text-[17px] font-light tracking-tight text-foreground">termcoder</span>
          </a>
          <nav className="hidden items-center gap-6 font-mono text-[12.5px] text-muted-foreground md:flex">
            <a href="#build" className="transition-colors hover:text-primary">build</a>
            <a href="#study" className="transition-colors hover:text-study">study</a>
            <span className="h-3 w-px bg-border" />
            {["install", "download", "docs", "changelog", "pricing"].map((n) => (
              <a key={n} href="#" className="transition-colors hover:text-foreground">{n}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <a href="#" className="hidden font-mono text-[12.5px] text-muted-foreground transition-colors hover:text-foreground sm:block">sign in</a>
            <a href="#" className={cn(buttonVariants(), "h-9 rounded-md px-4 font-mono text-[13px] shadow-[0_10px_30px_-12px] shadow-primary/60")}>Get the app →</a>
          </div>
        </div>
      </header>

      {/* ─────────── 01 · hero ─────────── */}
      <section className="relative overflow-hidden">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-90" side="both" tone="seam" />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-10">
          <Cmd>open source · MIT · no API key</Cmd>
          <h1 className="mt-6 max-w-[14ch] font-display text-6xl font-light leading-[0.94] tracking-[-0.04em] text-balance text-foreground sm:text-7xl lg:text-[104px]">
            One terminal.{" "}
            <span className="bg-gradient-to-r from-[#ff7a45] via-[#ff9a5f] to-[#31d0b4] bg-clip-text text-transparent">Two minds.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            One is a <span className="text-primary">builder</span> — it reads your repo, edits files, runs your tests and
            loops until they pass. The other is a <span className="text-study">tutor</span> — it explains, drills you with
            flashcards and tracks what you actually learned. Same engine. Same install. No API key.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#" className={cn(buttonVariants(), btn)}>Get the app →</a>
            <a href="#" className={cn(buttonVariants({ variant: "outline" }), btnOutline)}>Install the CLI</a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11.5px] text-muted-foreground/60">
            {["MIT licensed", "12 providers", "16 tools", "Windows · macOS · Linux", "no telemetry"].map((s, i) => (
              <span key={s} className="flex items-center gap-6">
                {i > 0 && <span className="h-1 w-1 rounded-full bg-border" />}{s}
              </span>
            ))}
          </div>
        </div>

        {/* the product, for real */}
        <div className="relative mx-auto max-w-6xl px-6 pb-20">
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -top-6 bottom-0 rounded-[28px] opacity-70 blur-3xl"
              style={{ background: "linear-gradient(100deg, rgba(255,122,69,0.30), rgba(49,208,180,0.26))" }}
            />
            <div className="relative overflow-hidden rounded-lg border border-white/12 bg-[#0d0c0e] shadow-[0_60px_140px_-40px_rgba(0,0,0,0.95)]">
              <img
                src={appShot}
                width={1280}
                height={800}
                alt="The TermCoder desktop app: the session rail, the Chat and Terminal tabs, one-click chips for the coding CLIs found on PATH, and a real shell running npm test."
                className="block w-full"
              />
            </div>
          </div>
          <div className="mt-4 grid gap-x-10 gap-y-2 font-mono text-[11.5px] sm:grid-cols-3">
            {[
              ["chat · terminal", "a real shell, in the same window"],
              ["it finds your CLIs", "Claude Code · Codex · Gemini, on PATH"],
              ["one install", "the builder and the tutor, together"],
            ].map(([a, b]) => (
              <div key={a} className="border-t border-border pt-2.5">
                <div className="text-foreground">{a}</div>
                <div className="text-[11px] text-muted-foreground/60">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── 02 · quickstart (timeline, not cards) ─────────── */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            <Cmd>quickstart</Cmd>
            <H2>Running in ten seconds.</H2>
            <div className="mt-6 inline-flex items-center gap-3 rounded-md border border-white/15 bg-[#0d0c0e] px-3.5 py-2.5 font-mono text-[13px]">
              <span className="text-primary">❯</span>
              <code className="text-foreground">npm install -g @termcoder/tui</code>
              <CopyButton text="npm install -g @termcoder/tui" />
            </div>
          </div>
          <ol className="relative">
            <span className="absolute left-[13px] top-3 bottom-3 w-px bg-border" />
            {[
              ["Install it", "One npm command, or download the desktop app. The CLI needs Node 18+; the app bundles its own."],
              ["Open a folder", "It maps the stack, the scripts and the entry points before you type anything."],
              ["Ask for the change", "Plain language. It reads, edits, runs your tests, and shows you the diff."],
            ].map(([t, d], i) => (
              <li key={t} className="relative flex gap-5 pb-8 last:pb-0">
                <span className="relative z-10 mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border border-border bg-background font-mono text-[11px] text-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl font-normal tracking-tight text-foreground">{t}</h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ─────────── 03 · providers (table, not chips) ─────────── */}
      <Section>
        <Cmd>bring your own model — or none at all</Cmd>
        <H2>It opens on a free model. Twelve more are one command away.</H2>
        <div className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map(([name, models]) => (
            <div key={name} className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="font-mono text-[13px] text-foreground">{name}</span>
              <span className="truncate font-mono text-[11px] text-muted-foreground/60">{models}</span>
            </div>
          ))}
        </div>
        <Lead>
          No card, no sign-up. Connect a key when you want one, or sign in with a Claude or ChatGPT subscription instead of
          paying per token — both experimental.
        </Lead>
      </Section>

      {/* ─────────── 04 · the builder (split statement) ─────────── */}
      <section id="build" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
            <div>
              <Cmd>termcoder</Cmd>
              <h2 className="mt-4 font-display text-5xl font-light tracking-[-0.035em] text-foreground sm:text-6xl">
                The <span className="text-primary">builder</span>.
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
                A real agent loop with real tools — not a prompt box with autocomplete. It reads the repo, plans, edits with
                minimal diffs, runs your command, reads the failure, and goes again until it passes. Every turn is
                checkpointed, so you can walk any of it back.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[12.5px] text-muted-foreground">
                <span><span className="text-primary">1</span> read</span>
                <span><span className="text-primary">2</span> plan</span>
                <span><span className="text-primary">3</span> edit</span>
                <span><span className="text-primary">4</span> run</span>
                <span><span className="text-primary">5</span> verify</span>
                <span className="text-primary/70">↺ until green</span>
              </div>
            </div>
            <div className="rounded-md border border-border bg-card p-6">
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary">to start you need</div>
              <div className="mt-4 space-y-2 font-mono text-[13px]">
                {["a credit card", "an account", "an API key", "a config file"].map((x) => (
                  <div key={x} className="text-muted-foreground/50"><span className="text-[#ff6b6b]">✗</span> <s>{x}</s></div>
                ))}
                <div className="pt-1 text-foreground"><span className="text-primary">❯</span> just run it</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── 05 · routing (full-width code) ─────────── */}
      <Section>
        <Cmd>provider/routing.ts</Cmd>
        <H2>The right model, per turn.</H2>
        <Lead>
          <span className="text-foreground">termcoder/auto</span> classifies the prompt and picks a tier. There is no LLM in
          the routing loop — it is a regex and a table, so it costs nothing and never stalls.
        </Lead>
        <pre className="mt-7 overflow-x-auto rounded-md border border-border bg-[#0d0c0e] p-5 font-mono text-[12.5px] leading-relaxed text-[#d7d2cc]">
<span className="text-muted-foreground/50">// classify(prompt)</span>{"\n"}
len &gt; 600                        <span className="text-primary">→ complex</span>{"\n"}
/architect|debug|race|security/  <span className="text-primary">→ complex</span>{"\n"}
/across|codebase|multiple files/ <span className="text-primary">→ complex</span>{"\n"}
else                             <span className="text-[#58d38c]">→ simple</span>{"\n"}
{"\n"}
<span className="text-muted-foreground/50">// route(complexity)</span>{"\n"}
<span className="text-[#58d38c]">simple</span>   → tier.fast     <span className="text-muted-foreground/50">gemini-flash · haiku · 4o-mini</span>{"\n"}
<span className="text-primary">complex</span>  → tier.strong   <span className="text-muted-foreground/50">gemini-pro · sonnet · 4o</span>
        </pre>
      </Section>

      {/* ─────────── 06 · toolbox (table) ─────────── */}
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Cmd>the toolbox</Cmd>
            <H2>Sixteen real tools.</H2>
          </div>
          <p className="font-mono text-[11.5px] text-muted-foreground/60">each one behind a permission you control</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-10 sm:grid-cols-3 lg:grid-cols-4">
          {TOOLS.map(([t, d]) => (
            <div key={t} className="flex items-baseline gap-2 border-b border-border/60 py-2.5">
              <b className="font-mono text-[13px] font-normal text-foreground">{t}</b>
              <span className="truncate text-[11px] text-muted-foreground/60">{d}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ─────────── 07 · memory + retrieval (two artefacts) ─────────── */}
      <Section>
        <Cmd>memory · retrieval</Cmd>
        <H2>It remembers you, and it finds the file.</H2>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="rounded-md border border-border bg-[#0d0c0e] p-4 font-mono text-[12px]">
              <div className="text-muted-foreground/50">~/.termcoder/memory/project.md</div>
              <div className="mt-2 space-y-1 text-[#d7d2cc]">
                <div>· uses pnpm, never npm</div>
                <div>· the auth module is fragile — tread carefully</div>
                <div>· no barrel files</div>
                <div>· tests run with <span className="text-primary">npm test</span>, not a watcher</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Tell it once and it keeps that across sessions — shared with your team through git, or kept private on your
              machine. A guard refuses to store anything that looks like a secret.
            </p>
          </div>
          <div>
            <div className="rounded-md border border-border bg-[#0d0c0e] p-4 font-mono text-[12px]">
              <div className="text-muted-foreground/50">// retrieval — pointers, not file bodies</div>
              <div className="mt-2 space-y-1 text-[#d7d2cc]">
                <div><span className="text-primary">❯</span> symbols resolveModel</div>
                <div className="text-muted-foreground/60">provider.ts:98 <span className="text-muted-foreground/40">· function</span></div>
                <div><span className="text-primary">❯</span> repomap</div>
                <div className="text-muted-foreground/60">pnpm monorepo · 4 packages · vitest</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Lexical ranking over your project — no embeddings, no index server, no new dependency. Cheap enough to run
              every turn, so it stops re-reading the repo to find where a thing lives.
            </p>
          </div>
        </div>
      </Section>

      {/* ─────────── 08 · autonomous (vertical rail) ─────────── */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[360px_1fr]">
          <div>
            <Cmd>autonomous</Cmd>
            <H2>Give it a goal and a way to check.</H2>
            <Lead>
              It works, runs your verify command, reads the failure, and goes again — until the command exits zero. Auto-approve
              is on, so every round is checkpointed.
            </Lead>
          </div>
          <div>
            <div className="font-mono text-[12.5px] text-muted-foreground/70">❯ termcoder --background &quot;make the build green&quot;</div>
            <ol className="relative mt-5">
              <span className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
              {[
                ["round 1", "edit → npm run build", "✗ 2 type errors", "bad"],
                ["round 2", "fix types → build", "✗ 1 test failing", "bad"],
                ["round 3", "fix test → build", "✓ passed", "ok"],
              ].map(([r, what, res, kind]) => (
                <li key={r} className="relative flex items-baseline gap-4 pb-5 last:pb-0">
                  <span className={cn("relative z-10 mt-1.5 h-2.5 w-2.5 flex-none rounded-full", kind === "ok" ? "bg-[#28c840]" : "bg-border")} />
                  <span className="w-16 flex-none font-mono text-[12.5px] text-foreground">{r}</span>
                  <span className="font-mono text-[12.5px] text-muted-foreground/60">{what}</span>
                  <span className={cn("ml-auto font-mono text-[12.5px]", kind === "ok" ? "text-[#28c840]" : "text-[#ff6b6b]")}>{res}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* ─────────── 09 · extend it (file tree + connectors) ─────────── */}
      <Section>
        <Cmd>agents · commands · skills · recipes · mcp</Cmd>
        <H2>Teach it your way.</H2>
        <Lead>
          Everything it knows about your project is markdown in your repo — readable, diffable, reviewable in a PR. Not
          settings in someone else&apos;s dashboard.
        </Lead>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-[#0d0c0e] p-4 font-mono text-[12px] leading-relaxed">
            <div className="text-muted-foreground/50">.termcoder/</div>
            <div className="mt-2 space-y-1">
              {[
                ["├─ agents/", "own model, prompt, tools, permissions"],
                ["├─ commands/", "/slash commands with $ARGUMENTS"],
                ["├─ skills/", "playbooks — loaded only when needed"],
                ["├─ recipes/", "saved multi-step workflows"],
                ["└─ memory/", "facts it keeps about the project"],
              ].map(([a, b]) => (
                <div key={a} className="flex flex-wrap gap-x-3">
                  <span className="text-[#d7d2cc]">{a}</span>
                  <span className="text-muted-foreground/50">{b}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-display text-2xl font-normal tracking-tight text-foreground">Connectors, one click.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A curated MCP catalog — pick one, fill the inputs it asks for, and it writes the config. No memorising
              transports or <span className="font-mono text-foreground">npx</span> incantations.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["filesystem", "git", "github", "postgres", "fetch", "brave-search", "slack", "puppeteer", "memory", "sequential-thinking"].map((m) => (
                <span key={m} className="rounded border border-border px-2.5 py-1 font-mono text-[11.5px] text-muted-foreground">{m}</span>
              ))}
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Skills use progressive disclosure: only the name and one-line description sit in the prompt — the body loads
              when the agent actually reaches for it, so context stays cheap.
            </p>
          </div>
        </div>
      </Section>

      {/* ─────────── 10 · the seam ─────────── */}
      <section className="relative overflow-hidden border-t border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-80" side="field" tone="seam" density={0.5} />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <Mark size={30} />
          <h2 className="mx-auto mt-6 max-w-[18ch] font-display text-4xl font-light tracking-[-0.03em] text-balance text-foreground sm:text-5xl">
            Same engine.{" "}
            <span className="bg-gradient-to-r from-[#ff7a45] to-[#31d0b4] bg-clip-text text-transparent">Different mind.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Switch the model and the whole personality changes — the tools it gets, the prompt it runs, the way it talks to
            you. The student and the shipper install the same thing.
          </p>
        </div>
      </section>

      {/* ─────────── 11 · the tutor ─────────── */}
      <section id="study" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
            <div>
              <Cmd tone="study">termexplorer</Cmd>
              <h2 className="mt-4 font-display text-5xl font-light tracking-[-0.035em] text-foreground sm:text-6xl">
                The <span className="text-study">tutor</span>.
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
                The part no other coding agent has. Built because students shouldn&apos;t need a credit card to learn — and
                because copying an answer teaches nothing. It explains step by step, in your language, and gives homework
                back as worked steps instead of a solution to paste.
              </p>
              <div className="mt-8 grid gap-x-10 gap-y-2.5 sm:grid-cols-2">
                {[["/flashcards <topic>", "generate a deck"], ["/review", "grade yourself 0–5"], ["/decks", "see what's due"], ["/quiz", "practice exam"]].map(([c, d]) => (
                  <div key={c} className="flex items-baseline gap-3 border-b border-border/60 py-2">
                    <code className="font-mono text-[12.5px] text-study">{c}</code>
                    <span className="text-[11.5px] text-muted-foreground/60">{d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-study/20 bg-card p-6">
              <div className="font-mono text-[11px] uppercase tracking-widest text-study">this week</div>
              <div className="mt-5 flex items-end gap-1.5">
                {[3, 5, 2, 6, 4, 7, 5].map((h, i) => <span key={i} className="flex-1 rounded-sm bg-study/70" style={{ height: h * 8 }} />)}
              </div>
              <div className="mt-3 flex justify-between font-mono text-[10.5px] text-muted-foreground/50">
                <span>mon</span><span>sun</span>
              </div>
              <div className="mt-5 border-t border-border pt-4 font-mono text-[12.5px]">
                <div className="flex justify-between"><span className="text-muted-foreground">streak</span><span className="text-study">6 days</span></div>
                <div className="mt-1.5 flex justify-between"><span className="text-muted-foreground">due today</span><span className="text-foreground">12 cards</span></div>
                <div className="mt-1.5 flex justify-between"><span className="text-muted-foreground">scheduler</span><span className="text-foreground">SM-2</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── 12 · classrooms + rooms ─────────── */}
      <Section>
        <Cmd tone="study">classrooms · live rooms</Cmd>
        <H2>Learn together — with no server to run.</H2>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="border-l-2 border-study/40 pl-6">
            <h3 className="font-display text-2xl font-normal tracking-tight text-foreground">A class, over GitHub.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A teacher creates a class, shares packs of agents and skills, sets assignments and grades submissions. It all
              rides on a private gist — nothing to host, nothing to pay for, and it works asynchronously.
            </p>
            <div className="mt-4 font-mono text-[12px] text-muted-foreground/60">
              <div><span className="text-study">❯</span> /class create &quot;Algoritmos 2&quot;</div>
              <div><span className="text-study">❯</span> /class submit a1</div>
            </div>
          </div>
          <div className="border-l-2 border-study/40 pl-6">
            <h3 className="font-display text-2xl font-normal tracking-tight text-foreground">Live rooms, peer to peer.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Share a link and someone joins your session — voice, camera, screen share and chat, straight between the two of
              you. No media server sits in the middle. Joining is always free.
            </p>
            <div className="mt-4 font-mono text-[12px] text-muted-foreground/60">
              <div><span className="text-study">❯</span> http://192.168.0.5:4096?session=…</div>
              <div>2 present · voice + screen</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ─────────── 13 · open (fact row) ─────────── */}
      <Section>
        <Cmd>built in the open</Cmd>
        <H2>MIT. Local first. No telemetry.</H2>
        <div className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-3">
          {[
            ["Yours", "Your keys, your files and your prompts stay on your machine. Nothing is collected, ever."],
            ["Open", "MIT licensed, on GitHub and npm. Read it, fork it, or ship a patch."],
            ["Free where it counts", "The solo agent — and joining any room or class — is free forever. Only hosting is paid."],
          ].map(([t, d]) => (
            <div key={t} className="border-t border-border pt-4">
              <h3 className="font-display text-xl font-normal tracking-tight text-foreground">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─────────── 14 · cta ─────────── */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-light tracking-[-0.03em] text-balance text-foreground sm:text-5xl">
            One install. Both minds.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">It runs the moment it opens — no account, no key, nothing to configure.</p>
          <div className="mx-auto mt-8 inline-flex items-center gap-4 rounded-md border border-white/15 bg-[#0d0c0e] px-4 py-3 font-mono text-sm">
            <span className="bg-gradient-to-r from-[#ff7a45] to-[#31d0b4] bg-clip-text text-transparent">❯</span>
            <code className="text-foreground">npm install -g @termcoder/tui</code>
            <CopyButton text="npm install -g @termcoder/tui" />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#" className={cn(buttonVariants(), btn)}>Get the app →</a>
            <a href="#" className={cn(buttonVariants({ variant: "outline" }), btnOutline)}>Read the docs</a>
          </div>
        </div>
      </section>

      {/* ─────────── footer ─────────── */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="flex items-center gap-2.5">
              <Mark size={18} />
              <span className="font-display text-[16px] font-light tracking-tight text-foreground">termcoder</span>
            </a>
            <p className="mt-3 max-w-[32ch] text-sm text-muted-foreground">
              An open-source AI agent for your terminal — a builder and a tutor in one install. Local-first, MIT.
            </p>
          </div>
          {([
            ["Build", ["Features", "Install", "Download", "Docs"]],
            ["Study", ["TermExplorer", "Flashcards", "Classrooms", "Live rooms"]],
            ["Project", ["GitHub", "Changelog", "Pricing", "npm"]],
          ] as const).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">{title}</h4>
              <ul className="mt-4 space-y-2.5">
                {links.map((l) => <li key={l}><a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-6xl items-center justify-between border-t border-border px-6 py-5 font-mono text-xs text-muted-foreground/70">
          <span>termcoder · MIT</span><span>built in the open</span>
        </div>
      </footer>
    </div>
  );
}
