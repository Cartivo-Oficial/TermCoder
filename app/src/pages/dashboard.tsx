import { useEffect, useState } from "react";
import { Footer } from "@/components/site/footer";
import { Dither } from "@/components/dither";
import { Mark } from "@/components/mark";
import { cn } from "@/lib/utils";

/**
 * Reads the session and the synced gist in React rather than loading auth.js.
 * auth.js hydrates a dashboard by writing straight into the DOM on
 * DOMContentLoaded — textContent, innerHTML, style — which React would race
 * with and overwrite on its first render. The data contract below is the part
 * that matters, and it matches what callback.html stores: the "tc-session" key,
 * and the private "termcoder:sync" gist the app writes.
 */

const SESSION_KEY = "tc-session";

interface Session {
  provider: string;
  name: string;
  email: string;
  avatar: string;
  token: string;
}

interface Deck {
  name: string;
  cards: number;
  due: number;
}

function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function signOut() {
  localStorage.removeItem(SESSION_KEY);
  location.href = "login.html";
}

/** the app writes {version, data} envelopes; older files are the bare value */
function unwrap(file: { content?: string } | undefined): any {
  if (!file || !file.content) return null;
  try {
    const env = JSON.parse(file.content);
    return env && typeof env === "object" && "data" in env ? env.data : env;
  } catch {
    return null;
  }
}

async function loadSynced(token: string): Promise<{ decks: Deck[]; streak: number } | null> {
  try {
    const headers = { authorization: "Bearer " + token, accept: "application/vnd.github+json" };
    const gists = await (await fetch("https://api.github.com/gists?per_page=100", { headers })).json();
    if (!Array.isArray(gists)) return null;
    const sync = gists.find((g: any) => (g.description || "").indexOf("termcoder:sync") === 0);
    if (!sync) return null;
    const full = await (await fetch("https://api.github.com/gists/" + sync.id, { headers })).json();
    const files = full.files || {};
    const decksRaw = unwrap(files["decks.json"]);
    const progress = unwrap(files["progress.json"]);
    const now = Date.now();
    const decks: Deck[] =
      decksRaw && typeof decksRaw === "object"
        ? Object.keys(decksRaw).map((name) => {
            const cards = (decksRaw[name] && decksRaw[name].cards) || [];
            return {
              name,
              cards: cards.length,
              due: cards.filter((c: any) => !c.due || c.due <= now).length,
            };
          })
        : [];
    return { decks, streak: (progress && (progress.streak || progress.currentStreak)) || 0 };
  } catch {
    return null;
  }
}

const TABS = ["overview", "models", "sessions", "recipes", "connectors", "study", "settings"] as const;
type Tab = (typeof TABS)[number];

const MODELS: [string, string, string][] = [
  ["termcoder/auto", "routes to your best available", "ready"],
  ["termexplorer/auto", "study & schoolwork tutor", "ready"],
  ["termcoderfree/auto", "keyless — no API key needed", "ready"],
  ["anthropic/claude-sonnet-5", "complex tasks", "needs key"],
  ["google/gemini-2.5-pro", "free tier available", "needs key"],
  ["ollama/llama3.1", "local · unlimited · private", "local"],
];

const SESSIONS: [string, string][] = [
  ["Refactor auth middleware", "termcoder/auto · 42 turns"],
  ["Payment webhook debugging", "anthropic/claude-sonnet-5 · 18 turns"],
  ["Krebs cycle — review", "termexplorer/auto · 9 cards"],
  ["Migrate build to esbuild", "termcoder/auto · 27 turns"],
];

const RECIPES: [string, string, string][] = [
  ["open-pr", "branch, push, open a PR", "dev · 3 steps"],
  ["test-and-fix", "run tests, fix failures, re-run", "dev · 3 steps"],
  ["release", "bump, tag, publish", "dev · 3 steps"],
  ["photosynthesis", "guided lesson, one step at a time", "study · 5 steps"],
];

const CONNECTORS: [string, string][] = [
  ["GitHub", "issues, PRs, code · hosted"],
  ["Filesystem", "read & write a chosen folder"],
  ["Web fetch", "fetch a URL as clean markdown"],
  ["PostgreSQL", "query a database, read-only"],
  ["Brave Search", "web & local search"],
];

