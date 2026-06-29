import { Box, Text } from "ink";
import type { Theme } from "../theme";

interface BannerProps {
  theme: Theme;
  model: string;
  cwd: string;
  sessionId: string;
}

const MASCOT = ["╭──────╮", "│ ◕  ◕ │", "│  ▿   │", "╰──────╯"];

const TIPS: Array<[string, string]> = [
  ["/help", "all commands"],
  ["/model", "switch the model"],
  ["/resume", "reopen a session"],
  ["/share", "export this chat"],
];

/** A two-column welcome card printed once at the top (inside <Static>). */
export function Banner({ theme, model, cwd, sessionId }: BannerProps) {
  return (
    <Box borderStyle="round" borderColor={theme.accent} paddingX={2} flexDirection="row">
      <Box flexDirection="column" marginRight={3}>
        <Text color={theme.accent} bold>
          Welcome to termcoder
        </Text>
        <Box marginTop={1} flexDirection="column">
          {MASCOT.map((line, i) => (
            <Text key={i} color={theme.accent}>
              {line}
            </Text>
          ))}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.muted}>{model}</Text>
          <Text color={theme.muted}>{shorten(cwd)}</Text>
          <Text color={theme.muted}>{`session ${sessionId.slice(0, 8)}`}</Text>
        </Box>
      </Box>

      <Box
        flexDirection="column"
        paddingLeft={3}
        borderStyle="round"
        borderColor={theme.border}
        borderTop={false}
        borderBottom={false}
        borderRight={false}
      >
        <Text color={theme.assistant} bold>
          Getting started
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.muted}>Ask me to write code, run commands,</Text>
          <Text color={theme.muted}>or search the web. I use tools and</Text>
          <Text color={theme.muted}>ask before changing anything.</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {TIPS.map(([cmd, desc]) => (
            <Text key={cmd}>
              <Text color={theme.accent}>{cmd.padEnd(9)}</Text>
              <Text color={theme.muted}>{desc}</Text>
            </Text>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text color={theme.muted}>Drop an AGENTS.md for project rules.</Text>
        </Box>
      </Box>
    </Box>
  );
}

function shorten(p: string): string {
  return p.length > 36 ? `…${p.slice(-35)}` : p;
}
