import { Box, Text, useStdout } from "ink";
import type { Theme } from "../theme";

interface HeaderProps {
  theme: Theme;
  model: string;
  cwd: string;
  sessionId: string;
}

/** A slim top bar: brand + model on the left, cwd + session on the right, under a hairline. */
export function Header({ theme, model, cwd, sessionId }: HeaderProps) {
  const { stdout } = useStdout();
  const width = Math.max(20, stdout?.columns ?? 80);
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text>
          <Text color={theme.accent} bold>
            ❯ termcoder
          </Text>
          <Text color={theme.muted}>{`  ${model}`}</Text>
        </Text>
        <Text color={theme.muted}>{`${shorten(cwd)}  ·  ${sessionId.slice(0, 8)}`}</Text>
      </Box>
      <Text color={theme.border}>{"─".repeat(width)}</Text>
    </Box>
  );
}

function shorten(p: string): string {
  return p.length > 44 ? `…${p.slice(-43)}` : p;
}
