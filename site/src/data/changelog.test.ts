import { describe, expect, it } from "vitest";
import { parseChangelog } from "./changelog";

describe("parseChangelog", () => {
  it("splits versions on ## headings, newest first", () => {
    const md = "# Changelog\n\n## 0.10.0\n\nBig release.\n\n## 0.8.2\n\nBugfix.\n";
    const out = parseChangelog(md);
    expect(out.map((v) => v.version)).toEqual(["0.10.0", "0.8.2"]);
    expect(out[0].body.trim()).toBe("Big release.");
  });
  it("splits a ' — title' suffix out of the version heading", () => {
    const md = "## 0.8.0 — \"O Motor\" (The Engine)\n\nText.\n";
    const [v] = parseChangelog(md);
    expect(v.version).toBe("0.8.0");
    expect(v.title).toBe("\"O Motor\" (The Engine)");
  });
  it("ignores the top-level # title and any preamble", () => {
    expect(parseChangelog("# Changelog\n\nintro\n").length).toBe(0);
  });
});
