import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ModelEntry } from "@termcoder/core";
import type { Theme } from "../theme";

interface ModelPickerProps {
  theme: Theme;
  entries: ModelEntry[];
  /** Whether the user can run this model now (has a key, or it's local/ours). */
  ready: (e: ModelEntry) => boolean;
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const GROUPS: Array<{ label: string; match: (e: ModelEntry) => boolean }> = [
  { label: "✦ termcoder AI — our models", match: (e) => e.provider === "termcoder" || e.provider === "termexplorer" },
  { label: "☁ Cloud — needs an API key (/setup)", match: (e) => ["anthropic", "openai", "google"].includes(e.provider) },
  { label: "▪ Local — runs on your machine (Ollama)", match: (e) => e.provider === "ollama" },
];

const MAX_VISIBLE = 12;
const BAR_WIDTH = 60;

type Row = { header: string } | { entry: ModelEntry; itemIndex: number };

/** An advanced, grouped, searchable model chooser (opened by `/model`). */
export function ModelPicker({ theme, entries, ready, current, onSelect, onClose }: ModelPickerProps) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);

  const q = query.trim().toLowerCase();
  const filtered = entries.filter((e) => !q || `${e.name} ${e.id}`.toLowerCase().includes(q));

  const rows: Row[] = [];
  const items: ModelEntry[] = [];
  for (const g of GROUPS) {
    const es = filtered.filter(g.match);
    if (!es.length) continue;
    rows.push({ header: g.label });
    for (const e of es) {
      rows.push({ entry: e, itemIndex: items.length });
      items.push(e);
    }
  }
  const selClamped = Math.max(0, Math.min(sel, items.length - 1));

  useInput((input, key) => {
    if (key.escape) return onClose();
    if (key.return) {
      const chosen = items[selClamped];
      if (chosen) onSelect(chosen.id);
      return;
    }
    if (key.upArrow) return setSel((s) => Math.max(0, Math.min(s, items.length - 1) - 1));
    if (key.downArrow) return setSel((s) => Math.min(items.length - 1, s + 1));
    if (key.backspace || key.delete) {
      setQuery((v) => v.slice(0, -1));
      setSel(0);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((v) => v + input);
      setSel(0);
    }
  });

  // Scroll a window over the (grouped) rows, keeping the selected item visible.
  const selRow = rows.findIndex((r) => "entry" in r && r.itemIndex === selClamped);
  const start = Math.max(0, Math.min(selRow - Math.floor(MAX_VISIBLE / 2), rows.length - MAX_VISIBLE));
  const visible = rows.slice(Math.max(0, start), Math.max(0, start) + MAX_VISIBLE);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={1} marginTop={1}>
      <Text>
        <Text color={theme.accent} bold>
          Select a model
        </Text>
        <Text color={theme.muted}>{`   ${items.length} available`}</Text>
      </Text>
      <Box>
        <Text color={theme.muted}>{"🔍 "}</Text>
        <Text color={theme.assistant}>{query}</Text>
        <Text inverse> </Text>
        {query ? null : <Text color={theme.border}>type to filter…</Text>}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {visible.map((r, i) => {
          if ("header" in r) {
            return (
              <Text key={`h${i}`} color={theme.tool} bold>
                {r.header}
              </Text>
            );
          }
          const e = r.entry;
          const active = r.itemIndex === selClamped;
          const ok = ready(e);
          const badges = [
            e.free ? "free" : "",
            e.local ? "local" : "",
            e.vision ? "vision" : "",
            e.provider === "termexplorer" ? "study" : "",
            e.contextK ? `${e.contextK}k` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          if (active) {
            // Full-width accent bar on the selected row.
            const dot = ok ? "●" : "○";
            const line = `❯ ${dot} ${e.name}${badges ? `   ${badges}` : ""}${e.id === current ? "  ✓" : ""}`;
            return (
              <Text key={`i${i}`} backgroundColor={theme.accent} color="#0b0b0d" bold>
                {` ${line}`.padEnd(BAR_WIDTH)}
              </Text>
            );
          }
          return (
            <Text key={`i${i}`}>
              <Text color={theme.border}>{"  "}</Text>
              <Text color={ok ? theme.success : theme.running}>{ok ? "● " : "○ "}</Text>
              <Text color={theme.assistant}>{e.name}</Text>
              {badges ? <Text color={theme.muted}>{`   ${badges}`}</Text> : null}
              {e.id === current ? <Text color={theme.accent}>{"  ✓"}</Text> : null}
            </Text>
          );
        })}
        {items.length === 0 ? (
          <Text color={theme.muted}>{entries.length === 0 ? "  Loading models…" : "  (no matches)"}</Text>
        ) : null}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.border}>↑↓ move · type to filter · enter select · esc cancel · </Text>
        <Text color={theme.success}>●</Text>
        <Text color={theme.border}> ready </Text>
        <Text color={theme.running}>○</Text>
        <Text color={theme.border}> needs a key</Text>
      </Box>
    </Box>
  );
}
