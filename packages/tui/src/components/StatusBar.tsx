import { Box, Text } from "ink";
import type { Theme } from "../theme";

interface StatusBarProps {
  theme: Theme;
  cwd: string;
  tokens: number;
  /** Input tokens sent last turn — the live context size. */
  lastCtx?: number;
  /** Percentage of the model's context window used last turn. */
  ctxPct?: number;
  autoApprove: boolean;
  /** App version, shown at the far right like a footer. */
  version?: string;
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

/**
 * A minimal footer, MiMo-style: the folder at the bottom-left and the version at
 * the bottom-right. Context/token usage only appear once a turn has run, so a
 * fresh home screen stays clean.
 */
export function StatusBar({ theme, cwd, tokens, lastCtx, ctxPct, autoApprove, version }: StatusBarProps) {
  const dot = <Text color={theme.border}>{"  ·  "}</Text>;
  return (
    <Box paddingX={1}>
      <Text color={theme.muted}>{shortenPath(cwd)}</Text>
      {lastCtx && lastCtx > 0 ? (
        <>
          {dot}
          <Text color={ctxPct && ctxPct > 70 ? theme.error : ctxPct && ctxPct > 40 ? theme.running : theme.muted}>
            {`ctx ${formatTokens(lastCtx)}${ctxPct ? ` (${ctxPct}%)` : ""}`}
          </Text>
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
