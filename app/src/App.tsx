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

const btnBuild = "h-12 rounded-lg px-6 text-[15px] font-mono shadow-[0_14px_44px_-12px] shadow-primary/70";
const btnGhost = "h-12 rounded-lg px-6 text-[15px] font-mono";

function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.2 21 7v10l-9 4.8L3 17V7l9-4.8Z" stroke="url(#g)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m8.5 9.5 3 2.5-3 2.5M13.5 14.5H16" stroke="url(#g)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="g" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff7a45" /><stop offset="1" stopColor="#31d0b4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Cmd({ children, tone = "build" }: { children: React.ReactNode; tone?: "build" | "study" }) {
  return (
    <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">
      <span className={tone === "build" ? "text-primary" : "text-study"}>❯</span> {children}
    </p>
  );
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("border-t border-border", className)}>
    <div className="mx-auto max-w-6xl px-6 py-20">{children}</div>
  </section>;
}

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      {/* ── nav ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <a href="#" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
            <Logo /> TermCoder
          </a>
          <nav className="ml-3 hidden items-center gap-5 font-mono text-[13px] text-muted-foreground lg:flex">
            {NAV.map((n) => (
              <a key={n} href="#" className="transition-colors hover:text-foreground">{n}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <a href="#" className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground">Sign in</a>
            <a href="#" className={cn(buttonVariants(), "h-10 rounded-lg px-4 font-mono shadow-[0_10px_30px_-10px] shadow-primary/60")}>Get the app →</a>
          </div>
        </div>
      </header>

      {/* ── hero: the duality ── */}
      <section className="relative overflow-hidden">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-90" side="both" tone="seam" />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-10">
          <Cmd>open source · MIT · no API key</Cmd>
          <h1 className="mt-5 max-w-[13ch] font-display text-6xl font-semibold leading-[0.92] tracking-tight text-balance sm:text-7xl lg:text-8xl">
            One terminal.{" "}
            <span className="bg-gradient-to-r from-[#ff7a45] via-[#ff9a5f] to-[#31d0b4] bg-clip-text text-transparent">
              Two minds.
            </span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            One is a <span className="text-primary">builder</span> — it reads your repo, edits files, runs your tests,
            and loops until they pass. The other is a <span className="text-study">tutor</span> — it explains, drills you
            with flashcards, and tracks what you actually learned. Same engine. Same install. No API key.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3.5">
            <a href="#" className={cn(buttonVariants(), btnBuild)}>Get the app →</a>
            <a href="#" className={cn(buttonVariants({ variant: "outline" }), btnGhost)}>Install the CLI</a>
          </div>
        </div>

        {/* two live panels */}
        <div className="relative mx-auto grid max-w-6xl gap-4 px-6 pb-20 lg:grid-cols-2">
          {/* builder */}
          <div className="overflow-hidden rounded-xl border border-primary/25 bg-[#0d0c0e] shadow-[0_40px_100px_-40px_rgba(255,122,69,0.35)]">
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

          {/* tutor */}
          <div className="overflow-hidden rounded-xl border border-study/25 bg-[#0d0c0e] shadow-[0_40px_100px_-40px_rgba(49,208,180,0.35)]">
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
              <span className="h-2 w-2 rounded-full bg-study shadow-[0_0_8px] shadow-study" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-study">the tutor</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">termexplorer/auto</span>
            </div>
            <div className="space-y-1.5 px-4 py-4 font-mono text-[12.5px] leading-relaxed text-[#d7d2cc]">
              <div><span className="text-study">❯</span> /flashcards race conditions</div>
              <div className="text-muted-foreground/70">✳ Generated 8 cards · added to deck “concurrency”</div>
              <div className="mt-2 rounded-lg border border-study/20 bg-study/5 p-3">
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

      {/* ── providers ── */}
      <Section>
        <Cmd>bring your own model — or none at all</Cmd>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          It opens on a free model. Twelve more are one command away.
        </h2>
        <div className="mt-7 flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <span key={p} className="rounded-lg border border-border bg-card px-3.5 py-1.5 font-mono text-[13px] text-muted-foreground">
              {p}
            </span>
          ))}
        </div>
        <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
          No card, no sign-up. <span className="text-foreground">termcoder/auto</span> classifies each turn and routes it
          to the right tier — a fast model for a typo, a strong one for a refactor. Point it at local Ollama to make it
          private and unlimited.
        </p>
      </Section>

      {/* ══ CHAPTER: BUILD ══ */}
      <Section>
        <Cmd>termcoder</Cmd>
        <h2 className="mt-4 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
          The <span className="text-primary">builder</span>.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          A real agent loop with real tools — not a prompt box with autocomplete. It runs on your machine, behind
          permissions you control.
        </p>

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">Keyless start</div>
            <h3 className="mt-3 font-display text-2xl font-medium tracking-tight">You don&apos;t need anything.</h3>
            <div className="mt-4 space-y-1.5 font-mono text-[13px]">
              {["a credit card", "an account to sign up for", "an API key to paste", "a config file to write"].map((x) => (
                <div key={x} className="text-muted-foreground/60"><span className="text-[#ff6b6b]">✗</span> <s>{x}</s></div>
              ))}
              <div className="text-foreground"><span className="text-primary">❯</span> just run it</div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">Model routing</div>
            <h3 className="mt-3 font-display text-2xl font-medium tracking-tight">The right model, per turn.</h3>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-[#0d0c0e] p-3 font-mono text-[12px] leading-relaxed text-[#d7d2cc]">
<span className="text-muted-foreground/60">// classify(prompt)</span>{"\n"}
len &gt; 600                <span className="text-primary">→ complex</span>{"\n"}
/architect|debug|race/   <span className="text-primary">→ complex</span>{"\n"}
/across|codebase/        <span className="text-primary">→ complex</span>{"\n"}
else                     <span className="text-[#58d38c]">→ simple</span>{"\n"}
{"\n"}
<span className="text-muted-foreground/60">// route(complexity)</span>{"\n"}
<span className="text-[#58d38c]">simple</span>  → tier.fast    <span className="text-muted-foreground/60">flash / haiku</span>{"\n"}
<span className="text-primary">complex</span> → tier.strong  <span className="text-muted-foreground/60">pro / sonnet</span>
            </pre>
            <p className="mt-3 text-xs text-muted-foreground">No LLM in the routing loop — a regex and a tier table.</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-card p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary">The toolbox</div>
              <h3 className="mt-3 font-display text-2xl font-medium tracking-tight">Sixteen real tools.</h3>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground/60">every one behind a permission</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
            {TOOLS.map(([t, d]) => (
              <div key={t} className="flex items-baseline gap-2 border-b border-border/60 py-1.5">
                <b className="font-mono text-[13px] font-normal text-foreground">{t}</b>
                <span className="truncate text-[11.5px] text-muted-foreground/70">{d}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">Memory</div>
            <h3 className="mt-3 font-display text-xl font-medium tracking-tight">It remembers you.</h3>
            <div className="mt-4 rounded-lg border border-border bg-[#0d0c0e] p-3 font-mono text-[11.5px] text-muted-foreground">
              <div className="text-muted-foreground/50">~/.termcoder/memory</div>
              <div className="mt-1.5 text-[#d7d2cc]">· uses pnpm, never npm</div>
              <div className="text-[#d7d2cc]">· auth module is fragile</div>
              <div className="text-[#d7d2cc]">· no barrel files</div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">Autonomous</div>
            <h3 className="mt-3 font-display text-xl font-medium tracking-tight">Give it a goal.</h3>
            <div className="mt-4 space-y-1.5 font-mono text-[11.5px]">
              <div className="text-muted-foreground">round 1 <span className="text-[#ff6b6b]">✗ 2 type errors</span></div>
              <div className="text-muted-foreground">round 2 <span className="text-[#ff6b6b]">✗ 1 test failing</span></div>
              <div className="text-foreground">round 3 <span className="text-[#28c840]">✓ build passed</span></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Checkpointed every turn — walk it back anytime.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">Desktop</div>
            <h3 className="mt-3 font-display text-xl font-medium tracking-tight">A shell in the app.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Chat, an editor, and a real terminal in one window. It finds Claude Code, Codex and Gemini on your PATH and
              gives each a one-click chip.
            </p>
          </div>
        </div>
      </Section>

      {/* ══ THE SEAM ══ */}
      <section className="relative overflow-hidden border-t border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-80" side="field" tone="seam" density={0.5} />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <h2 className="mx-auto max-w-[18ch] font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Same engine.{" "}
            <span className="bg-gradient-to-r from-[#ff7a45] to-[#31d0b4] bg-clip-text text-transparent">
              Different mind.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Switch the model and the whole personality changes — the tools, the prompt, the way it talks to you. One
            install. The student and the shipper get the same engine.
          </p>
        </div>
      </section>

      {/* ══ CHAPTER: STUDY ══ */}
      <Section>
        <Cmd tone="study">termexplorer</Cmd>
        <h2 className="mt-4 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
          The <span className="text-study">tutor</span>.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          The part no other coding agent has. Built because students shouldn&apos;t need a credit card to learn — and
          because copying an answer teaches nothing.
        </p>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-study/20 bg-card p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-study">Spaced repetition</div>
            <h3 className="mt-3 font-display text-xl font-medium tracking-tight">Flashcards that fight forgetting.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Generate a deck from any topic, then grade yourself 0–5. A real SM-2 scheduler decides when you see each
              card again.
            </p>
            <div className="mt-4 font-mono text-[11.5px] text-muted-foreground">
              <span className="text-study">❯</span> /flashcards binary search
            </div>
          </div>
          <div className="rounded-xl border border-study/20 bg-card p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-study">Progress</div>
            <h3 className="mt-3 font-display text-xl font-medium tracking-tight">A streak you can keep.</h3>
            <div className="mt-4 flex items-end gap-1">
              {[3, 5, 2, 6, 4, 7, 5].map((h, i) => (
                <span key={i} className="w-4 rounded-sm bg-study/70" style={{ height: h * 6 }} />
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Reviews per day and consecutive days, kept on your machine.</p>
          </div>
          <div className="rounded-xl border border-study/20 bg-card p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-study">Classrooms</div>
            <h3 className="mt-3 font-display text-xl font-medium tracking-tight">A class, over GitHub.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A teacher creates a class, shares packs, sets assignments and grades submissions. No server — it rides on
              a private gist.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-study/20 bg-card p-6">
          <div className="font-mono text-[11px] uppercase tracking-widest text-study">Live rooms</div>
          <h3 className="mt-3 font-display text-2xl font-medium tracking-tight">Study together, in the app.</h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Share a link and someone joins your session — voice, camera, screen share, and a chat, peer-to-peer. Joining
            is always free; the host runs the room.
          </p>
        </div>
      </Section>

      {/* ══ converge ══ */}
      <section className="relative overflow-hidden border-t border-border px-6 py-24">
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            One install. Both minds.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            It runs the moment it opens — no account, no key, nothing to configure.
          </p>
          <div className="mx-auto mt-8 inline-flex items-center gap-4 rounded-xl border border-white/15 bg-[#0d0c0e] px-4 py-3 font-mono text-sm">
            <span className="bg-gradient-to-r from-[#ff7a45] to-[#31d0b4] bg-clip-text text-transparent">❯</span>
            <code>npm install -g @termcoder/tui</code>
            <CopyButton text="npm install -g @termcoder/tui" />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3.5">
            <a href="#" className={cn(buttonVariants(), btnBuild)}>Get the app →</a>
            <a href="#" className={cn(buttonVariants({ variant: "outline" }), btnGhost)}>Read the docs</a>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
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
                {links.map((l) => (
                  <li key={l}><a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-6xl items-center justify-between border-t border-border px-6 py-5 font-mono text-xs text-muted-foreground/70">
          <span>TermCoder · MIT</span>
          <span>built in the open</span>
        </div>
      </footer>
    </div>
  );
}
