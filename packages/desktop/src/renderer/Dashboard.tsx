interface Summary { id: string; model: string; usage?: { tokensIn: number; tokensOut: number } }

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export function Dashboard(p: { sessions: Summary[]; t: (k: string) => string }) {
  const totalIn = p.sessions.reduce((s, x) => s + (x.usage?.tokensIn ?? 0), 0);
  const totalOut = p.sessions.reduce((s, x) => s + (x.usage?.tokensOut ?? 0), 0);
  const recent = p.sessions.slice(0, 12).reverse();
  const totals = recent.map((s) => (s.usage?.tokensIn ?? 0) + (s.usage?.tokensOut ?? 0));
  const max = Math.max(0, ...totals);
  const mix = new Map<string, number>();
  for (const s of p.sessions) mix.set(s.model, (mix.get(s.model) ?? 0) + 1);

  return (
    <div className="dashboard">
      <div className="dash-stats">
        <div className="dash-stat"><span>{p.t("dash.sessions")}</span><b>{p.sessions.length}</b></div>
        <div className="dash-stat"><span>↓ {p.t("dash.tokensIn")}</span><b>{fmtK(totalIn)}</b></div>
        <div className="dash-stat"><span>↑ {p.t("dash.tokensOut")}</span><b>{fmtK(totalOut)}</b></div>
      </div>

      {max > 0 ? (
        <div className="spark" aria-hidden="true">
          {recent.map((s, i) => {
            const v = totals[i] ?? 0;
            return (
              <span
                key={`${s.id}-${i}`}
                className={v === 0 ? "zero" : ""}
                style={v === 0 ? undefined : { height: `${Math.max(8, (v / max) * 100)}%` }}
              />
            );
          })}
        </div>
      ) : (
        <div className="dash-empty">{p.t("dash.noUsage")}</div>
      )}

      {mix.size > 0 ? (
        <>
          <div className="eyebrow">{p.t("dash.models")}</div>
          <div className="dash-mix">
            {[...mix.entries()].map(([m, n]) => (
              <span className="dash-chip" key={m}>{m.split("/").pop()} · {n}</span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