const SETTINGS: [string, string, string][] = [
  ["Display name", "shown in live rooms", "you"],
  ["Theme", "app color theme", "ember"],
  ["Default model", "used for new sessions", "termcoder/auto"],
  ["Sync via GitHub", "mirror sessions, decks, recipes", "on"],
];

function Eyebrow({ children, sample }: { children: React.ReactNode; sample?: boolean }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
      <span className="text-primary">//</span> {children}
      {sample && (
        <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[9.5px] tracking-normal text-muted-foreground/50">
          sample
        </span>
      )}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 font-display text-3xl font-light tracking-[-0.03em] text-foreground">{children}</h2>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">{children}</p>;
}

function Row({ c1, c2, right }: { c1: string; c2: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-b border-border/60 py-3">
      <span className="w-[38%] shrink-0 font-mono text-[13px] text-foreground">{c1}</span>
      <span className="flex-1 truncate text-[12.5px] text-muted-foreground/70">{c2}</span>
      {right}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "ok" | "local" | "tag" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded border px-2 py-0.5 font-mono text-[10.5px]",
        tone === "ok" && "border-primary/40 text-primary",
        tone === "local" && "border-study/40 text-study",
        !tone && "border-border text-muted-foreground/60",
        tone === "tag" && "border-border text-muted-foreground/60",
      )}
    >
      {children}
    </span>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground/50">{k}</div>
      <div className="mt-1.5 font-mono text-[15px] text-foreground">{v}</div>
    </div>
  );
}

