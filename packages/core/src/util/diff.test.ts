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

import { filePatch } from "./diff";

describe("filePatch", () => {
  const before = "um\ndois\ntres\nquatro\ncinco\nseis\nsete\n";

  it("locates a change by its line number in the new file", () => {
    const after = "um\ndois\ntres\nQUATRO\ncinco\nseis\nsete\n";
    const hunks = filePatch(before, after);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.newStart).toBe(1);
    expect(hunks[0]!.lines).toContain("-quatro");
    expect(hunks[0]!.lines).toContain("+QUATRO");
  });

  it("returns no hunks when the two sides are identical", () => {
    expect(filePatch(before, before)).toEqual([]);
  });

  it("reports two hunks for two separated changes", () => {
    const long = Array.from({ length: 40 }, (_, i) => `linha ${i + 1}`).join("\n") + "\n";
    const edited = long.replace("linha 3", "LINHA 3").replace("linha 38", "LINHA 38");
    const hunks = filePatch(long, edited);
    expect(hunks.length).toBe(2);
    expect(hunks[0]!.newStart).toBeLessThan(hunks[1]!.newStart);
  });

  it("handles an empty original", () => {
    const hunks = filePatch("", "nova\n");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.lines.some((l) => l.startsWith("+"))).toBe(true);
  });
});
