import { Box, Text } from "ink";
import type { Theme } from "../theme";

/** True if the text looks like a unified diff (has +/- prefixed lines). */
export function isDiff(text: string): boolean {
  return /^[+-] /m.test(text);
}

interface Row {
  type: "add" | "del" | "ctx" | "gap";
  num: number | null;
  text: string;
}

/**
 * Render a unified-style diff with a new-file line-number gutter: additions
 * green, removals red, context dim. Line numbers track the new side (removed
 * lines have none); collapsed context runs advance the counter.
 */
export function DiffView({ theme, text }: { theme: Theme; text: string }) {
  let newNo = 1;
  const rows: Row[] = text.split("\n").map((line) => {
    if (line.startsWith("+")) return { type: "add", num: newNo++, text: line.slice(2) };
    if (line.startsWith("-")) return { type: "del", num: null, text: line.slice(2) };
    const gap = /\((\d+) unchanged lines\)/.exec(line);
    if (gap) {
      newNo += Number(gap[1]);
      return { type: "gap", num: null, text: line.replace(/^\s{0,2}/, "") };
    }
    return { type: "ctx", num: newNo++, text: line.startsWith("  ") ? line.slice(2) : line };
  });
  const width = Math.max(2, String(newNo).length);

  return (
    <Box flexDirection="column">
      {rows.map((r, i) => {
        const gutter =
          r.num !== null ? String(r.num).padStart(width) : (r.type === "del" ? "".padStart(width) : " ".repeat(width));
        const sign = r.type === "add" ? "+" : r.type === "del" ? "-" : r.type === "gap" ? " " : " ";
        const color = r.type === "add" ? theme.success : r.type === "del" ? theme.error : theme.muted;
        return (
          <Text key={i}>
            <Text color={theme.border}>{`${gutter} `}</Text>
            <Text color={color}>{`${sign} ${r.text}`}</Text>
          </Text>
        );
      })}
    </Box>
  );
}