function DeckList({ decks, signedIn }: { decks: Deck[] | null; signedIn: boolean }) {
  if (decks === null || decks.length === 0) {
    return (
      <p className="border-t border-border py-5 text-[13px] text-muted-foreground/60">
        {signedIn ? "No synced decks yet. Create some in the app." : "Sign in and sync from the app to see your study decks here."}
      </p>
    );
  }
  return (
    <div className="mt-2">
      {decks.map((d) => (
        <Row key={d.name} c1={d.name} c2={`${d.cards} ${d.cards === 1 ? "card" : "cards"}`} right={<Badge>{d.due} due</Badge>} />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [session, setSession] = useState<Session | null>(null);
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    const s = readSession();
    setSession(s);
    if (s && s.provider === "github" && s.token) {
      loadSynced(s.token).then((d) => {
        if (!d) return;
        setDecks(d.decks);
        setStreak(d.streak);
      });
    }
  }, []);

  const signedIn = !!session;
  const dash = (n: number | null, unit: string) => (n === null ? "—" : `${n} ${n === 1 ? unit : unit + "s"}`);
  const dueCount = decks ? decks.reduce((a, d) => a + d.due, 0) : null;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-7 px-6">
          <a href="index.html" className="flex items-center gap-2.5">
            <Mark size={20} />
            <span className="font-display text-[17px] font-light tracking-tight text-foreground">termcoder</span>
          </a>
          <nav className="hidden items-center gap-6 font-mono text-[12.5px] text-muted-foreground md:flex">
            <a href="index.html" className="transition-colors hover:text-foreground">home</a>
            <a href="features.html" className="transition-colors hover:text-foreground">features</a>
            <a href="docs.html" className="transition-colors hover:text-foreground">docs</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {session?.avatar && <img src={session.avatar} alt="" className="h-6 w-6 rounded-full" />}
            <span className="hidden font-mono text-[12px] text-muted-foreground sm:block">
              {session?.email || session?.name || "you@example.com"}
            </span>
            <button onClick={signOut} className="font-mono text-[12px] text-muted-foreground transition-colors hover:text-primary">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-40" side="right" tone="seam" band={0.22} />

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[180px_1fr]">
          <aside>
            <div className="sticky top-[84px] flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-2 text-left font-mono text-[12.5px] capitalize transition-colors",
                    tab === t ? "bg-white/[0.06] text-foreground" : "text-muted-foreground/70 hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0">
            {tab === "overview" && (
              <div>
                <Eyebrow>overview</Eyebrow>
                <H2>Welcome back{session?.name ? `, ${session.name.split(" ")[0]}` : ""}.</H2>
                <Sub>
                  Everything you sync from the app and CLI, in one place. Nothing here is billed — TermCoder runs with
                  no API key and no account; this only mirrors your own data.
                </Sub>
                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat k="Default model" v="termcoder/auto" />
                  <Stat k="Study streak" v={dash(streak, "day")} />
                  <Stat k="Due today" v={dueCount === null ? "—" : `${dueCount} cards`} />
                  <Stat k="Decks" v={decks === null ? "—" : String(decks.length)} />
                </div>
                <h3 className="mt-9 font-display text-lg font-normal text-foreground">Your decks</h3>
                <DeckList decks={decks} signedIn={signedIn} />
              </div>
            )}

            {tab === "models" && (
              <div>
                <Eyebrow>models</Eyebrow>
                <H2>Pick your engine.</H2>
                <Sub>
                  Start on the keyless model with no setup, then connect a stronger one whenever you want. TermCoder
                  never downgrades your choice.
                </Sub>
                <div className="mt-7">
                  {MODELS.map(([m, d, badge]) => (
                    <Row
                      key={m}
                      c1={m}
                      c2={d}
                      right={<Badge tone={badge === "ready" ? "ok" : badge === "local" ? "local" : undefined}>{badge}</Badge>}
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === "sessions" && (
              <div>
                <Eyebrow sample>sessions</Eyebrow>
                <H2>Your work, synced.</H2>
                <Sub>
                  Session sync is on the way — once it lands, the sessions you sync via GitHub will show up here so you
                  can resume on any machine. Below is a sample of how it looks.
                </Sub>
                <div className="mt-7">
                  {SESSIONS.map(([n, d]) => (
                    <Row
                      key={n}
                      c1={n}
                      c2={d}
                      right={
                        <a href="download.html" className="shrink-0 font-mono text-[11.5px] text-primary">
                          Open
                        </a>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === "recipes" && (
              <div>
                <Eyebrow sample>recipes</Eyebrow>
                <H2>Saved workflows.</H2>
                <Sub>
                  Named, shareable multi-step tasks — dev automations that run in order, or study lessons taught one
                  step at a time. You create and run these in the app today; syncing them here is on the way. Below is a
                  sample.
                </Sub>
                <div className="mt-7">
                  {RECIPES.map(([n, d, tag]) => (
                    <Row key={n} c1={n} c2={d} right={<Badge tone="tag">{tag}</Badge>} />
                  ))}
                </div>
              </div>
            )}

            {tab === "connectors" && (
              <div>
                <Eyebrow>connectors</Eyebrow>
                <H2>One-click MCP.</H2>
                <Sub>
                  Add a Model Context Protocol server without memorizing commands. Pick a connector, fill in what it
                  needs, and its tools appear to the agent.
                </Sub>
                <div className="mt-7">
                  {CONNECTORS.map(([n, d]) => (
                    <Row
                      key={n}
                      c1={n}
                      c2={d}
                      right={
                        <a href="docs.html" className="shrink-0 font-mono text-[11.5px] text-primary">
                          Add
                        </a>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === "study" && (
              <div>
                <Eyebrow>study</Eyebrow>
                <H2>Decks &amp; streak.</H2>
                <Sub>
                  TermExplorer turns the same engine into a tutor — spaced-repetition flashcards that resurface at the
                  right time. Your decks and streak sync here.
                </Sub>
                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  <Stat k="Current streak" v={dash(streak, "day")} />
                  <Stat k="Due today" v={dueCount === null ? "—" : `${dueCount} cards`} />
                  <Stat k="Decks" v={decks === null ? "—" : String(decks.length)} />
                </div>
                <div className="mt-7">
                  <DeckList decks={decks} signedIn={signedIn} />
                </div>
              </div>
            )}

            {tab === "settings" && (
              <div>
                <Eyebrow sample>settings</Eyebrow>
                <H2>Your preferences.</H2>
                <Sub>
                  These travel with your account. Everything is optional — sensible defaults are already set. Editing
                  them here is on the way; the values below are the defaults.
                </Sub>
                <div className="mt-7">
                  {SETTINGS.map(([n, d, v]) => (
                    <Row
                      key={n}
                      c1={n}
                      c2={d}
                      right={v === "on" ? <Badge tone="ok">on</Badge> : <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{v}</span>}
                    />
                  ))}
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a href="docs.html" className="rounded-md border border-border px-4 py-2 font-mono text-[12.5px] text-foreground transition-colors hover:border-white/25">
                    Read the docs
                  </a>
                  <button onClick={signOut} className="rounded-md border border-border px-4 py-2 font-mono text-[12.5px] text-foreground transition-colors hover:border-white/25">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
