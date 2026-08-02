import { useEffect, useRef, useState } from "react";
import { Footer } from "@/components/site/footer";
import { Mark } from "@/components/mark";
import { cn } from "@/lib/utils";
import { readSession, signOut, type Session } from "@/lib/session";
import { LicencePanel } from "@/components/licence-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { ConnectorsPanel } from "@/components/connectors-panel";
import { createOptimisticQueue, findSyncGist, readStore, writeStore, type OptimisticQueue } from "@/lib/gist";

interface Deck {
  name: string;
  cards: number;
  due: number;
}

function unwrap(file: { content?: string } | undefined): any {
  if (!file || !file.content) return null;
  try {
    const env = JSON.parse(file.content);
    return env && typeof env === "object" && "data" in env ? env.data : env;
  } catch {
    return null;
  }
}

const FAVORITE_ID_MAX_LENGTH = 120;
const FAVORITES_MAX_LENGTH = 500;

function sanitizeFavorites(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const x of data) {
    if (typeof x !== "string" || x.length === 0 || x.length > FAVORITE_ID_MAX_LENGTH) continue;
    out.push(x);
    if (out.length >= FAVORITES_MAX_LENGTH) break;
  }
  return out;
}

async function loadSynced(token: string): Promise<{ decks: Deck[]; streak: number; gistId: string | null } | null> {
  try {
    const gistId = await findSyncGist(token);
    if (!gistId) return null;
    const headers = { authorization: "Bearer " + token, accept: "application/vnd.github+json" };
    const full = await (await fetch("https://api.github.com/gists/" + gistId, { headers })).json();
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
    return { decks, streak: (progress && (progress.streak || progress.currentStreak)) || 0, gistId };
  } catch {
    return null;
  }
}

const TABS = ["licence", "overview", "models", "sessions", "recipes", "connectors", "study", "settings"] as const;
type Tab = (typeof TABS)[number];

