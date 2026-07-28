import { diffLines, structuredPatch } from "diff";

export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export function filePatch(oldStr: string, newStr: string): PatchHunk[] {
  const patch = structuredPatch("a", "b", oldStr ?? "", newStr ?? "", "", "", { context: 3 });
  return patch.hunks.map((h) => ({
    oldStart: h.oldStart,
    oldLines: h.oldLines,
    newStart: h.newStart,
    newLines: h.newLines,
    lines: h.lines,
  }));
}

export function formatDiff(oldStr: string, newStr: string, maxLines = 60): string {
  const parts = diffLines(oldStr ?? "", newStr ?? "");
  const out: string[] = [];

  for (const part of parts) {
    const prefix = part.added ? "+" : part.removed ? "-" : " ";
    const lines = part.value.replace(/\n$/, "").split("\n");

    if (!part.added && !part.removed && lines.length > 6) {
      out.push(`  ${lines[0]}`);
      out.push(`  … (${lines.length - 2} unchanged lines)`);
      out.push(`  ${lines[lines.length - 1]}`);
    } else {
      for (const line of lines) out.push(`${prefix} ${line}`);
    }

    if (out.length > maxLines) {
      out.push("  … (diff truncated)");
      break;
    }
  }

  return out.join("\n");
}
