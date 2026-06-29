import type { ReactNode } from "react";
import { Text } from "ink";
import type { Theme } from "../theme";

type TokenType = "string" | "comment" | "number" | "keyword" | "text";

const KEYWORDS = new Set([
  "function", "func", "def", "fn", "return", "const", "let", "var", "val",
  "if", "else", "elif", "for", "while", "foreach", "loop", "in", "of",
  "import", "from", "export", "use", "require", "module", "package",
  "class", "struct", "interface", "type", "enum", "trait", "impl",
  "public", "private", "protected", "static", "final", "abstract",
  "new", "delete", "await", "async", "yield", "try", "catch", "finally",
  "throw", "throws", "switch", "case", "match", "break", "continue", "do",
  "with", "as", "is", "and", "or", "not", "null", "nil", "none", "undefined",
  "true", "false", "this", "self", "super", "extends", "implements",
  "void", "int", "string", "bool", "float", "double", "char", "byte",
  "go", "defer", "chan", "map", "range", "select", "lambda", "pub", "mut",
]);

/** Split one line of code into typed tokens (language-agnostic, best effort). */
function tokenize(line: string): Array<{ type: TokenType; text: string }> {
  const tokens: Array<{ type: TokenType; text: string }> = [];
  const n = line.length;
  let i = 0;

  while (i < n) {
    const ch = line[i]!;

    if (ch === "/" && line[i + 1] === "/") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }
    if (ch === "#") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }
    if (ch === "/" && line[i + 1] === "*") {
      const end = line.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      tokens.push({ type: "comment", text: line.slice(i, stop) });
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && line[j] !== ch) {
        if (line[j] === "\\") j++;
        j++;
      }
      j = Math.min(j + 1, n);
      tokens.push({ type: "string", text: line.slice(i, j) });
      i = j;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < n && /[0-9._xa-fA-F]/.test(line[j]!)) j++;
      tokens.push({ type: "number", text: line.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(line[j]!)) j++;
      const word = line.slice(i, j);
      tokens.push({ type: KEYWORDS.has(word) ? "keyword" : "text", text: word });
      i = j;
      continue;
    }
    tokens.push({ type: "text", text: ch });
    i++;
  }

  return tokens;
}

/** Render a line of code as colored Ink spans. */
export function highlightCode(line: string, theme: Theme): ReactNode[] {
  return tokenize(line).map((token, k) => {
    const color =
      token.type === "string"
        ? theme.user
        : token.type === "comment"
          ? theme.muted
          : token.type === "number"
            ? theme.code
            : token.type === "keyword"
              ? theme.accent
              : theme.assistant;
    return (
      <Text key={k} color={color}>
        {token.text}
      </Text>
    );
  });
}
