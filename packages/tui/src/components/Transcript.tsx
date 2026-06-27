import { Box, Text } from "ink";
import type { Theme } from "../theme";
import type { ViewItem } from "../types";
import { Markdown } from "./Markdown";

interface TranscriptProps {
  theme: Theme;
  items: ViewItem[];
}

const STATUS_ICON = { running: "•", done: "✓", error: "✗" } as const;

/** Renders the conversation: user/assistant turns, tool calls, notices, errors. */
export function Transcript({ theme, items }: TranscriptProps) {
  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <Item key={i} theme={theme} item={item} />
      ))}
    </Box>
  );
}

function Item({ theme, item }: { theme: Theme; item: ViewItem }) {
  switch (item.kind) {
    case "user":
      return (
        <Box marginTop={1}>
          <Text color={theme.user} bold>
            {"❯ "}
          </Text>
          <Text color={theme.assistant}>{item.text}</Text>
        </Box>
      );

    case "assistant":
      return (
        <Box marginTop={1}>
          <Text color={theme.accent}>{"● "}</Text>
          <Box flexDirection="column">
            <Markdown theme={theme} text={item.text} />
          </Box>
        </Box>
      );

    case "tool": {
      const color =
        item.status === "error"
          ? theme.error
          : item.status === "done"
            ? theme.success
            : theme.running;
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text color={color}>{`${STATUS_ICON[item.status]} `}</Text>
            <Text color={theme.tool} bold>
              {item.name}
            </Text>
            {item.title ? <Text color={theme.muted}>{`  ${item.title}`}</Text> : null}
          </Text>
          {item.detail ? <Text color={theme.muted}>{indent(item.detail)}</Text> : null}
          {item.output && item.status !== "running" ? (
            <Text color={theme.muted}>{indent(preview(item.output))}</Text>
          ) : null}
        </Box>
      );
    }

    case "notice":
      return (
        <Box marginTop={1}>
          <Text color={theme.muted}>{item.text}</Text>
        </Box>
      );

    case "error":
      return (
        <Box marginTop={1}>
          <Text color={theme.error}>{`✗ ${item.text}`}</Text>
        </Box>
      );
  }
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
}

function preview(output: string, maxLines = 8): string {
  const lines = output.split("\n");
  if (lines.length <= maxLines) return output;
  return [...lines.slice(0, maxLines), `… (+${lines.length - maxLines} lines)`].join("\n");
}
