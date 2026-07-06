import { useEffect, useMemo, useState } from "react";
import { IconClose, IconSearch } from "./Icons";
import { useI18n } from "./i18n";

interface ModelItem {
  id: string;
  provider: string;
  model: string;
  name: string;
  contextK?: number;
  vision?: boolean;
  free?: boolean;
  local?: boolean;
  configured?: boolean;
}

interface ProviderHealth {
  provider: string;
  health?: "ok" | "bad" | "unknown";
  error?: string;
}

const ALWAYS_ON_PROVIDERS = new Set(["ollama", "termcoderfree", "termcoder", "termexplorer"]);

function stateFor(m: ModelItem, health: Record<string, ProviderHealth>): { dot: string; color: string; title?: string } {
  const h = health[m.provider];
  if (h?.health === "bad") return { dot: "◐", color: "var(--warn)", title: h.error };
  if (h?.health === "ok" || ALWAYS_ON_PROVIDERS.has(m.provider) || m.local) {
    return { dot: "●", color: "var(--ok)" };
  }
  if (m.configured) return { dot: "◐", color: "var(--warn)" };
  return { dot: "○", color: "var(--muted)" };
}

export function ModelBrowser({
  port,
  current,
  onSelect,
  onClose,
}: {
  port: number;
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<ModelItem[]>([]);
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "vision">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:${port}/models`)
      .then((r) => r.json())
      .then((list) => setItems(Array.isArray(list) ? list : []))
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch(`http://localhost:${port}/providers`)
      .then((r) => r.json())
      .then((list) => {
        if (!Array.isArray(list)) return;
        const byProvider: Record<string, ProviderHealth> = {};
        for (const p of list as ProviderHealth[]) byProvider[p.provider] = p;
        setHealth(byProvider);
      })
      .catch(() => {});
  }, [port]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((m) => {
      if (filter === "free" && !(m.free || m.local)) return false;
      if (filter === "vision" && !m.vision) return false;
      if (query && !`${m.id} ${m.name}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [items, q, filter]);

  return (
    <div className="settings" onClick={onClose}>
      <div className="model-browser" onClick={(e) => e.stopPropagation()}>
        <div className="mb-head">
          <IconSearch />
          <input autoFocus placeholder={t("models.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="icon" onClick={onClose}><IconClose /></button>
        </div>
        <div className="mb-filters">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{t("models.all")}</button>
          <button className={filter === "free" ? "active" : ""} onClick={() => setFilter("free")}>{t("models.free")}</button>
          <button className={filter === "vision" ? "active" : ""} onClick={() => setFilter("vision")}>{t("models.vision")}</button>
          <span className="mb-count">{filtered.length}</span>
        </div>
        <div className="mb-list">
          {loading ? <div className="mb-empty">…</div> : null}
          {filtered.map((m) => {
            const state = stateFor(m, health);
            return (
              <button
                key={m.id}
                className={`mb-item ${m.id === current ? "active" : ""}`}
                onClick={() => {
                  onSelect(m.id);
                  onClose();
                }}
              >
                <div className="mb-main">
                  <span style={{ color: state.color }} title={state.title}>{state.dot}</span>
                  <span className="mb-name">{m.name}</span>
                  <span className="mb-id">{m.id}</span>
                </div>
                <div className="mb-badges">
                  {m.local ? (
                    <span className="badge ok">local</span>
                  ) : m.free ? (
                    <span className="badge ok">free</span>
                  ) : null}
                  {m.vision ? <span className="badge muted">vision</span> : null}
                  {m.contextK ? <span className="badge muted">{m.contextK}k</span> : null}
                  {state.dot === "○" ? <span className="badge muted">{t("models.noKey")}</span> : null}
                  {m.id === current ? <span className="check">✓</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
