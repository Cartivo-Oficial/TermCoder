import { useEffect, useState } from "react";
import { readSession, type Session } from "@/lib/session";
import { fetchLicense, cachedLicense, type LicenseState } from "@/lib/license";
import { openCheckout, payConfigured } from "@/lib/paddle";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { PANEL_HEADING } from "@/pages/dashboard";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

const BTN = "h-11 rounded-lg px-5 text-[14px]";
const FACT = "rounded-xl border border-border bg-card px-4 py-3";
const FACT_KEY = "font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground";

export function LicencePanel() {
  const [state, setState] = useState<LicenseState>({ status: "loading" });
  const [session, setSession] = useState<Session | null>(null);

  const load = () => {
    const s = readSession();
    setSession(s);
    if (!s) return;
    const cached = cachedLicense(s.sub ?? "");
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
        <h1 className={PANEL_HEADING}>Your licence.</h1>
        <h2 className="sr-only">Licence status</h2>
        <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground">
          Sign in and your licence key appears here, ready to paste into the app.
        </p>
        <a href="login.html" className={cn(buttonVariants(), BTN, "mt-6")}>
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
      <h1 className={PANEL_HEADING}>Your licence.</h1>
      <h2 className="sr-only">Licence status</h2>

      {state.status === "loading" && <p className="mt-4 font-mono text-[13px] text-muted-foreground">Checking…</p>}

      {state.status === "error" && (
        <>
          <p className="mt-4 max-w-[64ch] text-[14px] leading-relaxed text-bad">{state.message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={load} className={cn(buttonVariants({ variant: "outline" }), BTN)}>
              Refresh
            </button>
          </div>
        </>
      )}

      {state.status === "no-email" && (
        <>
          <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground">
            We found your purchase, but couldn&apos;t tell which email to issue the licence to. Make an email
            public on your account and refresh, or contact support.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={load} className={cn(buttonVariants({ variant: "outline" }), BTN)}>
              Refresh
            </button>
          </div>
        </>
      )}

      {state.status === "none" && (
        <>
          <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground">
            You are on the free tier: the whole agent, the tutor, joining any room or class, and hosting one guest. Pro
            covers the third person in a room, classrooms, and syncing sessions across machines — one payment for one
            year, and it does not renew on its own.
          </p>
          <p className="mt-3 max-w-[64ch] text-[13px] leading-relaxed text-muted-foreground">
            Just paid with Pix? It can take a moment to settle. Hit Refresh.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {payConfigured() ? (
              <button onClick={buy} className={cn(buttonVariants(), BTN)}>
                Get Pro
              </button>
            ) : (
              <a href="pricing.html" className={cn(buttonVariants(), BTN)}>
                See pricing
              </a>
            )}
            <button onClick={load} className={cn(buttonVariants({ variant: "outline" }), BTN)}>
              Refresh
            </button>
          </div>
        </>
      )}

      {state.status === "active" && (
        <>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className={FACT}>
              <div className={FACT_KEY}>status</div>
              {/* State is the one place colour is allowed: a licence that verified
                  is genuinely good news, and one that lapsed is genuinely not. */}
              <div className={cn("mt-1 font-mono text-[14px]", expired ? "text-bad" : "text-ok")}>
                {expired ? "expired" : "active"}
              </div>
            </div>
            <div className={FACT}>
              <div className={FACT_KEY}>{expired ? "expired on" : "expires"}</div>
              <div className="mt-1 font-mono text-[14px] text-foreground">
                {new Date(state.expires).toLocaleDateString()}
              </div>
            </div>
            {!expired && (
              <div className={FACT}>
                <div className={FACT_KEY}>left</div>
                <div className="mt-1 font-mono text-[14px] text-foreground">{daysLeft} days</div>
              </div>
            )}
          </div>

          <p className="mt-6 max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground">
            Paste this into the app: <span className="text-foreground">Settings → termcoder Pro</span>. A licence is one
            payment for one year — nothing recurring, so buy another when this one runs out.
          </p>
          <div className="mt-3 flex max-w-2xl items-start gap-3 rounded-xl border border-border bg-muted p-4">
            <code className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed text-foreground">
              {state.key}
            </code>
            <CopyButton text={state.key} />
          </div>

          {expired && (
            payConfigured() ? (
              <button onClick={buy} className={cn(buttonVariants(), BTN, "mt-6")}>
                Buy another year
              </button>
            ) : (
              <a href="pricing.html" className={cn(buttonVariants(), BTN, "mt-6")}>
                See pricing
              </a>
            )
          )}
        </>
      )}
    </div>
  );
}
