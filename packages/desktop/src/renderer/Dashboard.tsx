interface Summary { id: string; model: string; usage?: { tokensIn: number; tokensOut: number } }

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export function Dashboard(p: {
  sessions: Summary[];
  t: (k: string) => string;
  onNew: () => void;
  onSettings: () => void;
}) {
  const totalIn = p.sessions.reduce((s, x) => s + (x.usage?.tokensIn ?? 0), 0);
  const totalOut = p.sessions.reduce((s, x) => s + (x.usage?.tokensOut ?? 0), 0);
  const recent = p.sessions.slice(0, 12).reverse();
  const max = Math.max(1, ...recent.map((x) => (x.usage?.tokensIn ?? 0) + (x.usage?.tokensOut ?? 0)));
  const mix = new Map<string, number>();
  for (const s of p.sessions) mix.set(s.model, (mix.get(s.model) ?? 0) + 1);

  return (
    <aside className="dashboard">
      <div className="eyebrow">{p.t("dash.overview")}</div>
      <div className="dash-stats">
        <div className="dash-stat"><span>{p.t("dash.sessions")}</span><b>{p.sessions.length}</b></div>
        <div className="dash-stat"><span>↓ {p.t("dash.tokensIn")}</span><b>{fmtK(totalIn)}</b></div>
        <div className="dash-stat"><span>↑ {p.t("dash.tokensOut")}</span><b>{fmtK(totalOut)}</b></div>
      </div>
      <div className="spark" aria-hidden="true">
        {recent.map((s, i) => {
          const v = (s.usage?.tokensIn ?? 0) + (s.usage?.tokensOut ?? 0);
          return <span key={s.id + i} style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />;
        })}
      </div>
      <div className="eyebrow">{p.t("dash.models")}</div>
      <div className="dash-mix">
        {[...mix.entries()].map(([m, n]) => (
          <span className="chip" key={m}>{m.split("/").pop()} · {n}</span>
        ))}
      </div>
      <div className="eyebrow">{p.t("dash.toolkit")}</div>
      <div className="dash-toolkit">
        <button className="settings-btn" onClick={p.onNew}>{p.t("dash.new")}</button>
        <button className="settings-btn" onClick={p.onSettings}>{p.t("dash.settings")}</button>
      </div>
    </aside>
  );
}
