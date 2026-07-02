import { Box, Text, useInput } from "ink";
import type { Theme } from "../theme";

interface TrustPromptProps {
  theme: Theme;
  cwd: string;
  onDecision: (trust: boolean) => void;
}

const BRAND = "#ff7a45";

/**
 * A first-use safety gate (like Claude Code's "do you trust this folder?"),
 * shown on its own BEFORE the main interface. The agent can read files and run
 * commands, so we confirm before working in a new directory. `y` trusts and
 * remembers it; `n`/esc quits.
 */
export function TrustPrompt({ theme, cwd, onDecision }: TrustPromptProps) {
  useInput((input, key) => {
    if (input === "y" || input === "Y") onDecision(true);
    else if (input === "n" || input === "N" || key.escape) onDecision(false);
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Text bold>
        <Text color={BRAND}>term</Text>
        <Text color={theme.assistant}>coder</Text>
      </Text>

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.accent}
        paddingX={3}
        paddingY={1}
        marginTop={1}
      >
        <Text color={theme.accent} bold>
          Do you trust the files in this folder?
        </Text>
        <Box marginTop={1}>
          <Text color={theme.tool}>{cwd}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.muted}>termcoder can read files and run commands in this folder.</Text>
          <Text color={theme.muted}>Only continue in a folder whose contents you trust.</Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            <Text color={theme.success} bold>
              y
            </Text>
            <Text color={theme.muted}> yes, trust this folder</Text>
            <Text color={theme.border}>{"    "}</Text>
            <Text color={theme.error} bold>
              n
            </Text>
            <Text color={theme.muted}> no, quit</Text>
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
