import type { ReactNode } from "react";
import { Box, Text } from "ink";
import type { Theme } from "../theme";

/** Render inline `code` and **bold** spans within a line of text. */
function renderInline(text: string, theme: Theme): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(<Text key={key++}>{text.slice(last, match.index)}</Text>);
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <Text key={key++} bold>
          {token.slice(2, -2)}
        </Text>,
      );
    } else {
      nodes.push(
        <Text key={key++} color={theme.code}>
          {token.slice(1, -1)}
        </Text>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(<Text key={key++}>{text.slice(last)}</Text>);
  return nodes;
}

/**
 * A small, dependency-free Markdown renderer for assistant messages: headings,
 * bullet lists, blockquotes, fenced code, and inline code/bold. It covers what
 * models actually emit in chat without pulling in a full parser.
 */
export function Markdown({ theme, text }: { theme: Theme; text: string }) {
  const lines = text.split("\n");
  const rows: ReactNode[] = [];
  let inCode = false;

  lines.forEach((line, i) => {
    const fence = line.trim().startsWith("```");
    if (fence) {
      inCode = !inCode;
      return;
    }
    if (inCode) {
      rows.push(
        <Text key={i} color={theme.code}>
          {"  " + line}
        </Text>,
      );
      return;
    }
    const heading = /^(#{1,6})\s+(.*)/.exec(line);
    if (heading) {
      rows.push(
        <Text key={i} bold color={theme.accent}>
          {heading[2]}
        </Text>,
      );
      return;
    }
    const bullet = /^(\s*)[-*]\s+(.*)/.exec(line);
    if (bullet) {
      rows.push(
        <Text key={i}>
          {bullet[1]}
          <Text color={theme.accent}>• </Text>
          {renderInline(bullet[2] ?? "", theme)}
        </Text>,
      );
      return;
    }
    if (/^\s*>\s?/.test(line)) {
      rows.push(
        <Text key={i} color={theme.muted}>
          {"│ "}
          {renderInline(line.replace(/^\s*>\s?/, ""), theme)}
        </Text>,
      );
      return;
    }
    rows.push(
      <Text key={i} color={theme.assistant}>
        {line ? renderInline(line, theme) : " "}
      </Text>,
    );
  });

  return <Box flexDirection="column">{rows}</Box>;
}
