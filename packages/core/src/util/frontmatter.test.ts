import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("parses scalars, nested objects and inline arrays", () => {
    const { data, body } = parseFrontmatter(
      [
        "---",
        "description: A reviewer",
        "mode: subagent",
        "temperature: 0.2",
        "permission:",
        "  edit: deny",
        "  bash: deny",
        "tools: [read, grep]",
        "---",
        "You review code.",
      ].join("\n"),
    );
    expect(data.description).toBe("A reviewer");
    expect(data.mode).toBe("subagent");
    expect(data.temperature).toBe(0.2);
    expect(data.permission).toEqual({ edit: "deny", bash: "deny" });
    expect(data.tools).toEqual(["read", "grep"]);
    expect(body).toBe("You review code.");
  });

  it("parses block arrays", () => {
    const { data } = parseFrontmatter("---\ntools:\n  - read\n  - ls\n---\nx");
    expect(data.tools).toEqual(["read", "ls"]);
  });

  it("returns the whole text as body when there is no frontmatter", () => {
    const { data, body } = parseFrontmatter("just body");
    expect(data).toEqual({});
    expect(body).toBe("just body");
  });
});
