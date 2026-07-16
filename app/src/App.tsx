import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dither } from "@/components/dither";
import { CopyButton } from "@/components/copy-button";

const NAV = ["Build", "Study", "Install", "Download", "Pricing", "Changelog", "Docs"];

const PROVIDERS = [
  "Anthropic", "OpenAI", "Google", "Groq", "Mistral", "DeepSeek",
  "xAI", "OpenRouter", "Together", "Cerebras", "Ollama", "Pollinations",
];

const TOOLS = [
  ["read", "open a file"], ["edit", "change a file"], ["write", "create a file"],
  ["bash", "run a command"], ["grep", "search contents"], ["glob", "find by pattern"],
  ["ls", "list a folder"], ["symbols", "go to definition"], ["repomap", "map the project"],
  ["memory", "recall & save"], ["skill", "load a playbook"], ["recipe", "run a workflow"],
  ["webfetch", "read a URL"], ["websearch", "search the web"], ["diagnostics", "read LSP errors"],
  ["task", "spawn a sub-agent"],
];

const STEPS = [
  ["01", "Install it", "One npm command, or download the desktop app. Node 18+ for the CLI; the app bundles its own."],
  ["02", "Open a folder", "It maps the stack, the scripts and the entry points before you type anything."],
  ["03", "Ask for the change", "Plain language. It reads, edits, runs your tests, and shows you the diff."],
];

const btnBuild = "h-11 rounded-md px-5 text-[14px] font-mono shadow-[0_14px_44px_-14px] shadow-primary/70";
const btnGhost = "h-11 rounded-md px-5 text-[14px] font-mono";

function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.2 21 7v10l-9 4.8L3 17V7l9-4.8Z" stroke="url(#lg)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m8.5 9.5 3 2.5-3 2.5M13.5 14.5H16" stroke="url(#lg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="lg" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff7a45" /><stop offset="1" stopColor="#31d0b4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Cmd({ children, tone = "build" }: { children: React.ReactNode; tone?: "build" | "study" }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
      <span className={tone === "build" ? "text-primary" : "text-study"}>❯</span> {children}
    </p>
  );
}

function H2({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("mt-4 font-display text-4xl font-light tracking-[-0.03em] text-balance text-foreground sm:text-5xl", className)}>
      {children}
    </h2>
  );
}

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">{children}</div>
    </section>
  );
}