const MODELS: [string, string, string][] = [
  ["termcoder/auto", "routes each turn to the best model you have", "ready"],
  ["termexplorer/auto", "study & schoolwork tutor", "ready"],
  ["termcoderfree/auto", "keyless — no API key needed", "ready"],
  ["anthropic/claude-sonnet-5", "the shipped default · complex tasks", "needs key"],
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

// A working surface, not a landing page: one h1 per view, no eyebrow rule, no
// marketing rhythm. The kit's tokens and type scale, a step down in size.
export const PANEL_HEADING = "text-[clamp(24px,3vw,30px)] font-semibold tracking-[-0.022em] text-foreground";

function Title({ children, sample }: { children: React.ReactNode; sample?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className={PANEL_HEADING}>{children}</h1>
      {sample && <Badge>sample</Badge>}
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground">{children}</p>;
}

// Every tab's list gets a real h2, so the outline reads h1 → h2 → h3 (the
// footer) whichever tab is open. Most of them would only repeat the h1 on
// screen, so they are named for assistive tech and hidden from sight.
export function ListHeading({ children, visible }: { children: React.ReactNode; visible?: boolean }) {
  return (
    <h2 className={visible ? "mt-10 text-[17px] font-semibold tracking-tight text-foreground" : "sr-only"}>
      {children}
    </h2>
  );
}

export function Row({ c1, c2, right }: { c1: string; c2: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-b border-border py-3">
      <span className="w-[38%] shrink-0 font-mono text-[13px] text-foreground">{c1}</span>
      <span className="flex-1 truncate text-[12.5px] text-muted-foreground">{c2}</span>
      {right}
    </div>
  );
}

// The only colour a row is allowed to spend is state: `ok` marks something that
// is genuinely on. Everything else is a neutral outline.
export function Badge({ children, tone }: { children: React.ReactNode; tone?: "ok" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10.5px]",
        tone === "ok" ? "border-ok/40 text-ok" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="mt-1.5 font-mono text-[15px] text-foreground">{v}</div>
    </div>
  );
}

function DeckList({ decks, signedIn }: { decks: Deck[] | null; signedIn: boolean }) {
  if (decks === null || decks.length === 0) {
    return (
      <p className="border-t border-border py-5 text-[13px] text-muted-foreground">
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
  const [favorites, setFavorites] = useState<string[] | null>(null);
  const [gistId, setGistId] = useState<string | null>(null);
  const favoritesQueueRef = useRef<OptimisticQueue<string[]> | null>(null);

  useEffect(() => {
    const s = readSession();
    setSession(s);
    if (s && s.provider === "github" && s.token) {
      loadSynced(s.token).then((d) => {
        if (!d) return;
        setDecks(d.decks);
        setStreak(d.streak);
        setGistId(d.gistId);
        const token = s.token as string;
        const gid = d.gistId;
        if (gid) {
          readStore(token, gid, "favorites")
            .then((data) => sanitizeFavorites(data))
            .catch(() => [])
            .then((favs) => {
              setFavorites(favs);
              favoritesQueueRef.current = createOptimisticQueue<string[]>({
                initial: favs,
                write: (value) => writeStore(token, gid, "favorites", value),
                onChange: setFavorites,
              });
            });
        }
      });
    }
  }, []);

  const toggleFavorite = (id: string) => {
    const queue = favoritesQueueRef.current;
    if (!session?.token || !gistId || !queue) return;
    const current = queue.get();
    const next = current.includes(id) ? current.filter((f) => f !== id) : [...current, id];
    queue.set(next);
  };

  const signedIn = !!session;
  const dash = (n: number | null, unit: string) => (n === null ? "—" : `${n} ${n === 1 ? unit : unit + "s"}`);
  const dueCount = decks ? decks.reduce((a, d) => a + d.due, 0) : null;

  return (
    <div className="flex min-h-full flex-col">
      {/* The dashboard keeps its own chrome — it carries the account, which the
          marketing Nav does not — but wears the same bar as the rest of the site. */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-7 px-6">
          <a href="index.html" className="flex items-center gap-2.5">
            <Mark size={20} />
            <span className="text-[16px] font-semibold tracking-tight text-foreground">termcoder</span>
          </a>
          <nav className="hidden items-center gap-7 text-[14px] text-muted-foreground md:flex">
            <a href="index.html" className="transition-colors hover:text-foreground">home</a>
            <a href="features.html" className="transition-colors hover:text-foreground">features</a>
            <a href="docs.html" className="transition-colors hover:text-foreground">docs</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {session?.avatar && <img src={session.avatar} alt="" className="h-6 w-6 rounded-full" />}
            <span className="hidden text-[13px] text-muted-foreground sm:block">
              {session?.email || session?.name || "you@example.com"}
            </span>
            <button
              onClick={signOut}
              className="rounded-md px-1 text-[14px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto grid w-full max-w-[1120px] gap-10 px-6 py-10 lg:grid-cols-[180px_1fr]">
          <aside>
            <div className="sticky top-[84px] flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2 text-left text-[14px] capitalize transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0">
            {tab === "licence" && <LicencePanel />}

            {tab === "overview" && (
              <div>
                <Title>Welcome back{session?.name ? `, ${session.name.split(" ")[0]}` : ""}.</Title>
                <Sub>
                  Everything you sync from the app and CLI, in one place. Nothing here is billed, and nothing is stored
                  on our servers — this only mirrors your own data. TermCoder needs no account at all; pick{" "}
                  <span className="font-mono text-[14px] text-foreground">termcoder/auto</span> in the app to run
                  without an API key.
                </Sub>
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat k="Default model" v="anthropic/claude-sonnet-5" />
                  <Stat k="Study streak" v={dash(streak, "day")} />
                  <Stat k="Due today" v={dueCount === null ? "—" : `${dueCount} cards`} />
                  <Stat k="Decks" v={decks === null ? "—" : String(decks.length)} />
                </div>
                <ListHeading visible>Your decks</ListHeading>
                <DeckList decks={decks} signedIn={signedIn} />
              </div>
            )}

            {tab === "models" && (
              <div>
                <Title>Pick your engine.</Title>
                <Sub>
                  A fresh install defaults to{" "}
                  <span className="font-mono text-[14px] text-foreground">anthropic/claude-sonnet-5</span>, which needs
                  your key. Switch to <span className="font-mono text-[14px] text-foreground">termcoder/auto</span> and
                  it routes each turn to the strongest provider you have configured — falling back to a free, keyless
                  one when you have no key at all. TermCoder never downgrades a model you picked yourself.
                </Sub>
                <ListHeading>Available models</ListHeading>
                <div className="mt-8">
                  {MODELS.map(([m, d, badge]) => (
                    <Row
                      key={m}
                      c1={m}
                      c2={d}
                      right={
                        <div className="flex shrink-0 items-center gap-3">
                          {session?.token && gistId && (
                            <button
                              type="button"
                              onClick={() => toggleFavorite(m)}
                              aria-label={favorites?.includes(m) ? `Unfavorite ${m}` : `Favorite ${m}`}
                              aria-pressed={!!favorites?.includes(m)}
                              className={cn(
                                "rounded font-mono text-[14px] leading-none transition-colors",
                                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                favorites?.includes(m) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {favorites?.includes(m) ? "★" : "☆"}
                            </button>
                          )}
                          <Badge tone={badge === "ready" ? "ok" : undefined}>{badge}</Badge>
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === "sessions" && (
              <div>
                <Title sample>Your work, synced.</Title>
                <Sub>
                  Syncing sessions across machines already works in the app — it is one of the things termcoder Pro
                  covers. Listing them on this page is still to come, so the rows below are a sample of how it will
                  look.
                </Sub>
                <ListHeading>Recent sessions</ListHeading>
                <div className="mt-8">
                  {SESSIONS.map(([n, d]) => (
                    <Row
                      key={n}
                      c1={n}
                      c2={d}
                      right={
                        <a
                          href="download.html"
                          className="shrink-0 font-mono text-[11.5px] text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
                        >
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
                <Title sample>Saved workflows.</Title>
                <Sub>
                  Named, shareable multi-step tasks — dev automations that run in order, or study lessons taught one
                  step at a time. You create and run these in the app today; syncing them here is on the way. Below is a
                  sample.
                </Sub>
                <ListHeading>Saved recipes</ListHeading>
                <div className="mt-8">
                  {RECIPES.map(([n, d, tag]) => (
                    <Row key={n} c1={n} c2={d} right={<Badge>{tag}</Badge>} />
                  ))}
                </div>
              </div>
            )}

            {tab === "connectors" && <ConnectorsPanel />}

            {tab === "study" && (
              <div>
                <Title>Decks &amp; streak.</Title>
                <Sub>
                  TermExplorer turns the same engine into a tutor — spaced-repetition flashcards that resurface at the
                  right time. Your decks and streak sync here.
                </Sub>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <Stat k="Current streak" v={dash(streak, "day")} />
                  <Stat k="Due today" v={dueCount === null ? "—" : `${dueCount} cards`} />
                  <Stat k="Decks" v={decks === null ? "—" : String(decks.length)} />
                </div>
                <ListHeading visible>Your decks</ListHeading>
                <div className="mt-2">
                  <DeckList decks={decks} signedIn={signedIn} />
                </div>
              </div>
            )}

            {tab === "settings" && <SettingsPanel />}
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
