import { Box, Text } from "ink";
import type { Theme } from "../theme";

interface HeaderProps {
  theme: Theme;
  model: string;
  cwd: string;
  sessionId: string;
}

/** Top banner: product name, active model, working directory, session id. */
export function Header({ theme, model, cwd, sessionId }: HeaderProps) {
  return (
    <Box
      borderStyle="round"
      borderColor={theme.primary}
      paddingX={1}
      justifyContent="space-between"
    >
      <Text>
        <Text color={theme.primary} bold>
          termcoder
        </Text>
        <Text color={theme.muted}> · {model}</Text>
      </Text>
      <Text color={theme.muted}>
        {shorten(cwd)} · {sessionId.slice(0, 8)}
      </Text>
    </Box>
  );
}

function shorten(p: string): string {
  return p.length > 40 ? `…${p.slice(-39)}` : p;
}
