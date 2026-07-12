import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "../util/frontmatter";
import { configDir } from "../util/paths";

export type RecipeScope = "project" | "user";
export type RecipeAudience = "dev" | "study" | "any";

export interface RecipeEntry {
  name: string;
  description: string;
  audience: RecipeAudience;
  steps: string[];
  scope: RecipeScope;
  file: string;
  updatedAt: number;
}

const AUDIENCES: RecipeAudience[] = ["dev", "study", "any"];

export function slugifyRecipeName(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-") || "recipe"
  );
}

// A step is one line of the body. Leading list markers ("- ", "* ", "1. ",
// "2) ") are cosmetic and stripped; blank lines are ignored.
export function parseSteps(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 0);
}

function projectDir(cwd: string): string {
  return join(cwd, ".termcoder", "recipes");
}
function userDir(env?: NodeJS.ProcessEnv): string {
  return join(configDir(env ?? process.env), "recipes");
}

function readRecipeDir(dir: string, scope: RecipeScope): RecipeEntry[] {
  if (!existsSync(dir)) return [];
  const out: RecipeEntry[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const file = join(dir, f);
    try {
      const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
      const name =
        typeof data.name === "string" && data.name.trim() ? slugifyRecipeName(data.name) : f.replace(/\.md$/, "");
      const description = typeof data.description === "string" ? data.description : "";
      const audience = AUDIENCES.includes(data.audience as RecipeAudience) ? (data.audience as RecipeAudience) : "any";
      const steps = parseSteps(body);
      if (steps.length === 0) continue;
      out.push({ name, description, audience, steps, scope, file, updatedAt: statSync(file).mtimeMs });
    } catch {
    }
  }
  return out;
}

export interface DiscoverRecipesOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

export function discoverRecipes(opts: DiscoverRecipesOptions): RecipeEntry[] {
  const byName = new Map<string, RecipeEntry>();
  for (const r of readRecipeDir(userDir(opts.env), "user")) byName.set(r.name, r);
  // Project recipes win over a same-named user recipe (repo intent is shared).
  for (const r of readRecipeDir(projectDir(opts.cwd), "project")) byName.set(r.name, r);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getRecipe(name: string, opts: DiscoverRecipesOptions): RecipeEntry | undefined {
  const slug = slugifyRecipeName(name);
  return discoverRecipes(opts).find((r) => r.name === slug);
}

export function saveRecipe(opts: {
  scope: RecipeScope;
  name: string;
  description: string;
  audience: RecipeAudience;
  steps: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}): RecipeEntry {
  const steps = opts.steps.map((s) => s.trim()).filter((s) => s.length > 0);
  if (steps.length === 0) throw new Error("A recipe needs at least one step.");
  const name = slugifyRecipeName(opts.name);
  const dir = opts.scope === "project" ? projectDir(opts.cwd) : userDir(opts.env);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.md`);
  const audience: RecipeAudience = AUDIENCES.includes(opts.audience) ? opts.audience : "any";
  const description = opts.description.replace(/\n/g, " ").trim();
  const bodyLines = steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const md = `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\naudience: ${audience}\n---\n${bodyLines}\n`;
  writeFileSync(file, md, "utf8");
  return { name, description, audience, steps, scope: opts.scope, file, updatedAt: Date.now() };
}

export function deleteRecipe(opts: { name: string; cwd: string; env?: NodeJS.ProcessEnv }): boolean {
  const name = slugifyRecipeName(opts.name);
  let removed = false;
  for (const dir of [projectDir(opts.cwd), userDir(opts.env)]) {
    const file = join(dir, `${name}.md`);
    if (existsSync(file)) {
      rmSync(file);
      removed = true;
    }
  }
  return removed;
}

export function recipeIndex(recipes: RecipeEntry[]): string {
  if (recipes.length === 0) return "";
  return recipes
    .map((r) => {
      const tag = r.audience === "any" ? "" : ` [${r.audience}]`;
      return `- ${r.name}${tag}: ${r.description || "(no description)"} (${r.steps.length} steps)`;
    })
    .join("\n");
}

// Turn a saved recipe into a ready-to-run task turn. Dev recipes get an
// execute-in-order framing; study recipes get a one-step-at-a-time tutor framing.
export function composeRecipeRun(recipe: RecipeEntry): string {
  const numbered = recipe.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  if (recipe.audience === "study") {
    return [
      `Guide me through this lesson: "${recipe.name}"${recipe.description ? ` — ${recipe.description}` : ""}.`,
      "Teach it one step at a time. Explain the current step, check my understanding, and wait for me before moving on.",
      "",
      numbered,
    ].join("\n");
  }
  return [
    `Run the "${recipe.name}" recipe${recipe.description ? ` — ${recipe.description}` : ""}.`,
    "Work through these steps in order. Do each one, then move to the next; stop and ask only if a step is blocked or genuinely ambiguous.",
    "",
    numbered,
  ].join("\n");
}
