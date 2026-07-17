import { Box, Text } from "ink";
import type { Theme } from "../theme";

const TAIL = 6;

export function Thinking({ theme, item }: { theme: Theme; item: { text: string; done?: boolean; dur?: string } }) {
  if (item.done) {
    return (
      <Box marginTop={1}>
        <Text color={theme.border}>{`✻ thought${item.dur ? ` for ${item.dur}` : ""}`}</Text>
      </Box>
    );
  }
  const lines = item.text.split("\n");
  const shown = lines.slice(-TAIL);
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.muted}>✻ thinking</Text>
      <Text color={theme.border}>{shown.map((l) => `  ${l}`).join("\n")}</Text>
    </Box>
  );
}
