import { Box, Text } from "ink";
import type { Theme } from "../theme";

interface BannerProps {
  theme: Theme;
  model: string;
  cwd: string;
  sessionId: string;
}

/** One-time welcome printed at the top of the scrollback (inside <Static>). */
export function Banner({ theme, model, cwd, sessionId }: BannerProps) {
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor={theme.border} paddingX={1}>
        <Text color={theme.accent} bold>
          ❯ termcoder
        </Text>
        <Text color={theme.muted}>{"  your terminal coding agent"}</Text>
      </Box>
      <Box paddingX={1}>
        <Text color={theme.muted}>{`${model}  ·  ${shorten(cwd)}  ·  ${sessionId.slice(0, 8)}`}</Text>
      </Box>
    </Box>
  );
}

function shorten(p: string): string {
  return p.length > 48 ? `…${p.slice(-47)}` : p;
}
