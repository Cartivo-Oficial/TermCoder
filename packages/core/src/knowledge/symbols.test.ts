import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSymbolIndex, findSymbols } from "./symbols";

describe("symbols index", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-sym-"));
    mkdirSync(join(dir, "src"), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("extracts definitions across languages with locations", () => {
    writeFileSync(
      join(dir, "src", "a.ts"),
      "export function resolveModel() {}\nexport class Session {}\nexport type Config = {};\nexport const VERSION = 1;\n",
    );
    writeFileSync(join(dir, "src", "b.py"), "def helper():\n    pass\nclass Thing:\n    pass\n");
    const index = buildSymbolIndex(dir);
    const byName = (n: string) => index.find((s) => s.name === n);

    expect(byName("resolveModel")).toMatchObject({ kind: "function", file: "src/a.ts", line: 1 });
    expect(byName("Session")).toMatchObject({ kind: "class", line: 2 });
    expect(byName("Config")).toMatchObject({ kind: "type" });
    expect(byName("VERSION")).toMatchObject({ kind: "const" });
    expect(byName("helper")).toMatchObject({ kind: "def", file: "src/b.py" });
    expect(byName("Thing")).toMatchObject({ kind: "class" });
  });

  it("ranks exact and prefix matches ahead of fuzzy ones", () => {
    writeFileSync(
      join(dir, "src", "a.ts"),
      "export function resolve() {}\nexport function resolveModel() {}\nexport function getResolved() {}\n",
    );
    const index = buildSymbolIndex(dir);
    const hits = findSymbols(index, "resolve").map((s) => s.name);
    expect(hits[0]).toBe("resolve"); // exact wins
    expect(hits).toContain("resolveModel"); // prefix match
    expect(hits.indexOf("resolve")).toBeLessThan(hits.indexOf("resolveModel"));
  });

  it("skips ignored directories", () => {
    mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "pkg", "x.js"), "export function shouldNotAppear() {}");
    const index = buildSymbolIndex(dir);
    expect(index.find((s) => s.name === "shouldNotAppear")).toBeUndefined();
  });
});
