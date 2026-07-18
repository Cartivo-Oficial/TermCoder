import { useEffect, useRef, useState } from "react";
import { readSession } from "@/lib/session";
import { createOptimisticQueue, findSyncGist, readStore, writeStore, type OptimisticQueue } from "@/lib/gist";
import { buttonVariants } from "@/components/ui/button";
import { Row, Badge } from "@/pages/dashboard";
import { cn } from "@/lib/utils";
import siteConnectors from "@/generated/connectors.json";

type Phase = "loading" | "signed-out" | "google-only" | "no-gist" | "ready";

type SettingsMap = Record<string, unknown>;

interface SiteConnectorInput {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
}

interface SiteConnector {
  id: string;
  name: string;
  description: string;
  inputs: SiteConnectorInput[];
}

interface ConnectorEntry {
  id: string;
  inputs: Record<string, string>;
}

const CONNECTORS = siteConnectors as SiteConnector[];

function sanitizeSettings(data: unknown): SettingsMap {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return data as SettingsMap;
}

function sanitizeConnectors(value: unknown): ConnectorEntry[] {
  if (!Array.isArray(value)) return [];
  const out: ConnectorEntry[] = [];
  for (const x of value) {
    if (!x || typeof x !== "object") continue;
    const id = (x as Record<string, unknown>).id;
    if (typeof id !== "string") continue;
    const rawInputs = (x as Record<string, unknown>).inputs;
    const inputs: Record<string, string> = {};
    if (rawInputs && typeof rawInputs === "object") {
      for (const [k, v] of Object.entries(rawInputs as Record<string, unknown>)) {
        if (typeof v === "string") inputs[k] = v;
      }
    }
    out.push({ id, inputs });
  }
  return out;
}

function connectorsValue(map: SettingsMap): ConnectorEntry[] {
  const entry = map.connectors;
  if (entry && typeof entry === "object" && "value" in (entry as Record<string, unknown>)) {
    return sanitizeConnectors((entry as { value: unknown }).value);
  }
  return [];
}

function withConnectors(map: SettingsMap, next: ConnectorEntry[]): SettingsMap {
  return { ...map, connectors: { value: next, updatedAt: Date.now() } };
}

const INPUT_CLS =
  "w-full rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[12.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 hover:border-white/25 focus-visible:border-primary/50";

function ConnectorForm({
  connector,
  onAdd,
}: {
  connector: SiteConnector;
  onAdd: (inputs: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const missing = connector.inputs.some((i) => i.required && !(values[i.key] ?? "").trim());

  return (
    <div className="flex flex-col gap-2 border-b border-border/60 py-3">
      <div className="flex items-center gap-4">
        <span className="w-[38%] shrink-0 font-mono text-[13px] text-foreground">{connector.name}</span>
        <span className="flex-1 truncate text-[12.5px] text-muted-foreground/70">{connector.description}</span>
      </div>
      {connector.inputs.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {connector.inputs.map((input) => (
            <input
              key={input.key}
              className={INPUT_CLS}
              placeholder={input.placeholder || input.label}
              value={values[input.key] ?? ""}
              onChange={(e) => setValues({ ...values, [input.key]: e.target.value })}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={missing}
        onClick={() => onAdd(values)}
        className={cn(buttonVariants({ size: "sm" }), "w-fit font-mono text-[11.5px] disabled:opacity-40")}
      >
        Add
      </button>
    </div>
  );
}

export function ConnectorsPanel() {
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

  const setConnectors = (next: ConnectorEntry[]) => {
    const queue = queueRef.current;
    if (!queue) return;
    queue.set(withConnectors(queue.get(), next));
  };

  if (phase === "loading") {
    return (
      <div>
        <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground">One-click MCP.</h2>
        <p className="mt-3 font-mono text-[13px] text-muted-foreground">Checking…</p>
      </div>
    );
  }

  if (phase === "signed-out") {
    return (
      <div>
        <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground">One-click MCP.</h2>
        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
          Sign in to enable connectors.
        </p>
        <a href="login.html" className={cn(buttonVariants(), "mt-6 h-11 rounded-md px-5 font-mono text-[14px]")}>
          Sign in
        </a>
      </div>
    );
  }

  if (phase === "google-only") {
    return (
      <div>
        <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground">One-click MCP.</h2>
        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
          Connectors sync needs a GitHub sign-in — it rides on your private gist.
        </p>
        <a href="login.html" className={cn(buttonVariants(), "mt-6 h-11 rounded-md px-5 font-mono text-[14px]")}>
          Sign in with GitHub →
        </a>
      </div>
    );
  }

  if (phase === "no-gist") {
    return (
      <div>
        <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground">One-click MCP.</h2>
        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
          Run <span className="text-foreground">/sync</span> in the app once and connectors appear here.
        </p>
      </div>
    );
  }

  const added = connectorsValue(settings);

  return (
    <div>
      <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground">One-click MCP.</h2>
      <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
        Add a Model Context Protocol server without memorizing commands. Pick a connector, fill in what it needs, and
        it lands in your synced config, disabled.
      </p>

      <div className="mt-7">
        {CONNECTORS.map((connector) => {
          const entry = added.find((a) => a.id === connector.id);
          if (entry) {
            return (
              <Row
                key={connector.id}
                c1={connector.name}
                c2={connector.description}
                right={
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone="ok">added</Badge>
                    <button
                      type="button"
                      onClick={() => setConnectors(added.filter((a) => a.id !== connector.id))}
                      className="font-mono text-[11.5px] text-muted-foreground transition-colors hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                }
              />
            );
          }
          return (
            <ConnectorForm
              key={connector.id}
              connector={connector}
              onAdd={(inputs) => setConnectors([...added, { id: connector.id, inputs }])}
            />
          );
        })}
      </div>

      <p className="mt-7 font-mono text-[11.5px] leading-relaxed text-muted-foreground/60">
        Enable it in the app — Settings → MCP — after your next <span className="text-foreground">/sync</span>.
      </p>
    </div>
  );
}
