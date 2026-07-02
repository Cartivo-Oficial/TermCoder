import type { ReactNode } from "react";
import { Box, Text } from "ink";
import type { Theme } from "../theme";
import { CodeBlock } from "./CodeBlock";

/** Render inline `code`, **bold**, and [links](url) within a line of text. */
function renderInline(text: string, theme: Theme): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
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
    } else if (token.startsWith("`")) {
      nodes.push(
        <Text key={key++} color={theme.code}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      nodes.push(
        <Text key={key++} color={theme.accent} underline>
          {link ? link[1] : token}
        </Text>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(<Text key={key++}>{text.slice(last)}</Text>);
  return nodes;
}

const cells = (row: string): string[] =>
  row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

const isSeparatorRow = (line: string): boolean => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");

/** Render a GitHub-style pipe table as aligned, bordered columns. */
function renderTable(block: string[], theme: Theme, key: number): ReactNode {
  const header = cells(block[0]!);
  const body = block.slice(2).map(cells);
  const colCount = header.length;
  const widths = Array.from({ length: colCount }, (_, c) =>
    Math.max(header[c]?.length ?? 0, ...body.map((r) => r[c]?.length ?? 0)),
  );
  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
  const rule = widths.map((w) => "─".repeat(w + 2)).join("┼");

  return (
    <Box key={`tbl-${key}`} flexDirection="column">
      <Text>
        {header.map((h, c) => (
          <Text key={c} color={theme.border}>
            {c === 0 ? "" : "│"}
            <Text color={theme.accent} bold>
              {` ${pad(h, widths[c]!)} `}
            </Text>
          </Text>
        ))}
      </Text>
      <Text color={theme.border}>{rule}</Text>
      {body.map((row, r) => (
        <Text key={r}>
          {widths.map((w, c) => (
            <Text key={c}>
              <Text color={theme.border}>{c === 0 ? "" : "│"}</Text>
              <Text color={theme.assistant}>{` ${pad(row[c] ?? "", w)} `}</Text>
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
}

/**
 * A small, dependency-free Markdown renderer for assistant messages: headings,
 * bullet/numbered lists, blockquotes, tables, links, horizontal rules, fenced
 * code, and inline code/bold. Covers what models emit in chat without a parser.
 */
export function Markdown({ theme, text }: { theme: Theme; text: string }) {
  const lines = text.split("\n");
  const rows: ReactNode[] = [];
  let inCode = false;
  let codeLang: string | undefined;
  let codeLines: string[] = [];

  const flushCode = (key: number) => {
    rows.push(<CodeBlock key={`code-${key}`} theme={theme} lang={codeLang} lines={codeLines} />);
    codeLines = [];
    codeLang = undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const fence = line.trim().startsWith("```");
    if (fence) {
      if (inCode) {
        flushCode(i);
        inCode = false;
      } else {
        inCode = true;
        codeLang = line.trim().slice(3).trim() || undefined;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Table: a header row of `|` cells followed by a `---` separator row.
    if (line.includes("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1]!)) {
      const block: string[] = [line, lines[i + 1]!];
      let j = i + 2;
      while (j < lines.length && lines[j]!.includes("|")) block.push(lines[j++]!);
      rows.push(renderTable(block, theme, i));
      i = j - 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)/.exec(line);
    if (heading) {
      rows.push(
        <Text key={i} bold color={theme.accent}>
          {heading[2]}
        </Text>,
      );
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      rows.push(
        <Text key={i} color={theme.border}>
          {"─".repeat(40)}
        </Text>,
      );
      continue;
    }

    const numbered = /^(\s*)(\d+)\.\s+(.*)/.exec(line);
    if (numbered) {
      rows.push(
        <Text key={i}>
          {numbered[1]}
          <Text color={theme.accent}>{`${numbered[2]}. `}</Text>
          {renderInline(numbered[3] ?? "", theme)}
        </Text>,
      );
      continue;
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
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      rows.push(
        <Text key={i} color={theme.muted}>
          {"│ "}
          {renderInline(line.replace(/^\s*>\s?/, ""), theme)}
        </Text>,
      );
      continue;
    }

    rows.push(
      <Text key={i} color={theme.assistant}>
        {line ? renderInline(line, theme) : " "}
      </Text>,
    );
  }

  // Streaming may end mid-fence; render what we have of the open block.
  if (inCode && codeLines.length > 0) flushCode(lines.length);

  return <Box flexDirection="column">{rows}</Box>;
}
