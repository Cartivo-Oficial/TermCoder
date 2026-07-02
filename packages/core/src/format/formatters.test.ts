import { describe, expect, it } from "vitest";
import { loadConfig, type Config } from "../config/config";
import { formattersFor } from "./formatters";

function cfg(formatter: Config["formatter"]): Config {
  const c = loadConfig({ cwd: "/", configDir: "/none", env: {} });
  c.formatter = formatter;
  return c;
}

describe("formattersFor", () => {
  it("returns nothing when disabled (default)", () => {
    expect(formattersFor(cfg(false), ".ts")).toEqual([]);
  });

  it("matches prettier for a .ts file when enabled", () => {
    const names = formattersFor(cfg(true), ".ts").map((f) => f.name);
    expect(names).toContain("prettier");
  });

  it("matches gofmt for .go and not for .ts", () => {
    expect(formattersFor(cfg(true), ".go").map((f) => f.name)).toEqual(["gofmt"]);
    expect(formattersFor(cfg(true), ".go").map((f) => f.name)).not.toContain("prettier");
  });

  it("respects a per-formatter disable and custom formatters", () => {
    const config = cfg({
      prettier: { disabled: true },
      "deno-md": { command: ["deno", "fmt", "$FILE"], extensions: [".md"] },
    });
    expect(formattersFor(config, ".ts").map((f) => f.name)).not.toContain("prettier");
    expect(formattersFor(config, ".md").map((f) => f.name)).toContain("deno-md");
  });
});
