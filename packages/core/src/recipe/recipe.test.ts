import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  discoverRecipes,
  getRecipe,
  saveRecipe,
  deleteRecipe,
  recipeIndex,
  composeRecipeRun,
  parseSteps,
  slugifyRecipeName,
} from "./recipe";

let dir: string;
let cfg: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-recipe-"));
  cfg = mkdtempSync(join(tmpdir(), "tc-cfg-"));
  env = { XDG_CONFIG_HOME: cfg };
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
});

describe("slugifyRecipeName", () => {
  it("normalizes to a kebab slug and never empties", () => {
    expect(slugifyRecipeName("Open a PR!")).toBe("open-a-pr");
    expect(slugifyRecipeName("  Ship  It  ")).toBe("ship-it");
    expect(slugifyRecipeName("***")).toBe("recipe");
  });
});

describe("parseSteps", () => {
  it("strips list markers and drops blank lines", () => {
    expect(parseSteps("1. run tests\n2) fix failures\n- commit\n\n* push")).toEqual([
      "run tests",
      "fix failures",
      "commit",
      "push",
    ]);
    expect(parseSteps("just one line")).toEqual(["just one line"]);
  });
});

describe("saveRecipe + discoverRecipes", () => {
  it("round-trips project and user recipes; project overrides user by name", () => {
    saveRecipe({ scope: "user", name: "Daily", description: "morning", audience: "dev", steps: ["pull", "test"], cwd: dir, env });
    saveRecipe({ scope: "project", name: "Ship It", description: "release flow", audience: "dev", steps: ["bump", "tag", "publish"], cwd: dir, env });
    saveRecipe({ scope: "user", name: "Ship It", description: "user copy", audience: "dev", steps: ["nope"], cwd: dir, env });

    const recipes = discoverRecipes({ cwd: dir, env });
    const byName = Object.fromEntries(recipes.map((r) => [r.name, r]));
    expect(byName["daily"]!.scope).toBe("user");
    expect(byName["ship-it"]!.scope).toBe("project"); // project overrode user
    expect(byName["ship-it"]!.steps).toEqual(["bump", "tag", "publish"]);
    // sorted by name
    expect(recipes.map((r) => r.name)).toEqual(["daily", "ship-it"]);
  });

  it("rejects a recipe with no usable steps", () => {
    expect(() => saveRecipe({ scope: "project", name: "empty", description: "", audience: "any", steps: ["  ", ""], cwd: dir, env })).toThrow();
  });

  it("skips a saved recipe file that has no steps in its body", () => {
    // getRecipe/discover ignore malformed files rather than crashing
    saveRecipe({ scope: "project", name: "ok", description: "", audience: "any", steps: ["do a thing"], cwd: dir, env });
    expect(discoverRecipes({ cwd: dir, env }).map((r) => r.name)).toEqual(["ok"]);
  });
});

describe("getRecipe + deleteRecipe", () => {
  it("fetches by slug and deletes", () => {
    saveRecipe({ scope: "project", name: "Open PR", description: "", audience: "dev", steps: ["branch", "push", "open pr"], cwd: dir, env });
    expect(getRecipe("open-pr", { cwd: dir, env })?.steps.length).toBe(3);
    expect(getRecipe("Open PR", { cwd: dir, env })?.name).toBe("open-pr"); // slugified lookup
    expect(deleteRecipe({ name: "open-pr", cwd: dir, env })).toBe(true);
    expect(getRecipe("open-pr", { cwd: dir, env })).toBeUndefined();
    expect(deleteRecipe({ name: "open-pr", cwd: dir, env })).toBe(false);
  });
});

describe("recipeIndex", () => {
  it("lists name, audience tag, and step count", () => {
    expect(recipeIndex([])).toBe("");
    saveRecipe({ scope: "project", name: "krebs", description: "biology", audience: "study", steps: ["intake", "cycle", "output"], cwd: dir, env });
    const idx = recipeIndex(discoverRecipes({ cwd: dir, env }));
    expect(idx).toContain("krebs [study]: biology (3 steps)");
  });
});

describe("composeRecipeRun", () => {
  it("frames dev recipes as execute-in-order", () => {
    const r = saveRecipe({ scope: "project", name: "build", description: "CI", audience: "dev", steps: ["install", "test"], cwd: dir, env });
    const run = composeRecipeRun(r);
    expect(run).toContain("Run the \"build\" recipe");
    expect(run).toContain("1. install");
    expect(run).toContain("2. test");
  });
  it("frames study recipes as one-step-at-a-time tutoring", () => {
    const r = saveRecipe({ scope: "user", name: "photosynthesis", description: "", audience: "study", steps: ["light", "dark"], cwd: dir, env });
    const run = composeRecipeRun(r);
    expect(run).toContain("one step at a time");
    expect(run).toContain("1. light");
  });
});

describe("persistence on disk", () => {
  it("writes a git-diffable markdown file under .termcoder/recipes", () => {
    const r = saveRecipe({ scope: "project", name: "deploy", description: "", audience: "dev", steps: ["a", "b"], cwd: dir, env });
    expect(r.file).toContain(join(".termcoder", "recipes"));
    expect(existsSync(r.file)).toBe(true);
  });
});
