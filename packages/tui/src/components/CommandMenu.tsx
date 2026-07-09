import { Box, Text } from "ink";
import type { Theme } from "../theme";
import type { TuiCommand } from "../commands";

interface CommandMenuProps {
  theme: Theme;
  commands: TuiCommand[];
  selected: number;
}

const MAX_VISIBLE = 6;

export function CommandMenu({ theme, commands, selected }: CommandMenuProps) {
  if (commands.length === 0) return null;

  const start = Math.max(0, Math.min(selected - MAX_VISIBLE + 1, commands.length - MAX_VISIBLE));
  const visible = commands.slice(Math.max(0, start), Math.max(0, start) + MAX_VISIBLE);
  const nameWidth = Math.max(...commands.map((c) => c.name.length + (c.arg ? c.arg.length + 1 : 0)));
  const barWidth = Math.min(64, nameWidth + 5 + Math.max(...commands.map((c) => c.desc.length)));

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
        if (active) {
          const line = `❯ /${sig}`.padEnd(nameWidth + 4) + `  ${c.desc}`;
          return (
            <Text key={c.name} backgroundColor={theme.accent} color="#0b0b0d" bold>
              {` ${line}`.padEnd(barWidth)}
            </Text>
          );
        }
        return (
          <Text key={c.name}>
            <Text color={theme.border}>{"  "}</Text>
            <Text color={theme.tool}>{`/${sig}`.padEnd(nameWidth + 2)}</Text>
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
