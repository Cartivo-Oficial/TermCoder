import { Box, Text } from "ink";
import type { Theme } from "../theme";

/** True if the text looks like a unified diff (has +/- prefixed lines). */
export function isDiff(text: string): boolean {
  return /^[+-] /m.test(text);
}

/** Render a unified-style diff: additions green, removals red, context dim. */
export function DiffView({ theme, text }: { theme: Theme; text: string }) {
  return (
    <Box flexDirection="column">
      {text.split("\n").map((line, i) => {
        const color = line.startsWith("+")
          ? theme.success
          : line.startsWith("-")
            ? theme.error
            : theme.muted;
        return (
          <Text key={i} color={color}>
            {"  "}
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
