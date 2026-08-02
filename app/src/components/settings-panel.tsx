import { useEffect, useRef, useState } from "react";
import { readSession } from "@/lib/session";
import { createOptimisticQueue, findSyncGist, readStore, writeStore, type OptimisticQueue } from "@/lib/gist";
import { buttonVariants } from "@/components/ui/button";
import { Row, Badge, PANEL_HEADING } from "@/pages/dashboard";
import { cn } from "@/lib/utils";

type Phase = "loading" | "signed-out" | "google-only" | "no-gist" | "ready";

type SettingsMap = Record<string, unknown>;

const THEMES: [string, string][] = [
  ["default", "Ember"],
  ["mono", "Mono"],
  ["midnight", "Midnight"],
  ["ocean", "Ocean"],
  ["forest", "Forest"],
  ["sunset", "Sunset"],
  ["rose", "Rosé"],
  ["nord", "Nord"],
  ["paper", "Paper"],
];

const MODEL_IDS = [
  "termcoder/auto",
  "termexplorer/auto",
  "termcoderfree/auto",
  "anthropic/claude-sonnet-5",
  "google/gemini-2.5-pro",
  "ollama/llama3.1",
];

function sanitizeSettings(data: unknown): SettingsMap {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return data as SettingsMap;
}

function valueOf<T>(map: SettingsMap, key: string, fallback: T): T {
  const entry = map[key];
  if (entry && typeof entry === "object" && "value" in (entry as Record<string, unknown>)) {
    const v = (entry as { value: unknown }).value;
    return v === undefined ? fallback : (v as T);
  }
  return fallback;
}

function withValue(map: SettingsMap, key: string, value: unknown): SettingsMap {
  return { ...map, [key]: { value, updatedAt: Date.now() } };
}

const SELECT_CLS =
  "shrink-0 rounded-lg border border-input bg-card px-2.5 py-1.5 font-mono text-[12.5px] text-foreground transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const BTN = "h-11 rounded-lg px-5 text-[14px]";
const LEAD = "mt-4 max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground";

export function SettingsPanel() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [settings, setSettings] = useState<SettingsMap>({});
  const queueRef = useRef<OptimisticQueue<SettingsMap> | null>(null);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      setPhase("signed-out");
      return;
    }
    if (s.provider !== "github" || !s.token) {
      setPhase("google-only");
      return;
    }
    const token = s.token;
    findSyncGist(token)
      .then((gistId) => {
        if (!gistId) {
          setPhase("no-gist");
          return;
        }
        return readStore(token, gistId, "settings")
          .catch(() => null)
          .then((data) => {
            const map = sanitizeSettings(data);
            setSettings(map);
            queueRef.current = createOptimisticQueue<SettingsMap>({
              initial: map,
              write: (value) => writeStore(token, gistId, "settings", value),
              onChange: setSettings,
            });
            setPhase("ready");
          });
      })
      .catch(() => setPhase("no-gist"));
  }, []);

  const update = (key: string, value: unknown) => {
    const queue = queueRef.current;
    if (!queue) return;
    queue.set(withValue(queue.get(), key, value));
  };

  if (phase === "loading") {
    return (
      <div>
        <h1 className={PANEL_HEADING}>Your preferences.</h1>
        <h2 className="sr-only">Synced preferences</h2>
        <p className="mt-4 font-mono text-[13px] text-muted-foreground">Checking…</p>
      </div>
    );
  }

  if (phase === "signed-out") {
    return (
      <div>
        <h1 className={PANEL_HEADING}>Your preferences.</h1>
        <h2 className="sr-only">Synced preferences</h2>
        <p className={LEAD}>Sign in to manage your settings.</p>
        <a href="login.html" className={cn(buttonVariants(), BTN, "mt-6")}>
          Sign in
        </a>
      </div>
    );
  }

  if (phase === "google-only") {
    return (
      <div>
        <h1 className={PANEL_HEADING}>Your preferences.</h1>
        <h2 className="sr-only">Synced preferences</h2>
        <p className={LEAD}>
          You are signed in with Google. Your settings sync through your own private GitHub gist, so this panel needs
          a GitHub connection too — nothing is stored on our servers.
        </p>
        <a href="login.html?connect=github" className={cn(buttonVariants(), BTN, "mt-6")}>
          Connect GitHub
        </a>
      </div>
    );
  }

  if (phase === "no-gist") {
    return (
      <div>
        <h1 className={PANEL_HEADING}>Your preferences.</h1>
        <h2 className="sr-only">Synced preferences</h2>
        <p className={LEAD}>
          Run <span className="font-mono text-[14px] text-foreground">/sync</span> in the app once and your settings
          appear here.
        </p>
      </div>
    );
  }

  const theme = valueOf<string>(settings, "theme", "default");
  const model = valueOf<string>(settings, "model", "anthropic/claude-sonnet-5");
  const reasoning = valueOf<boolean>(settings, "reasoning", true);
  const themeOptions = THEMES.some(([id]) => id === theme) ? THEMES : [[theme, theme] as [string, string], ...THEMES];
  const modelOptions = MODEL_IDS.includes(model) ? MODEL_IDS : [model, ...MODEL_IDS];

  return (
    <div>
      <h1 className={PANEL_HEADING}>Your preferences.</h1>
      <h2 className="sr-only">Synced preferences</h2>
      <p className={LEAD}>
        These sync via your GitHub gist — the same one the app reads on{" "}
        <span className="font-mono text-[14px] text-foreground">/sync</span>. Nothing is stored on our servers.
      </p>

      <div className="mt-8">
        <Row
          c1="Theme"
          c2="App color theme"
          right={
            <select
              aria-label="App color theme"
              className={SELECT_CLS}
              value={theme}
              onChange={(e) => update("theme", e.target.value)}
            >
              {themeOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          }
        />
        <Row
          c1="Default model"
          c2="Used for new sessions"
          right={
            <select
              aria-label="Default model for new sessions"
              className={SELECT_CLS}
              value={model}
              onChange={(e) => update("model", e.target.value)}
            >
              {modelOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          }
        />
        <Row
          c1="Reasoning"
          c2="Extended thinking on capable models"
          right={
            <button
              type="button"
              aria-label="Extended thinking on capable models"
              aria-pressed={reasoning}
              onClick={() => update("reasoning", !reasoning)}
              className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Badge tone={reasoning ? "ok" : undefined}>{reasoning ? "on" : "off"}</Badge>
            </button>
          }
        />
      </div>

      <p className="mt-8 text-[13px] leading-relaxed text-muted-foreground">
        Changes reach the app the next time it syncs — run{" "}
        <span className="font-mono text-[13px] text-foreground">/sync</span>.
      </p>
    </div>
  );
}
