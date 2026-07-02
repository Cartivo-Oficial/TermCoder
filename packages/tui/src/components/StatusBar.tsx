import { Box, Text } from "ink";
import type { Theme } from "../theme";

interface StatusBarProps {
  theme: Theme;
  agent: string;
  cwd: string;
  tokens: number;
  /** Input tokens sent last turn — the live context size. */
  lastCtx?: number;
  autoApprove: boolean;
  /** App version, shown at the far right like a footer. */
  version?: string;
  /** Whether a usable model/provider is configured. */
  ready?: boolean;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function shortenPath(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  const tail = parts.slice(-2).join("/");
  return tail || p;
}

/** A single compact footer line: cwd · agent · ctx · tokens … version. */
export function StatusBar({ theme, agent, cwd, tokens, lastCtx, autoApprove, version, ready }: StatusBarProps) {
  const dot = <Text color={theme.border}>{"  ·  "}</Text>;
  return (
    <Box paddingX={1}>
      <Text color={ready === false ? theme.running : theme.success}>● </Text>
      <Text color={theme.muted}>{shortenPath(cwd)}</Text>
      {dot}
      <Text color={theme.muted}>{agent}</Text>
      {lastCtx && lastCtx > 0 ? (
        <>
          {dot}
          <Text color={lastCtx > 24000 ? theme.running : theme.muted}>{`ctx ~${formatTokens(lastCtx)}`}</Text>
        </>
      ) : null}
      {tokens > 0 ? (
        <>
          {dot}
          <Text color={theme.muted}>{`${formatTokens(tokens)} tok`}</Text>
        </>
      ) : null}
      {autoApprove ? (
        <>
          {dot}
          <Text color={theme.running} bold>
            auto
          </Text>
        </>
      ) : null}
      <Box flexGrow={1} />
      {version ? <Text color={theme.border}>{version}</Text> : null}
    </Box>
  );
}
