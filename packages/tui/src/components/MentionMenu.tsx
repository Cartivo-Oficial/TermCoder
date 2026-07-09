import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { Theme } from "../theme";

interface MentionMenuProps {
  theme: Theme;
  files: string[];
  selected: number;
  cwd?: string;
}

const MAX_VISIBLE = 6;
const PREVIEW_LINES = 6;
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|php|java|c|h|cpp|cc|cs|kt|swift|md|mdx|txt|json|ya?ml|toml|css|scss|html|sh|sql|env|xml|ini|cfg)$/i;

function preview(cwd: string, rel: string): string[] {
  if (!TEXT_EXT.test(rel)) return [];
  try {
    const text = readFileSync(join(cwd, rel), "utf8");
    return text.split("\n").slice(0, PREVIEW_LINES).map((l) => l.replace(/\t/g, "  ").slice(0, 72));
  } catch {
    return [];
  }
}

export function MentionMenu({ theme, files, selected, cwd }: MentionMenuProps) {
  if (files.length === 0) return null;
  const start = Math.max(0, Math.min(selected - MAX_VISIBLE + 1, files.length - MAX_VISIBLE));
  const visible = files.slice(Math.max(0, start), Math.max(0, start) + MAX_VISIBLE);
  const current = files[selected];
  const lines = cwd && current ? preview(cwd, current) : [];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1}>
      {visible.map((f) => {
        const idx = files.indexOf(f);
        const active = idx === selected;
        const slash = f.lastIndexOf("/");
        const dir = slash >= 0 ? f.slice(0, slash + 1) : "";
        const base = slash >= 0 ? f.slice(slash + 1) : f;
        return (
          <Text key={f}>
            <Text color={active ? theme.accent : theme.border}>{active ? "❯ " : "  "}</Text>
            <Text color={theme.muted}>{dir}</Text>
            <Text color={active ? theme.primary : theme.tool} bold={active}>
              {base}
            </Text>
          </Text>
        );
      })}
      {files.length > MAX_VISIBLE ? (
        <Text color={theme.border}>{`  … ${files.length - MAX_VISIBLE} more`}</Text>
      ) : null}
      {lines.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.border}>{`  ── ${current} ──`}</Text>
          {lines.map((l, i) => (
            <Text key={i} color={theme.muted}>
              {`  ${l || " "}`}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
