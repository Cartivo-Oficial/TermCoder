import { diffLines } from "diff";

/**
 * Build a compact unified-style diff between two strings. Each line is prefixed
 * with `+ ` (added), `- ` (removed), or `  ` (context). Long unchanged runs are
 * collapsed. Clients colorize by the leading character.
 */
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
