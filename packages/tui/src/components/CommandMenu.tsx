import { Box, Text } from "ink";
import type { Theme } from "../theme";
import type { TuiCommand } from "../commands";

interface CommandMenuProps {
  theme: Theme;
  commands: TuiCommand[];
  selected: number;
}

const MAX_VISIBLE = 6;

/**
 * The autocomplete dropdown shown above the composer while typing a slash
 * command. Highlights the selected row; ↑/↓ move, tab/enter complete.
 */
export function CommandMenu({ theme, commands, selected }: CommandMenuProps) {
  if (commands.length === 0) return null;

  // Keep the selected row visible in a small scrolling window.
  const start = Math.max(0, Math.min(selected - MAX_VISIBLE + 1, commands.length - MAX_VISIBLE));
  const visible = commands.slice(Math.max(0, start), Math.max(0, start) + MAX_VISIBLE);
  const nameWidth = Math.max(...commands.map((c) => c.name.length + (c.arg ? c.arg.length + 1 : 0)));

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
    >
      {visible.map((c) => {
        const idx = commands.indexOf(c);
        const active = idx === selected;
        const sig = c.arg ? `${c.name} ${c.arg}` : c.name;
        return (
          <Text key={c.name}>
            <Text color={active ? theme.accent : theme.border}>{active ? "❯ " : "  "}</Text>
            <Text color={active ? theme.primary : theme.tool} bold={active}>
              {`/${sig}`.padEnd(nameWidth + 2)}
            </Text>
            <Text color={theme.muted}>{`  ${c.desc}`}</Text>
          </Text>
        );
      })}
      {commands.length > MAX_VISIBLE ? (
        <Text color={theme.border}>{`  … ${commands.length - MAX_VISIBLE} more`}</Text>
      ) : null}
    </Box>
  );
}
