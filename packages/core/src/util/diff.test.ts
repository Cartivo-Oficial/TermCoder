import { describe, expect, it } from "vitest";
import { formatDiff } from "./diff";

describe("formatDiff", () => {
  it("marks removed and added lines", () => {
    const out = formatDiff("a\nb\nc\n", "a\nx\nc\n");
    expect(out).toContain("- b");
    expect(out).toContain("+ x");
    expect(out).toContain("  a");
  });

  it("renders a new file as all additions", () => {
    const out = formatDiff("", "line1\nline2\n");
    expect(out).toContain("+ line1");
    expect(out).toContain("+ line2");
    expect(out).not.toContain("- ");
  });

  it("collapses long unchanged runs", () => {
    const big = Array.from({ length: 30 }, (_, i) => `line${i}`).join("\n") + "\n";
    const out = formatDiff(big, big + "added\n");
    expect(out).toContain("unchanged lines)");
    expect(out).toContain("+ added");
  });
});
