import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { Theme } from "../theme";

interface ComposerProps {
  theme: Theme;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  busy: boolean;
  disabled: boolean;
}

/** Bottom input: a rounded prompt box with a hint line; a spinner while busy. */
export function Composer({ theme, value, onChange, onSubmit, busy, disabled }: ComposerProps) {
  if (busy) {
    return (
      <Box marginTop={1} paddingX={1}>
        <Text color={theme.accent}>
          <Spinner type="dots" />
        </Text>
        <Text color={theme.muted}> thinking…</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="round" borderColor={theme.border} paddingX={1}>
        <Text color={theme.accent}>{"❯ "}</Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          focus={!disabled}
          placeholder="Ask termcoder to do something…"
        />
      </Box>
      <Box paddingX={1}>
        <Text color={theme.muted}>enter send</Text>
        <Text color={theme.border}>{"  ·  "}</Text>
        <Text color={theme.muted}>/help</Text>
        <Text color={theme.border}>{"  ·  "}</Text>
        <Text color={theme.muted}>ctrl+c quit</Text>
      </Box>
    </Box>
  );
}
