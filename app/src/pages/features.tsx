import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Dither } from "@/components/dither";

const KEYS: [string, string][] = [
  ["shift+tab", "switch between Build and Plan"],
  ["@", "mention a file into the prompt"],
  ["/", "slash commands, with a live menu"],
  ["$", "hand the task to a sub-agent"],
  ["ctrl+p", "the command palette"],
  ["esc", "stop the turn"],
];

const AGENTS: [string, string, string][] = [
  ["build", "mutate", "the default — reads, edits, runs"],
  ["plan", "read-only", "proposes without touching a file"],
  ["explore", "read-only", "broad search, reports back"],
  ["reviewer", "read-only", "reads the diff for real bugs"],
  ["architect", "read-only", "designs before anyone edits"],
  ["tester", "mutate", "writes and runs the tests"],
  ["debugger", "mutate", "reproduces, then fixes"],
];

function Row({ children }: { children: React.ReactNode }) {
  return <section className="border-t border-border py-16"><div className="mx-auto max-w-6xl px-6">{children}</div></section>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">{children}</p>;
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 max-w-[20ch] font-display text-3xl font-light leading-[1.1] tracking-[-0.03em] text-foreground sm:text-4xl">{children}</h2>;
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{children}</p>;
}

export default function Features() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav />

      <section className="relative overflow-hidden border-b border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-70" side="both" tone="warm" band={0.2} />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            <span className="text-primary">❯</span> termcoder · the builder
          </p>
          <h1 className="mt-5 max-w-[14ch] font-display text-5xl font-light leading-[1] tracking-[-0.035em] text-foreground sm:text-6xl">
            Everything it does.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            A real agent loop with real tools, on your machine, behind permissions you control. No prompt box with
            autocomplete — it reads, plans, edits, runs, and checks its own work.
          </p>
        </div>
      </section>

      {/* no key */}
      <Row>
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <Label>no key</Label>
            <Title>It runs before you configure anything.</Title>
            <Body>
              TermCoder opens on a keyless, community-hosted model. It is rate-limited when busy and your prompts go to a
              third party we do not run — so it is an on-ramp, not the destination. Point it at Ollama for privacy, or
              connect a provider for quality. Both take one command.
            </Body>
          </div>
          <div className="rounded-md border border-border bg-card p-5">
            <div className="space-y-2 font-mono text-[13px]">
              {["a credit card", "an account", "an API key", "a config file"].map((x) => (
                <div key={x} className="text-muted-foreground/50"><span className="text-[#ff6b6b]">✗</span> <s>{x}</s></div>
              ))}
              <div className="pt-1 text-foreground"><span className="text-primary">❯</span> just run it</div>
            </div>
          </div>
        </div>
      </Row>

      {/* terminal-first */}
      <Row>
        <Label>terminal-first</Label>
        <Title>Built for the keyboard.</Title>
        <Body>
          Multi-line input with real cursor movement, {<code className="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.9em] text-foreground">@file</code>} mentions with a preview, a live slash-command menu, syntax
          highlighting, diffs with line numbers, and a trust prompt before the interface ever appears.
        </Body>
        <div className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {KEYS.map(([k, d]) => (
            <div key={k} className="flex items-baseline gap-3 border-b border-border/60 py-2.5">
              <code className="font-mono text-[12.5px] text-primary">{k}</code>
              <span className="text-[12px] text-muted-foreground/70">{d}</span>
            </div>
          ))}
        </div>
      </Row>

      {/* modes + auto */}
      <Row>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Label>modes</Label>
            <Title>Plan first, or just go.</Title>
            <Body>
              Plan reads and proposes without touching a file. Build carries it out. {<code className="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.9em] text-foreground">shift+tab</code>} flips between them mid-session,
              so you can think before you commit to a change.
            </Body>
          </div>
          <div>
            <Label>termcoder/auto</Label>
            <Title>A brain that reviews itself.</Title>
            <Body>
              On a build turn that edited files, it runs a grounded review pass over the real {<code className="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.9em] text-foreground">git diff</code>} — and if it finds a
              genuine bug, it fixes it before handing back. It also escalates to a stronger model when the first one errors.
            </Body>
          </div>
        </div>
      </Row>

      {/* specialists */}
      <Row>
        <Label>specialists</Label>
        <Title>Sub-agents, each with its own permissions.</Title>
        <Body>
          Hand a focused sub-task to a specialist and it works in a nested session, then reports back a summary. Read-only
          agents cannot edit — the permission is enforced by the tool filter, not by asking nicely.
        </Body>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-border font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
                <th className="pb-2 font-normal">agent</th>
                <th className="pb-2 font-normal">access</th>
                <th className="pb-2 font-normal">what it is for</th>
              </tr>
            </thead>
            <tbody>
              {AGENTS.map(([name, access, what]) => (
                <tr key={name} className="border-b border-border/60">
                  <td className="py-2.5 font-mono text-[13px] text-foreground">{name}</td>
                  <td className={`py-2.5 font-mono text-[12px] ${access === "mutate" ? "text-primary" : "text-muted-foreground/60"}`}>{access}</td>
                  <td className="py-2.5 text-[13px] text-muted-foreground">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5 max-w-xl font-mono text-[12px] text-muted-foreground/60">
          Drop a markdown file in <span className="text-foreground">.termcoder/agents/</span> to define your own — with its
          own model, prompt, tools, and per-path permissions.
        </p>
      </Row>

      {/* permissions */}
      <Row>
        <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            <Label>permissions · checkpoints</Label>
            <Title>Nothing happens without you.</Title>
            <Body>
              Every tool that touches your machine asks first, and you can make an answer sticky. Permissions can be scoped
              per path — let it edit {<code className="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.9em] text-foreground">docs/**</code>} and nothing else.
            </Body>
          </div>
          <div className="rounded-md border border-border bg-[#0d0c0e] p-5 font-mono text-[12.5px] leading-relaxed">
            <div className="text-muted-foreground/50">.termcoder/agents/docs-writer.md</div>
            <div className="mt-2 text-[#d7d2cc]">
              <div><span className="text-muted-foreground/50">---</span></div>
              <div>edit: {"{"} <span className="text-[#58d38c]">&quot;docs/**&quot;: allow</span>, <span className="text-[#ff6b6b]">&quot;**&quot;: deny</span> {"}"}</div>
              <div>bash: ask</div>
              <div><span className="text-muted-foreground/50">---</span></div>
            </div>
            <p className="mt-4 text-[11.5px] text-muted-foreground/60">
              Last match wins. And every turn is checkpointed — <span className="text-foreground">/revert</span> walks the
              whole thing back, including the files.
            </p>
          </div>
        </div>
      </Row>

      {/* github backbone */}
      <Row>
        <Label>github backbone</Label>
        <Title>Sync, share and packs — with no server.</Title>
        <Body>
          Your favourites, drafts, decks and progress mirror to one private gist, so a second machine picks up where you
          left off. Sessions publish to a gist and open in a read-only viewer. Packs bundle your agents, skills and
          commands so a team — or a class — installs your whole setup in one command.
        </Body>
        <div className="mt-7 grid gap-x-10 gap-y-2 font-mono text-[12.5px] sm:grid-cols-3">
          {[["/sync", "mirror to a private gist"], ["/publish", "share a session, read-only"], ["/pack install", "someone else's setup"]].map(([c, d]) => (
            <div key={c} className="border-t border-border pt-2.5">
              <div className="text-primary">{c}</div>
              <div className="text-[11px] text-muted-foreground/60">{d}</div>
            </div>
          ))}
        </div>
      </Row>

      {/* extend */}
      <Row>
        <Label>extend</Label>
        <Title>MCP, language servers, plugins.</Title>
        <Body>
          Connect MCP servers from a curated one-click catalogue — filesystem, git, github, postgres, brave-search and more
          — and their tools sit next to the built-ins. Language servers give it a {<code className="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.9em] text-foreground">diagnostics</code>} tool that returns your real
          compiler errors. A plugin is a module that exports {<code className="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.9em] text-foreground">{"{ name, register }"}</code>}.
        </Body>
        <p className="mt-5 font-mono text-[12px] text-muted-foreground/60">
          Anything that fails to load is reported, and never blocks startup.
        </p>
      </Row>

      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground sm:text-4xl">
            And when you want to learn it, not just ship it —
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            the same install has a tutor inside. Same engine, different mind.
          </p>
          <a href="study.html" className="mt-6 inline-block font-mono text-[13px] text-study">Meet the tutor →</a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
