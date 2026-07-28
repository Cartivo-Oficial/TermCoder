import type { PatchHunk } from "@termcoder/core";

export interface ReviewMark {
  line: number;
  kind: "add" | "remove";
}

export function marksFromPatch(hunks: PatchHunk[]): ReviewMark[] {
  const marks: ReviewMark[] = [];
  for (const hunk of hunks ?? []) {
    let line = hunk.newStart;
    for (const raw of hunk.lines ?? []) {
      const sign = raw.charAt(0);
      if (sign === "+") {
        marks.push({ line, kind: "add" });
        line += 1;
      } else if (sign === "-") {
        marks.push({ line, kind: "remove" });
      } else {
        line += 1;
      }
    }
  }
  return marks;
}
