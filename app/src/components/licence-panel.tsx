import { useEffect, useState } from "react";
import { readSession, type Session } from "@/lib/session";
import { fetchLicense, cachedLicense, type LicenseState } from "@/lib/license";
import { openCheckout, payConfigured } from "@/lib/paddle";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

export function LicencePanel() {
  const [state, setState] = useState<LicenseState>({ status: "loading" });
  const [session, setSession] = useState<Session | null>(null);

  const load = () => {
    const s = readSession();
    setSession(s);
    if (!s) return setState({ status: "none" });
    const cached = cachedLicense();
    if (cached) setState(cached);
    fetchLicense(s).then((next) => {
      if (next.status === "error" && cached) return;
      setState(next);
    });
  };

  useEffect(load, []);

  if (!session) {
    return (
      <div>
        <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground">Your licence.</h2>
        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
          Sign in and your licence key appears here, ready to paste into the app.
        </p>
        <a href="login.html" className={cn(buttonVariants(), "mt-6 h-11 rounded-md px-5 font-mono text-[14px]")}>
          Sign in
        </a>
      </div>
    );
  }

  const buy = () => {
    if (!session) return;
    void openCheckout(session).catch((e) => setState({ status: "error", message: String(e.message ?? e) }));
  };

  const expired = state.status === "active" && Date.now() > state.expires;
  const daysLeft = state.status === "active" ? Math.max(0, Math.ceil((state.expires - Date.now()) / DAY)) : 0;

  return (
    <div>
      <h2 className="font-display text-3xl font-light tracking-[-0.03em] text-foreground">Your licence.</h2>

      {state.status === "loading" && <p className="mt-3 font-mono text-[13px] text-muted-foreground">Checking…</p>}

      {state.status === "error" && (
        <p className="mt-3 max-w-xl text-[14px] text-muted-foreground">{state.message}</p>
      )}

      {state.status === "none" && (
        <>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
            You are on the free tier: the whole agent, the tutor, joining any room or class, and hosting one guest. Pro
            covers the third person in a room, classrooms, and syncing sessions across machines — for a year, paid once.
          </p>
          <p className="mt-3 max-w-xl text-[13px] text-muted-foreground/60">
            Just paid with Pix? It can take a moment to settle. Hit Refresh.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {payConfigured() ? (
              <button onClick={buy} className={cn(buttonVariants(), "h-11 rounded-md px-5 font-mono text-[14px]")}>
                Get Pro →
              </button>
            ) : (
              <a href="pricing.html" className={cn(buttonVariants(), "h-11 rounded-md px-5 font-mono text-[14px]")}>
                See pricing →
              </a>
            )}
            <button onClick={load} className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-md px-5 font-mono text-[14px]")}>
              Refresh
            </button>
          </div>
        </>
      )}

      {state.status === "active" && (
        <>
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground/50">status</div>
              <div className={cn("mt-1 font-mono text-[14px]", expired ? "text-[#ff6b6b]" : "text-primary")}>
                {expired ? "expired" : "active"}
              </div>
            </div>
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground/50">
                {expired ? "expired on" : "renews"}
              </div>
              <div className="mt-1 font-mono text-[14px] text-foreground">
                {new Date(state.expires).toLocaleDateString()}
              </div>
            </div>
            {!expired && (
              <div className="rounded-md border border-border bg-card px-4 py-3">
                <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground/50">left</div>
                <div className="mt-1 font-mono text-[14px] text-foreground">{daysLeft} days</div>
              </div>
            )}
          </div>

          <p className="mt-6 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Paste this into the app: <span className="text-foreground">Settings → termcoder Pro</span>.
          </p>
          <div className="mt-3 flex max-w-2xl items-start gap-3 rounded-md border border-border bg-[#0d0c0e] p-4">
            <code className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed text-foreground">
              {state.key}
            </code>
            <CopyButton text={state.key} />
          </div>

          {expired && payConfigured() && (
            <button onClick={buy} className={cn(buttonVariants(), "mt-6 h-11 rounded-md px-5 font-mono text-[14px]")}>
              Renew for another year →
            </button>
          )}
        </>
      )}
    </div>
  );
}