function Card({ children, tone = "build" }: { children: React.ReactNode; tone?: "build" | "study" }) {
  return (
    <div className={cn("rounded-md border bg-card p-6", tone === "build" ? "border-border" : "border-study/20")}>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      {/* 00 · nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <a href="#" className="flex items-center gap-2.5 font-display text-lg font-medium tracking-tight text-foreground">
            <Logo /> TermCoder
          </a>
          <nav className="ml-3 hidden items-center gap-5 font-mono text-[13px] text-muted-foreground lg:flex">
            {NAV.map((n) => <a key={n} href="#" className="transition-colors hover:text-foreground">{n}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <a href="#" className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground">Sign in</a>
            <a href="#" className={cn(buttonVariants(), "h-9 rounded-md px-4 font-mono shadow-[0_10px_30px_-12px] shadow-primary/60")}>Get the app →</a>
          </div>
        </div>
      </header>

      {/* 01 · hero */}
      <section className="relative overflow-hidden">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-90" side="both" tone="seam" />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-10">
          <Cmd>open source · MIT · no API key</Cmd>
          <h1 className="mt-5 max-w-[14ch] font-display text-6xl font-light leading-[0.95] tracking-[-0.035em] text-balance text-foreground sm:text-7xl lg:text-[104px]">
            One terminal.{" "}
            <span className="bg-gradient-to-r from-[#ff7a45] via-[#ff9a5f] to-[#31d0b4] bg-clip-text text-transparent">
              Two minds.
            </span>
          </h1>
          <p className="mt-7 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            One is a <span className="text-primary">builder</span> — it reads your repo, edits files, runs your tests and
            loops until they pass. The other is a <span className="text-study">tutor</span> — it explains, drills you with
            flashcards, and tracks what you actually learned. Same engine. Same install. No API key.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#" className={cn(buttonVariants(), btnBuild)}>Get the app →</a>
            <a href="#" className={cn(buttonVariants({ variant: "outline" }), btnGhost)}>Install the CLI</a>
          </div>
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-4 px-6 pb-20 lg:grid-cols-2">
          <div className="overflow-hidden rounded-md border border-primary/25 bg-[#0d0c0e] shadow-[0_40px_100px_-40px_rgba(255,122,69,0.35)]">
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-primary">the builder</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">termcoder/auto</span>
            </div>
            <div className="space-y-1.5 px-4 py-4 font-mono text-[12.5px] leading-relaxed text-[#d7d2cc]">
              <div><span className="text-primary">❯</span> the auth e2e is flaky — fix the refresh token race</div>
              <div className="text-muted-foreground/70">✳ Two requests both rotate the refresh token; the second loses.</div>
              <div><span className="text-[#28c840]">✓</span> read src/auth/token.service.ts <span className="text-muted-foreground/60">168 lines</span></div>
              <div><span className="text-[#28c840]">✓</span> edit src/auth/token.service.ts</div>
              <div className="text-[#ff6b6b]">- const fresh = await this.rotate(token);</div>
              <div className="text-[#58d38c]">+ const fresh = await this.rotateShared(token);</div>
              <div><span className="text-[#28c840]">✓</span> bash npm run test:e2e -- auth</div>
              <div className="text-muted-foreground/70">12 tests, auth.e2e-spec.ts <span className="text-[#28c840]">passing</span></div>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-[10.5px] text-muted-foreground/70">
              <span>3 rounds · verified</span><span className="text-primary">no API key</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-study/25 bg-[#0d0c0e] shadow-[0_40px_100px_-40px_rgba(49,208,180,0.35)]">
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
              <span className="h-2 w-2 rounded-full bg-study shadow-[0_0_8px] shadow-study" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-study">the tutor</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">termexplorer/auto</span>
            </div>
            <div className="space-y-1.5 px-4 py-4 font-mono text-[12.5px] leading-relaxed text-[#d7d2cc]">
              <div><span className="text-study">❯</span> /flashcards race conditions</div>
              <div className="text-muted-foreground/70">✳ Generated 8 cards · added to deck “concurrency”</div>
              <div className="mt-2 rounded-md border border-study/20 bg-study/5 p-3">
                <div className="text-[11px] uppercase tracking-widest text-study/70">card 3 / 8</div>
                <div className="mt-1.5 text-[#e8e4df]">Why does a retry make a race worse?</div>
                <div className="mt-2 text-muted-foreground/70">It adds a second writer to the same window — the loser overwrites the winner.</div>
              </div>
              <div className="mt-2 text-muted-foreground/70">how well did you know it? <span className="text-study">0 1 2 3 4 5</span></div>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-[10.5px] text-muted-foreground/70">
              <span>due tomorrow · SM-2</span><span className="text-study">streak 6 days</span>
            </div>
          </div>
        </div>
      </section>

      {/* 02 · quickstart */}
      <Section>
        <Cmd>quickstart</Cmd>
        <H2>Running in ten seconds.</H2>
        <div className="mt-7 inline-flex items-center gap-4 rounded-md border border-white/15 bg-[#0d0c0e] px-4 py-3 font-mono text-sm">
          <span className="text-primary">❯</span>
          <code className="text-foreground">npm install -g @termcoder/tui</code>
          <CopyButton text="npm install -g @termcoder/tui" />
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(([n, t, d]) => (
            <Card key={n}>
              <div className="font-mono text-[11px] tracking-widest text-primary">{n}</div>
              <h3 className="mt-3 font-display text-xl font-normal tracking-tight text-foreground">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* 03 · models */}
      <Section>
        <Cmd>bring your own model — or none at all</Cmd>
        <H2>It opens on a free model. Twelve more are one command away.</H2>
        <div className="mt-7 flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <span key={p} className="rounded-md border border-border bg-card px-3.5 py-1.5 font-mono text-[13px] text-muted-foreground">{p}</span>
          ))}
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          No card, no sign-up. Connect a key when you want one, or point it at local Ollama to make it private and
          unlimited. Sign in with a Claude or ChatGPT subscription instead of paying per token — both experimental.
        </p>
      </Section>

      {/* 04 · the builder */}
      <Section>
        <Cmd>termcoder</Cmd>
        <h2 className="mt-4 font-display text-5xl font-light tracking-[-0.035em] text-foreground sm:text-6xl">
          The <span className="text-primary">builder</span>.
        </h2>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
          A real agent loop with real tools — not a prompt box with autocomplete. It runs on your machine, behind
          permissions you control, and checks its own work.
        </p>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">Keyless start</div>
            <h3 className="mt-3 font-display text-2xl font-normal tracking-tight text-foreground">You don&apos;t need anything.</h3>
            <div className="mt-4 space-y-1.5 font-mono text-[13px]">
              {["a credit card", "an account to sign up for", "an API key to paste", "a config file to write"].map((x) => (
                <div key={x} className="text-muted-foreground/60"><span className="text-[#ff6b6b]">✗</span> <s>{x}</s></div>
              ))}
              <div className="text-foreground"><span className="text-primary">❯</span> just run it</div>
            </div>
          </Card>
          <Card>
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">The loop</div>
            <h3 className="mt-3 font-display text-2xl font-normal tracking-tight text-foreground">Read, edit, run, verify.</h3>
            <div className="mt-4 space-y-2 font-mono text-[12.5px] text-muted-foreground">
              <div><span className="text-primary">1</span> reads the repo — stack, scripts, entry points</div>
              <div><span className="text-primary">2</span> plans, then edits with minimal diffs</div>
              <div><span className="text-primary">3</span> runs your command and reads the failure</div>
              <div><span className="text-primary">4</span> goes again until it passes</div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Every turn is checkpointed — revert any of it.</p>
          </Card>
        </div>
      </Section>

      {/* 05 · routing */}
      <Section>
        <Cmd>provider/routing.ts</Cmd>
        <H2>The right model, per turn.</H2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          <span className="text-foreground">termcoder/auto</span> classifies the prompt and picks a tier. There is no LLM
          in the routing loop — it is a regex and a table, so it costs nothing and never stalls.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-md border border-border bg-[#0d0c0e] p-5 font-mono text-[12.5px] leading-relaxed text-[#d7d2cc]">
<span className="text-muted-foreground/60">// classify(prompt)</span>{"\n"}
len &gt; 600                        <span className="text-primary">→ complex</span>{"\n"}
/architect|debug|race|security/  <span className="text-primary">→ complex</span>{"\n"}
/across|codebase|multiple files/ <span className="text-primary">→ complex</span>{"\n"}
else                             <span className="text-[#58d38c]">→ simple</span>{"\n"}
{"\n"}
<span className="text-muted-foreground/60">// route(complexity)</span>{"\n"}
<span className="text-[#58d38c]">simple</span>   → tier.fast     <span className="text-muted-foreground/60">gemini-flash · haiku · 4o-mini</span>{"\n"}
<span className="text-primary">complex</span>  → tier.strong   <span className="text-muted-foreground/60">gemini-pro · sonnet · 4o</span>
        </pre>
      </Section>

      {/* 06 · toolbox */}
      <Section>
        <Cmd>the toolbox</Cmd>
        <H2>Sixteen real tools.</H2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every one runs on your machine, behind a permission prompt you can make sticky. Nothing calls home.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          {TOOLS.map(([t, d]) => (
            <div key={t} className="flex items-baseline gap-2 border-b border-border/60 py-2">
              <b className="font-mono text-[13px] font-normal text-foreground">{t}</b>
              <span className="truncate text-[11.5px] text-muted-foreground/70">{d}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 07 · memory & retrieval */}
      <Section>
        <Cmd>memory · retrieval</Cmd>
        <H2>It remembers you, and it finds the file.</H2>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">Memory</div>
            <h3 className="mt-3 font-display text-xl font-normal tracking-tight text-foreground">Tell it once.</h3>
            <div className="mt-4 rounded-md border border-border bg-[#0d0c0e] p-3 font-mono text-[11.5px]">
              <div className="text-muted-foreground/50">~/.termcoder/memory</div>
              <div className="mt-1.5 text-[#d7d2cc]">· uses pnpm, never npm</div>
              <div className="text-[#d7d2cc]">· the auth module is fragile</div>
              <div className="text-[#d7d2cc]">· no barrel files</div>
              <div className="text-[#d7d2cc]">· tests run with npm test</div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Shared with your team through git, or kept private.</p>
          </Card>
          <Card>
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">Retrieval</div>
            <h3 className="mt-3 font-display text-xl font-normal tracking-tight text-foreground">No embeddings. No index server.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Lexical ranking over your project injects <span className="font-mono text-foreground">pointers</span> — file
              paths and symbol locations, not file bodies. Cheap enough to run every turn, so it stops re-reading the repo
              to find where a thing lives.
            </p>
            <div className="mt-4 font-mono text-[11.5px] text-muted-foreground">
              <span className="text-primary">❯</span> symbols resolveModel <span className="text-muted-foreground/50">→ provider.ts:98</span>
            </div>
          </Card>
        </div>
      </Section>

      {/* 08 · autonomous */}
      <Section>
        <Cmd>autonomous</Cmd>
        <H2>Give it a goal and a way to check.</H2>
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <div className="space-y-2 font-mono text-[12.5px]">
              <div className="text-muted-foreground/70">❯ termcoder --background &quot;make the build green&quot;</div>
              <div className="text-muted-foreground">round 1 <span className="text-muted-foreground/50">edit → npm run build</span> <span className="text-[#ff6b6b]">✗ 2 type errors</span></div>
              <div className="text-muted-foreground">round 2 <span className="text-muted-foreground/50">fix types → build</span> <span className="text-[#ff6b6b]">✗ 1 test failing</span></div>
              <div className="text-foreground">round 3 <span className="text-muted-foreground/50">fix test → build</span> <span className="text-[#28c840]">✓ passed</span></div>
            </div>
          </Card>
          <Card>
            <h3 className="font-display text-xl font-normal tracking-tight text-foreground">It stops when it&apos;s true.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              It works, runs your verify command, reads the failure, and goes again — until the command exits zero. Auto-approve
              is on, so every turn is checkpointed and you can walk the whole thing back.
            </p>
          </Card>
        </div>
      </Section>

      {/* 09 · desktop */}
      <Section>
        <Cmd>desktop</Cmd>
        <H2>A real shell, inside the app.</H2>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Card><h3 className="font-display text-lg font-normal text-foreground">Chat, editor, terminal</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">One window. The shell keeps running while you are on the chat tab.</p></Card>
          <Card><h3 className="font-display text-lg font-normal text-foreground">It finds your CLIs</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Scans your PATH and drops a one-click chip on Claude Code, Codex and Gemini.</p></Card>
          <Card><h3 className="font-display text-lg font-normal text-foreground">Windows, macOS, Linux</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Node bundled — nothing to install first. Installers built by CI on every release.</p></Card>
        </div>
      </Section>

      {/* 10 · the seam */}
      <section className="relative overflow-hidden border-t border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-80" side="field" tone="seam" density={0.5} />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <h2 className="mx-auto max-w-[18ch] font-display text-4xl font-light tracking-[-0.03em] text-balance text-foreground sm:text-5xl">
            Same engine.{" "}
            <span className="bg-gradient-to-r from-[#ff7a45] to-[#31d0b4] bg-clip-text text-transparent">Different mind.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Switch the model and the whole personality changes — the tools it gets, the prompt it runs, the way it talks to
            you. The student and the shipper install the same thing.
          </p>
        </div>
      </section>

      {/* 11 · the tutor */}
      <Section>
        <Cmd tone="study">termexplorer</Cmd>
        <h2 className="mt-4 font-display text-5xl font-light tracking-[-0.035em] text-foreground sm:text-6xl">
          The <span className="text-study">tutor</span>.
        </h2>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
          The part no other coding agent has. Built because students shouldn&apos;t need a credit card to learn — and
          because copying an answer teaches nothing.
        </p>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <Card tone="study">
            <div className="font-mono text-[11px] uppercase tracking-widest text-study">Spaced repetition</div>
            <h3 className="mt-3 font-display text-xl font-normal tracking-tight text-foreground">Cards that fight forgetting.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Generate a deck from any topic, grade yourself 0–5, and a real SM-2 scheduler decides when you see each card
              again.
            </p>
            <div className="mt-4 font-mono text-[11.5px] text-muted-foreground"><span className="text-study">❯</span> /flashcards binary search</div>
          </Card>
          <Card tone="study">
            <div className="font-mono text-[11px] uppercase tracking-widest text-study">Progress</div>
            <h3 className="mt-3 font-display text-xl font-normal tracking-tight text-foreground">A streak you can keep.</h3>
            <div className="mt-5 flex items-end gap-1">
              {[3, 5, 2, 6, 4, 7, 5].map((h, i) => <span key={i} className="w-4 rounded-sm bg-study/70" style={{ height: h * 6 }} />)}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Reviews a day and consecutive days — on your machine, not a dashboard we own.</p>
          </Card>
          <Card tone="study">
            <div className="font-mono text-[11px] uppercase tracking-widest text-study">It won&apos;t just answer</div>
            <h3 className="mt-3 font-display text-xl font-normal tracking-tight text-foreground">Worked steps, not solutions.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Homework comes back as steps you can follow, in your language, with a quiz at the end. Learn it — don&apos;t
              paste it.
            </p>
          </Card>
        </div>
      </Section>

      {/* 12 · classrooms & rooms */}
      <Section>
        <Cmd tone="study">classrooms · live rooms</Cmd>
        <H2>Learn together — no server to run.</H2>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card tone="study">
            <h3 className="font-display text-xl font-normal tracking-tight text-foreground">A class, over GitHub.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A teacher creates a class, shares packs of agents and skills, sets assignments and grades submissions. It all
              rides on a private gist — there is nothing to host and nothing to pay for.
            </p>
          </Card>
          <Card tone="study">
            <h3 className="font-display text-xl font-normal tracking-tight text-foreground">Live rooms, peer to peer.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Share a link and someone joins your session — voice, camera, screen share and chat, straight between you. No
              media server. Joining is always free.
            </p>
          </Card>
        </div>
      </Section>

      {/* 13 · open */}
      <Section>
        <Cmd>built in the open</Cmd>
        <H2>MIT. Local first. No telemetry.</H2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card><div className="font-mono text-[11px] uppercase tracking-widest text-primary">Yours</div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Your keys, your files and your prompts stay on your machine. Nothing is collected.</p></Card>
          <Card><div className="font-mono text-[11px] uppercase tracking-widest text-primary">Open</div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">MIT licensed, on GitHub and npm. Fork it, read it, or ship a patch.</p></Card>
          <Card><div className="font-mono text-[11px] uppercase tracking-widest text-study">Free where it counts</div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">The solo agent and joining any room or class are free forever. Hosting is the only paid part.</p></Card>
        </div>
      </Section>

      {/* 14 · cta */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-light tracking-[-0.03em] text-balance text-foreground sm:text-5xl">
            One install. Both minds.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            It runs the moment it opens — no account, no key, nothing to configure.
          </p>
          <div className="mx-auto mt-8 inline-flex items-center gap-4 rounded-md border border-white/15 bg-[#0d0c0e] px-4 py-3 font-mono text-sm">
            <span className="bg-gradient-to-r from-[#ff7a45] to-[#31d0b4] bg-clip-text text-transparent">❯</span>
            <code className="text-foreground">npm install -g @termcoder/tui</code>
            <CopyButton text="npm install -g @termcoder/tui" />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#" className={cn(buttonVariants(), btnBuild)}>Get the app →</a>
            <a href="#" className={cn(buttonVariants({ variant: "outline" }), btnGhost)}>Read the docs</a>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="flex items-center gap-2.5 font-display text-lg font-medium tracking-tight text-foreground">
              <Logo size={22} /> TermCoder
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
          <span>TermCoder · MIT</span><span>built in the open</span>
        </div>
      </footer>
    </div>
  );
}
