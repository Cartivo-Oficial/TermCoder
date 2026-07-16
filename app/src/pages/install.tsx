import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Dither } from "@/components/dither";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS: [string, string, string | null, string][] = [
  [
    "Install it",
    "One command on Windows, macOS or Linux. It adds two equivalent binaries — `term` and `termcoder`.",
    "npm install -g @termcoder/tui",
    "Needs Node.js 18 or newer. No Node? Grab the desktop app instead — it bundles its own.",
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

export default function Install() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="install" />

      <section className="relative overflow-hidden border-b border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-70" side="both" tone="seam" band={0.2} />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            <span className="text-primary">❯</span> install
          </p>
          <h1 className="mt-5 max-w-[16ch] font-display text-5xl font-light leading-[1] tracking-[-0.035em] text-foreground sm:text-6xl">
            One command, every platform.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            No account, no API key, no config file. Install it and ask it something — that is the whole setup.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-md border border-white/15 bg-[#0d0c0e] px-4 py-3 font-mono text-[14px]">
            <span className="text-primary">❯</span>
            <code className="text-foreground">npm install -g @termcoder/tui</code>
            <CopyButton text="npm install -g @termcoder/tui" />
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <ol className="relative">
          <span className="absolute left-[15px] top-4 bottom-4 hidden w-px bg-border sm:block" />
          {STEPS.map(([title, body, cmd, note], i) => (
            <li key={title} className="relative grid gap-5 pb-12 last:pb-0 sm:grid-cols-[32px_1fr]">
              <span className="relative z-10 hidden h-8 w-8 items-center justify-center rounded-full border border-border bg-background font-mono text-[12px] text-primary sm:flex">
                {i + 1}
              </span>
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-normal tracking-tight text-foreground">{title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                  {body.split(/`([^`]+)`/).map((part, j) =>
                    j % 2 === 1 ? (
                      <code key={j} className="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.9em] text-foreground">{part}</code>
                    ) : (
                      part
                    ),
                  )}
                </p>
                {cmd && (
                  <div className="mt-4 inline-flex items-center gap-3 rounded-md border border-border bg-[#0d0c0e] px-3.5 py-2.5 font-mono text-[13px]">
                    <code className="text-foreground">{cmd}</code>
                    <CopyButton text={cmd.replace(/^❯\s*/, "")} />
                  </div>
                )}
                <p className="mt-3 font-mono text-[11.5px] leading-relaxed text-muted-foreground/60">
                  {note.split(/`([^`]+)`/).map((part, j) =>
                    j % 2 === 1 ? <span key={j} className="text-foreground">{part}</span> : part,
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-8 border-t border-border pt-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-normal tracking-tight text-foreground">Rather have a window?</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The desktop app is the same engine with chat, an editor and a real terminal side by side — and it bundles
              Node, so it needs nothing installed first.
            </p>
            <a href="download.html" className={cn(buttonVariants(), "mt-5 h-11 rounded-md px-5 font-mono text-[14px] shadow-[0_14px_44px_-14px] shadow-primary/70")}>
              Get the app →
            </a>
          </div>
          <div>
            <h2 className="font-display text-2xl font-normal tracking-tight text-foreground">Want it private?</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Point it at a local model and nothing leaves your machine — no account, no third party, no limits.
            </p>
            <div className="mt-4 space-y-2 font-mono text-[12.5px] text-muted-foreground">
              <div><span className="text-primary">❯</span> ollama pull qwen2.5-coder</div>
              <div><span className="text-primary">❯</span> /model <span className="text-muted-foreground/50">→ pick it under Local</span></div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
