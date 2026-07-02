import { useEffect, useRef, useState } from "react";
import { Text, useInput } from "ink";
import type { Theme } from "../theme";

/** Routes menu navigation to whoever owns the open dropdown (command/mention). */
export interface MenuControl {
  open: boolean;
  onMove: (delta: number) => void;
  onAccept: () => void;
  onClose: () => void;
}

interface MultilineInputProps {
  theme: Theme;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  focus: boolean;
  placeholder?: string;
  /** ↑/↓ at the top/bottom line browse input history. */
  onHistory?: (dir: "up" | "down") => void;
  /** When a dropdown is open, arrows/tab/enter drive it instead of the text. */
  menu?: MenuControl;
}

function posOf(value: string, index: number): { line: number; col: number } {
  let line = 0;
  let start = 0;
  for (let i = 0; i < index; i++) {
    if (value[i] === "\n") {
      line++;
      start = i + 1;
    }
  }
  return { line, col: index - start };
}

function prevWord(value: string, cursor: number): number {
  let i = cursor;
  while (i > 0 && /\s/.test(value[i - 1]!)) i--;
  while (i > 0 && !/\s/.test(value[i - 1]!)) i--;
  return i;
}

function nextWord(value: string, cursor: number): number {
  const n = value.length;
  let i = cursor;
  while (i < n && /\s/.test(value[i]!)) i++;
  while (i < n && !/\s/.test(value[i]!)) i++;
  return i;
}

function indexAt(value: string, line: number, col: number): number {
  const lines = value.split("\n");
  let idx = 0;
  for (let i = 0; i < line; i++) idx += (lines[i]?.length ?? 0) + 1;
  return idx + Math.min(col, lines[line]?.length ?? 0);
}

/**
 * A controlled multi-line text input. Enter submits; end a line with `\` to
 * insert a newline instead. Supports cursor movement, home/end (ctrl+a/e),
 * kill-to-start (ctrl+u), and paste (multi-char input, including newlines).
 * History and dropdown navigation are delegated to the parent via props.
 */
export function MultilineInput({
  theme,
  value,
  onChange,
  onSubmit,
  focus,
  placeholder,
  onHistory,
  menu,
}: MultilineInputProps) {
  const [cursor, setCursor] = useState(value.length);
  const lastValue = useRef(value);

  // When the value changes from outside (history recall, menu completion),
  // snap the cursor to the end.
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setCursor(value.length);
    }
  }, [value]);

  const edit = (next: string, nextCursor: number) => {
    lastValue.current = next;
    setCursor(nextCursor);
    onChange(next);
  };

  useInput(
    (input, key) => {
      if (menu?.open) {
        if (key.upArrow) return void menu.onMove(-1);
        if (key.downArrow) return void menu.onMove(1);
        if (key.tab || key.return) return void menu.onAccept();
        if (key.escape) return void menu.onClose();
        // other keys fall through so typing keeps refining the query
      }

      if (key.return) {
        if (value[cursor - 1] === "\\") {
          // `\` + Enter → newline (drop the backslash).
          edit(value.slice(0, cursor - 1) + "\n" + value.slice(cursor), cursor);
        } else {
          onSubmit(value);
        }
        return;
      }
      if (key.leftArrow && (key.ctrl || key.meta)) return setCursor(prevWord(value, cursor));
      if (key.rightArrow && (key.ctrl || key.meta)) return setCursor(nextWord(value, cursor));
      if (key.leftArrow) return setCursor((c) => Math.max(0, c - 1));
      if (key.rightArrow) return setCursor((c) => Math.min(value.length, c + 1));
      if (key.upArrow) {
        const { line, col } = posOf(value, cursor);
        if (line > 0) return setCursor(indexAt(value, line - 1, col));
        return void onHistory?.("up");
      }
      if (key.downArrow) {
        const { line, col } = posOf(value, cursor);
        if (line < value.split("\n").length - 1) return setCursor(indexAt(value, line + 1, col));
        return void onHistory?.("down");
      }
      if (key.backspace || key.delete) {
        if (cursor > 0) edit(value.slice(0, cursor - 1) + value.slice(cursor), cursor - 1);
        return;
      }
      if (key.ctrl && input === "a") return setCursor(0);
      if (key.ctrl && input === "e") return setCursor(value.length);
      if (key.ctrl && input === "u") return edit(value.slice(cursor), 0);
      if (key.ctrl || key.meta) return; // ignore other control chords

      if (input) {
        edit(value.slice(0, cursor) + input + value.slice(cursor), cursor + input.length);
      }
    },
    { isActive: focus },
  );

  if (value.length === 0) {
    return (
      <Text>
        <Text color={theme.accent}>{"❯ "}</Text>
        <Text inverse> </Text>
        {placeholder ? <Text color={theme.muted}>{placeholder}</Text> : null}
      </Text>
    );
  }

  const { line: cl, col: cc } = posOf(value, cursor);
  const lines = value.split("\n");

  // Scroll a window over long input, keeping the cursor line in view.
  const MAX_LINES = 10;
  const total = lines.length;
  const start =
    total > MAX_LINES
      ? Math.min(Math.max(0, cl - Math.floor(MAX_LINES / 2)), total - MAX_LINES)
      : 0;
  const visible = lines.slice(start, start + MAX_LINES);
  const hiddenAbove = start;
  const hiddenBelow = total - (start + visible.length);

  return (
    <>
      {hiddenAbove > 0 ? <Text color={theme.muted}>{`  ↑ ${hiddenAbove} more line${hiddenAbove > 1 ? "s" : ""}`}</Text> : null}
      {visible.map((ln, idx) => {
        const i = start + idx;
        return (
          <Text key={i}>
            <Text color={theme.accent}>{i === 0 ? "❯ " : "  "}</Text>
            {renderLine(ln, i === cl && focus ? cc : -1)}
          </Text>
        );
      })}
      {hiddenBelow > 0 ? <Text color={theme.muted}>{`  ↓ ${hiddenBelow} more line${hiddenBelow > 1 ? "s" : ""}`}</Text> : null}
    </>
  );
}

/** Render a line, drawing an inverse-video block at the cursor column. */
function renderLine(line: string, cursorCol: number) {
  if (cursorCol < 0) return <Text>{line}</Text>;
  const before = line.slice(0, cursorCol);
  const at = line[cursorCol] ?? " ";
  const after = line.slice(cursorCol + 1);
  return (
    <Text>
      {before}
      <Text inverse>{at}</Text>
      {after}
    </Text>
  );
}
