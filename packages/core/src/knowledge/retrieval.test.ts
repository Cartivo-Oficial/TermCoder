import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildRetrievalIndex, rankFiles, retrievalContext, tokenize } from "./retrieval";
import type { SymbolEntry } from "./symbols";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tc-retr-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "src", "billing.ts"),
    "export function processInvoice(customerId: string) {\n  return chargeCustomer(customerId);\n}\nfunction chargeCustomer(id: string) {\n  return id;\n}\n",
  );
  writeFileSync(
    join(dir, "src", "greeting.ts"),
    "export function sayHello(name: string) {\n  return `hello ${name}`;\n}\n",
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("tokenize", () => {
  it("splits camelCase and snake_case and drops stopwords and short tokens", () => {
    expect(tokenize("parseFrontmatter and the snake_case_id")).toEqual([
      "parse", "frontmatter", "snake", "case",
    ]);
  });
  it("returns [] for stopword-only text", () => {
    expect(tokenize("the and for with")).toEqual([]);
  });
});

describe("buildRetrievalIndex + rankFiles", () => {
  it("ranks the file containing the query terms first", () => {
    const index = buildRetrievalIndex(dir);
    expect(index.totalFiles).toBe(2);
    const ranked = rankFiles(index, "fix the processInvoice charge logic");
    expect(ranked[0]?.file).toBe("src/billing.ts");
  });
  it("returns [] for an empty or stopword-only query", () => {
    const index = buildRetrievalIndex(dir);
    expect(rankFiles(index, "")).toEqual([]);
    expect(rankFiles(index, "the and")).toEqual([]);
  });
  it("does not let raw repetition in a long file bury a short focused file", () => {
    const fillerWords = [
      "alpha", "bravo", "charlie", "echo", "foxtrot", "golf", "hotel", "india",
      "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec",
      "romeo", "sierra", "tango", "uniform", "victor", "whiskey", "xray", "yankee", "zulu",
    ];
    const longLines: string[] = [];
    for (let i = 0; i < 200; i++) {
      const w1 = fillerWords[i % fillerWords.length];
      const w2 = fillerWords[(i + 7) % fillerWords.length];
      const w3 = fillerWords[(i + 13) % fillerWords.length];
      longLines.push(i % 7 === 0 ? `${w1} delta ${w2} ${w3}` : `${w1} ${w2} ${w3}`);
    }
    writeFileSync(join(dir, "src", "delta-long.ts"), longLines.join("\n"));
    writeFileSync(join(dir, "src", "delta-short.ts"), "delta refactor plan for module cleanup\n");
    const index = buildRetrievalIndex(dir);
    const ranked = rankFiles(index, "delta refactor");
    const short = ranked.find((r) => r.file === "src/delta-short.ts");
    const long = ranked.find((r) => r.file === "src/delta-long.ts");
    expect(short).toBeDefined();
    expect(long).toBeDefined();
    expect(short!.score).toBeGreaterThan(long!.score);
  });
});

describe("retrievalContext", () => {
  const symbols: SymbolEntry[] = [
    { name: "processInvoice", kind: "function", file: "src/billing.ts", line: 1 },
    { name: "chargeCustomer", kind: "function", file: "src/billing.ts", line: 4 },
    { name: "sayHello", kind: "function", file: "src/greeting.ts", line: 1 },
  ];
  it("lists relevant files with symbol pointers, never bodies", () => {
    const index = buildRetrievalIndex(dir);
    const block = retrievalContext(index, symbols, "fix the processInvoice charge logic", 8);
    expect(block).toContain("src/billing.ts");
    expect(block).toContain("processInvoice:1");
    expect(block).not.toContain("customerId");
  });
  it("returns empty when nothing clears the floor", () => {
    const index = buildRetrievalIndex(dir);
    expect(retrievalContext(index, symbols, "unrelated zebra astronomy", 8)).toBe("");
  });
  it("respects maxFiles", () => {
    const index = buildRetrievalIndex(dir);
    const block = retrievalContext(index, symbols, "function hello invoice charge", 1);
    expect(block.split("\n").filter((l) => l.startsWith("- ")).length).toBeLessThanOrEqual(1);
  });
});
