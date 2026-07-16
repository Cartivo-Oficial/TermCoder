import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dither } from "@/components/dither";
import { CopyButton } from "@/components/copy-button";

const NAV = ["Home", "Features", "Study", "Install", "Download", "Pricing", "Changelog", "Docs"];

const PROVIDERS = [
  "Anthropic", "OpenAI", "Google", "Groq", "Mistral", "DeepSeek", "xAI", "Ollama · local", "Pollinations · free",
];

const STEPS = [
  { n: "01", t: "You prompt", d: "Describe the change in plain language. No special syntax, no config to write first." },
  { n: "02", t: "It works the repo", d: "Reads files, plans, edits, and runs commands — every tool behind a permission prompt you can make sticky." },
  { n: "03", t: "It verifies", d: "Runs your tests, reads the failure, and goes again until they pass. Every turn is checkpointed to walk back." },
];

const FEATURES = [
  { k: "Keyless start", t: "No API key.", d: "Opens on a community-hosted model. Point it at local Ollama to make it private and unlimited." },
  { k: "Model routing", t: "The right model per turn.", d: "A regex-and-tier router sends simple turns to a fast model, the hard ones to a strong one." },
  { k: "Memory", t: "It remembers.", d: "Tell it your stack and the fragile module once — it keeps that across sessions." },
  { k: "Study tutor", t: "A tutor built in.", d: "TermExplorer explains, drills flashcards with spaced repetition, and tracks a streak." },
  { k: "Autonomous", t: "Give it a goal.", d: "Hand it a task and a verify command; it loops until the command passes." },
  { k: "Desktop", t: "A shell in the app.", d: "Chat, an editor, and a real terminal in one window — with live rooms for pairing." },
];

const btnPrimary = "h-11 rounded-lg px-5 text-[14px] font-mono shadow-[0_12px_38px_-12px] shadow-primary/70";
const btnPrimaryLg = "h-12 rounded-lg px-6 text-[15px] font-mono shadow-[0_14px_44px_-12px] shadow-primary/70";
const btnGhostLg = "h-12 rounded-lg px-6 text-[15px] font-mono";

function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.2 21 7v10l-9 4.8L3 17V7l9-4.8Z" stroke="#ff7a45" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m8.5 9.5 3 2.5-3 2.5M13.5 14.5H16" stroke="#ff7a45" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
      <span className="text-primary">//</span> {children}
    </p>
  );
}

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <a href="#" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
            <Logo /> TermCoder
          </a>
          <nav className="ml-3 hidden items-center gap-5 font-mono text-[13px] text-muted-foreground lg:flex">
            {NAV.map((n, i) => (
              <a key={n} href="#" className={cn("transition-colors hover:text-foreground", i === 0 && "text-foreground")}>
                {n}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <a href="#" className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground">
              Sign in
            </a>
            <a href="#" className={cn(buttonVariants(), btnPrimary)}>Get the app →</a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-90" />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-4">
          <Eyebrow>Open source · MIT</Eyebrow>
          <h1 className="mt-5 max-w-[15ch] font-display text-6xl font-semibold leading-[0.92] tracking-tight text-balance sm:text-7xl lg:text-8xl">
            Code with{" "}
            <span className="bg-gradient-to-b from-[#ffb06b] to-[#ff6a2b] bg-clip-text text-transparent">
              no API key.
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
            An open-source AI coding agent for your terminal — and a desktop app with a real shell inside it. It reads
            the repo, edits files, runs commands, and routes each turn to the right model on its own.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3.5">
            <a href="#" className={cn(buttonVariants(), btnPrimaryLg)}>Get the app →</a>
            <a href="#" className={cn(buttonVariants({ variant: "outline" }), btnGhostLg)}>Install the CLI</a>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pt-14 pb-24">
          <div className="mb-3 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_9px] shadow-primary" />
            <span className="text-foreground">the terminal</span>
            <span className="text-muted-foreground/60">— a real recorded session</span>
            <a href="#" className="ml-auto text-primary">See what it does →</a>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-[#0d0c0e] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-xs text-muted-foreground/70">term — ~/my-project</span>
            </div>
            <div className="space-y-1.5 px-5 py-4 font-mono text-[13px] leading-relaxed text-[#d7d2cc]">
              <div><span className="text-primary">❯</span> add a --version flag that prints the version from package.json, then run the tests</div>
              <div><span className="text-[#28c840]">✓</span> read cli.js <span className="text-muted-foreground/60">· read package.json</span></div>
              <div><span className="text-[#28c840]">✓</span> edit cli.js</div>
              <div className="text-[#58d38c]">+ const {"{ version }"} = require(&quot;./package.json&quot;);</div>
              <div className="text-[#58d38c]">+ if (args.includes(&quot;--version&quot;)) return console.log(version);</div>
              <div><span className="text-[#28c840]">✓</span> bash npm test <span className="text-muted-foreground/60">· 14 passing</span></div>
              <div className="text-muted-foreground/70">Added a --version flag reading name + version from package.json. All tests pass.</div>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 font-mono text-[11px] text-muted-foreground/70">
              <span>Build · termcoderfree/auto</span>
              <span className="text-primary">no API key</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Eyebrow>Bring your own model</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Runs on the models you already have.
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Start on a free, keyless model — no card, no sign-up. Connect a provider whenever you want, or point it at a
            local one. termcoder/auto routes each turn to the right tier for you.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            {PROVIDERS.map((p) => (
              <Badge key={p} variant="outline" className="rounded-lg border-border bg-card px-3.5 py-1.5 font-mono text-[13px] font-normal text-muted-foreground">
                {p}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            A real agent loop — not a prompt box.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-border bg-card p-6">
                <div className="font-mono text-xs tracking-widest text-primary">STEP {s.n}</div>
                <h3 className="mt-3 font-display text-xl font-medium tracking-tight">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Eyebrow>What&apos;s inside</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Everything the work needs, on your machine.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.k} className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-white/20">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-primary">{f.k}</span>
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground/60">LIVE</span>
                </div>
                <h3 className="mt-3 font-display text-xl font-medium tracking-tight">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(120%_140%_at_50%_0%,rgba(255,122,69,0.14),transparent_60%)]" />
          <div className="relative">
            <h2 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Start in your terminal.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              One install, no account, no key. It runs the moment it opens.
            </p>
            <div className="mx-auto mt-7 inline-flex items-center gap-4 rounded-xl border border-white/15 bg-[#0d0c0e] px-4 py-3 font-mono text-sm">
              <span className="text-primary">❯</span>
              <code>npm install -g @termcoder/tui</code>
              <CopyButton text="npm install -g @termcoder/tui" />
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-3.5">
              <a href="#" className={cn(buttonVariants(), btnPrimaryLg)}>Get the app →</a>
              <a href="#" className={cn(buttonVariants({ variant: "outline" }), btnGhostLg)}>Read the docs</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
              <Logo size={22} /> TermCoder
            </a>
            <p className="mt-3 max-w-[32ch] text-sm text-muted-foreground">
              The open-source AI coding agent for your terminal. Free and local-first, with a study tutor built in.
            </p>
          </div>
          {([
            ["Product", ["Features", "Download", "Install", "Pricing"]],
            ["Resources", ["Docs", "Changelog", "Study", "npm"]],
            ["Community", ["GitHub", "Discord", "Sign in"]],
          ] as const).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">{title}</h4>
              <ul className="mt-4 space-y-2.5">
                {links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l}</a>
                  </li>
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
