import { useEffect, useState } from "react";
import { useI18n } from "./i18n";

type Audience = "dev" | "study" | "any";
type Scope = "project" | "user";

interface Recipe {
  name: string;
  description: string;
  audience: Audience;
  steps: string[];
  scope: Scope;
}

interface RecipesPanelProps {
  port: number;
  cwd: string | null;
  onClose: () => void;
  onRun: (prompt: string) => void;
}

export function RecipesPanel({ port, cwd, onClose, onRun }: RecipesPanelProps) {
  const { t } = useI18n();
  const httpBase = `http://localhost:${port}`;
  const cwdQuery = cwd ? `?cwd=${encodeURIComponent(cwd)}` : "";
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<Audience>("any");
  const [scope, setScope] = useState<Scope>("project");
  const [stepsText, setStepsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    fetch(`${httpBase}/recipes${cwdQuery}`)
      .then((r) => r.json())
      .then((list) => setRecipes(Array.isArray(list) ? (list as Recipe[]) : []))
      .catch(() => setRecipes([]));
  }

  useEffect(refresh, [httpBase, cwd]);

  async function save() {
    const steps = stepsText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!name.trim() || steps.length === 0) {
      setError(t("recipes.needNameSteps"));
      return;
    }
    const res = await fetch(`${httpBase}/recipes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, description, audience, scope, steps, cwd }),
    });
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t("recipes.saveFailed"));
      return;
    }
    setName("");
    setDescription("");
    setStepsText("");
    setAudience("any");
    setScope("project");
    setCreating(false);
    setError(null);
    refresh();
  }

  async function remove(recipe: Recipe) {
    await fetch(`${httpBase}/recipes/${encodeURIComponent(recipe.name)}${cwdQuery}`, { method: "DELETE" });
    refresh();
  }

  async function run(recipe: Recipe) {
    const res = await fetch(`${httpBase}/recipes/${encodeURIComponent(recipe.name)}/run${cwdQuery}`);
    if (!res.ok) return;
    const { prompt } = (await res.json()) as { prompt: string };
    onRun(prompt);
    onClose();
  }

  return (
    <div className="settings" onClick={onClose}>
      <div className="settings-card room-card" style={{ maxWidth: 600, width: "92%", minHeight: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="room-head">
          <h3>{t("recipes.title")}</h3>
          <button className="icon sm" title={t("room.close")} onClick={onClose}>×</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>{t("recipes.subtitle")}</p>

        <div className="recipe-list">
          {recipes.length === 0 ? (
            <p className="hint">{t("recipes.empty")}</p>
          ) : (
            recipes.map((r) => (
              <div className="recipe-row" key={`${r.scope}:${r.name}`}>
                <div className="recipe-main">
                  <div className="recipe-name">
                    {r.name}
                    {r.audience !== "any" ? <span className="recipe-badge">{r.audience}</span> : null}
                    <span className="recipe-scope">{r.scope === "project" ? t("recipes.project") : t("recipes.user")}</span>
                  </div>
                  {r.description ? <div className="recipe-desc">{r.description}</div> : null}
                  <div className="recipe-steps">{t("recipes.stepCount", { n: r.steps.length })}</div>
                </div>
                <div className="recipe-actions">
                  <button className="btn-2 go" onClick={() => void run(r)}>{t("recipes.run")}</button>
                  <button className="icon sm" title={t("recipes.delete")} onClick={() => void remove(r)}>🗑</button>
                </div>
              </div>
            ))
          )}
        </div>

        {error ? <p className="room-call-err">{error}</p> : null}

        {creating ? (
          <div className="recipe-form">
            <label className="room-label">{t("recipes.name")}</label>
            <input className="settings-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t("recipes.namePlaceholder")} />
            <label className="room-label">{t("recipes.description")}</label>
            <input className="settings-input" value={description} maxLength={140} onChange={(e) => setDescription(e.target.value)} />
            <div className="recipe-form-row">
              <div>
                <label className="room-label">{t("recipes.audience")}</label>
                <select className="settings-input" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                  <option value="any">{t("recipes.audienceAny")}</option>
                  <option value="dev">{t("recipes.audienceDev")}</option>
                  <option value="study">{t("recipes.audienceStudy")}</option>
                </select>
              </div>
              <div>
                <label className="room-label">{t("recipes.scope")}</label>
                <select className="settings-input" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
                  <option value="project">{t("recipes.project")}</option>
                  <option value="user">{t("recipes.user")}</option>
                </select>
              </div>
            </div>
            <label className="room-label">{t("recipes.steps")}</label>
            <textarea
              className="settings-input recipe-steps-input"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={t("recipes.stepsPlaceholder")}
              rows={5}
            />
            <div className="recipe-form-actions">
              <button className="settings-btn" onClick={() => { setCreating(false); setError(null); }}>{t("recipes.cancel")}</button>
              <button className="settings-btn primary" onClick={() => void save()}>{t("recipes.save")}</button>
            </div>
          </div>
        ) : (
          <button className="btn-2 go recipe-new" onClick={() => setCreating(true)}>+ {t("recipes.new")}</button>
        )}
      </div>
    </div>
  );
}
