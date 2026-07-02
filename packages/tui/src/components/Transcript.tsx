import { Box, Text } from "ink";
import type { Theme } from "../theme";
import type { ViewItem } from "../types";
import { DiffView, isDiff } from "./DiffView";
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
        <TranscriptItem key={i} theme={theme} item={item} />
      ))}
    </Box>
  );
}

/** Render a single transcript entry. Exported for use inside Ink's <Static>. */
export function TranscriptItem({ theme, item }: { theme: Theme; item: ViewItem }) {
  switch (item.kind) {
    case "user":
      return (
        <Box marginTop={1}>
          <Text color={theme.user} bold>
            {"❯ "}
          </Text>
          <Text color={theme.assistant}>{item.text}</Text>
          {item.time ? <Text color={theme.border}>{`  ${item.time}`}</Text> : null}
        </Box>
      );

    case "assistant":
      return (
        <Box marginTop={1}>
          <Text color={theme.accent}>{"● "}</Text>
          <Box flexDirection="column">
            <Markdown theme={theme} text={item.text} />
            {item.time ? (
              <Text color={theme.border}>{item.dur ? `${item.time} · ${item.dur}` : item.time}</Text>
            ) : null}
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
          {item.detail ? (
            isDiff(item.detail) ? (
              <DiffView theme={theme} text={item.detail} />
            ) : (
              <Text color={theme.muted}>{indent(item.detail)}</Text>
            )
          ) : null}
          {item.output && item.status !== "running" ? <ToolOutput theme={theme} output={item.output} /> : null}
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

const COLLAPSE_AT = 6;

/**
 * Tool output, collapsed when long: a `▸ N lines` header plus the first few
 * lines, dimmed. Short output is shown in full. Keeps the transcript scannable.
 */
function ToolOutput({ theme, output }: { theme: Theme; output: string }) {
  const lines = output.replace(/\s+$/, "").split("\n");
  if (lines.length <= COLLAPSE_AT) {
    return <Text color={theme.muted}>{indent(lines.join("\n"))}</Text>;
  }
  const head = lines.slice(0, COLLAPSE_AT - 2);
  const hidden = lines.length - head.length;
  return (
    <Box flexDirection="column">
      <Text color={theme.tool}>{`  ▸ ${lines.length} lines`}</Text>
      <Text color={theme.muted}>{indent(head.join("\n"))}</Text>
      <Text color={theme.border}>{`  … +${hidden} more lines`}</Text>
    </Box>
  );
}
