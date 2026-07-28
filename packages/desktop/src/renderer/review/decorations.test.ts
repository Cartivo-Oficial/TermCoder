import { describe, expect, it } from "vitest";
import { marksFromPatch } from "./decorations";

describe("marksFromPatch", () => {
  it("marks an added line at its real line number", () => {
    const marks = marksFromPatch([
      { oldStart: 10, oldLines: 3, newStart: 10, newLines: 4, lines: [" a", " b", "+novo", " c"] },
    ]);
    expect(marks).toEqual([{ line: 12, kind: "add" }]);
  });

  it("marks a removed line at the position it would occupy", () => {
    const marks = marksFromPatch([
      { oldStart: 1, oldLines: 3, newStart: 1, newLines: 2, lines: [" a", "-velho", " b"] },
    ]);
    expect(marks).toEqual([{ line: 2, kind: "remove" }]);
  });

  it("handles a replacement as a remove plus an add", () => {
    const marks = marksFromPatch([
      { oldStart: 5, oldLines: 3, newStart: 5, newLines: 3, lines: [" a", "-antes", "+depois", " b"] },
    ]);
    expect(marks).toEqual([
      { line: 6, kind: "remove" },
      { line: 6, kind: "add" },
    ]);
  });

  it("keeps both hunks of a patch at their own offsets", () => {
    const marks = marksFromPatch([
      { oldStart: 1, oldLines: 2, newStart: 1, newLines: 3, lines: [" a", "+um" ] },
      { oldStart: 30, oldLines: 2, newStart: 31, newLines: 3, lines: [" z", "+dois"] },
    ]);
    expect(marks).toEqual([
      { line: 2, kind: "add" },
      { line: 32, kind: "add" },
    ]);
  });

  it("returns nothing for an empty patch", () => {
    expect(marksFromPatch([])).toEqual([]);
  });
});
