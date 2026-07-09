import { Box, Text } from "ink";
import type { Theme } from "../theme";
import { highlightCode } from "./highlight";

interface CodeBlockProps {
  theme: Theme;
  lang?: string;
  lines: string[];
}

export function CodeBlock({ theme, lang, lines }: CodeBlockProps) {
  const body = lines.length > 1 && lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines;
  const gutter = String(body.length).length;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1}>
      {lang ? <Text color={theme.muted}>{lang}</Text> : null}
      {body.map((line, i) => (
        <Text key={i}>
          <Text color={theme.border}>{String(i + 1).padStart(gutter)} </Text>
          {line ? highlightCode(line, theme) : " "}
        </Text>
      ))}
    </Box>
  );
}
