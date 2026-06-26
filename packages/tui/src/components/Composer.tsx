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

/** Bottom input bar. Shows a spinner while a turn is running. */
export function Composer({ theme, value, onChange, onSubmit, busy, disabled }: ComposerProps) {
  if (busy) {
    return (
      <Box marginTop={1}>
        <Text color={theme.running}>
          <Spinner type="dots" />
        </Text>
        <Text color={theme.muted}> working… (esc to interrupt is not yet supported)</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={theme.primary}>{"› "}</Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          focus={!disabled}
          placeholder="Ask termcoder to do something… (/help)"
        />
      </Box>
    </Box>
  );
}
