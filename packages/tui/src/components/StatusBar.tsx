import { Box, Text, useStdout } from "ink";
import type { Theme } from "../theme";

interface StatusBarProps {
  theme: Theme;
  cwd: string;
  tokens: number;
  lastCtx?: number;
  ctxPct?: number;
  autoApprove: boolean;
  version?: string;
  model?: string;
  agent?: string;
}

function shortModel(model: string): string {
  const idx = model.indexOf("/");
  return idx >= 0 ? model.slice(idx + 1) : model;
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

const SEP = "  ·  ";

interface Segment {
  key: string;
  priority: number;
  text: string;
  color?: string;
  bold?: boolean;
}

export function StatusBar({ theme, cwd, tokens, lastCtx, ctxPct, autoApprove, version, model, agent }: StatusBarProps) {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? 80;

  const segments: Segment[] = [];

  if (model) {
    segments.push({ key: "model", priority: 1, text: shortModel(model), color: theme.muted });
  }
  if (agent) {
    segments.push({ key: "agent", priority: 2, text: agent, color: theme.muted });
  }
  segments.push({ key: "path", priority: 3, text: shortenPath(cwd), color: theme.muted });
  if (lastCtx && lastCtx > 0) {
    segments.push({
      key: "ctx",
      priority: 4,
      text: `ctx ${formatTokens(lastCtx)}${ctxPct ? ` (${ctxPct}%)` : ""}`,
      color: ctxPct && ctxPct > 70 ? theme.error : ctxPct && ctxPct > 40 ? theme.running : theme.muted,
    });
  }
  if (tokens > 0) {
    segments.push({ key: "tokens", priority: 5, text: `${formatTokens(tokens)} tok`, color: theme.muted });
  }
  if (autoApprove) {
    segments.push({ key: "auto", priority: 6, text: "auto", color: theme.running, bold: true });
  }
  if (version) {
    segments.push({ key: "version", priority: 7, text: version, color: theme.border });
  }

  const included = new Set<string>();
  let width = 0;
  for (const seg of [...segments].sort((a, b) => a.priority - b.priority)) {
    const next = width + seg.text.length + SEP.length;
    if (next > columns - 1) break;
    width = next;
    included.add(seg.key);
  }
  const visible = segments.filter((seg) => included.has(seg.key));

  return (
    <Box paddingX={1}>
      {visible.flatMap((seg, i) => [
        i > 0 ? (
          <Text key={`${seg.key}-sep`} color={theme.border}>
            {SEP}
          </Text>
        ) : null,
        <Text key={seg.key} color={seg.color} bold={seg.bold}>
          {seg.text}
        </Text>,
      ])}
    </Box>
  );
}
