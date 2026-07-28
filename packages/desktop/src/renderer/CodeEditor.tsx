import { useEffect, useRef, useState } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { drawSelection, highlightActiveLine, keymap, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  toggleComment,
  toggleBlockComment,
  indentLess,
  indentMore,
  copyLineDown,
  copyLineUp,
  moveLineUp,
  moveLineDown,
  selectLine,
  selectParentSyntax,
  cursorDocStart,
  cursorDocEnd,
  selectAll,
} from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, indentOnInput, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { inlineCompletion } from "./copilot";
import { editorTheme } from "./editorThemes";
import { highlightSelectionMatches, search, openSearchPanel, setSearchQuery, searchKeymap, SearchQuery } from "@codemirror/search";
import { LSPManager, type LSPCompletion, useLSP } from "./LSPManager";

const lineColEffect = StateEffect.define<{ line: number; col: number; totalLines: number; selChars: number }>();
export const cursorPosField = StateField.define<{ line: number; col: number; totalLines: number; selChars: number }>({
  create: () => ({ line: 1, col: 1, totalLines: 1, selChars: 0 }),
  update(v, tr) {
    for (const e of tr.effects) if (e.is(lineColEffect)) return e.value;
    return v;
  },
});

export function gotoLine(view: EditorView, line: number, col = 1) {
  const l = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)));
  view.dispatch({
    selection: { anchor: Math.min(l.from + col - 1, l.to) },
    effects: EditorView.scrollIntoView(Math.min(l.from + col - 1, l.to), { y: "center" }),
  });
  view.focus();
}

function langFor(name: string): Extension {
  const ext = (name.includes(".") ? name.split(".").pop() : "")?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) {
    return javascript({ typescript: ext.startsWith("ts"), jsx: ext.endsWith("x") });
  }
  if (["cs", "csharp"].includes(ext)) return javascript({ typescript: true });
  if (["cpp", "cc", "cxx", "h", "hpp"].includes(ext)) return javascript({ typescript: true });
  if (["html", "htm", "vue", "svelte", "aspx"].includes(ext)) return html();
  if (["css", "scss", "less"].includes(ext)) return css();
  if (["json", "sln", "csproj", "user", "props", "targets"].includes(ext)) return json();
  if (["xml", "xaml", "config"].includes(ext)) return html();
  if (ext === "py") return python();
  if (["md", "mdx"].includes(ext)) return markdown();
  if (["bat", "cmd", "sh", "ps1"].includes(ext)) return markdown();
  return [];
}

export type CodeEditorHandle = {
  focus: () => void;
  view: () => EditorView | null;
  find: () => void;
  replace: () => void;
  gotoLine: (ln: number, col?: number) => void;
  toggleComment: () => void;
  format: () => void;
  getCursor: () => { line: number; col: number; totalLines: number; selChars: number };
};

export function CodeEditor({
  name,
  value,
  onChange,
  onSave,
  port,
  aiSuggest,
  theme,
  wordWrap = false,
  handle,
  onCursorChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  port: number;
  aiSuggest: boolean;
  theme: string;
  wordWrap?: boolean;
  handle?: React.MutableRefObject<CodeEditorHandle | null>;
  onCursorChange?: (p: { line: number; col: number; totalLines: number; selChars: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const aiRef = useRef(aiSuggest);
  aiRef.current = aiSuggest;
  const cursorCbRef = useRef(onCursorChange);
  cursorCbRef.current = onCursorChange;
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cursorExt = EditorView.updateListener.of((u) => {
      if (u.selectionSet || u.docChanged) {
        const s = u.state.selection.main;
        const from = u.state.doc.lineAt(s.anchor);
        const to = u.state.doc.lineAt(s.head);
        const chars = Math.abs(s.to - s.from);
        const info = {
          line: from.number,
          col: s.anchor - from.from + 1,
          totalLines: u.state.doc.lines,
          selChars: chars,
        };
        u.view.dispatch({ effects: lineColEffect.of(info) });
        cursorCbRef.current?.(info);
      }
    });
    const v = new EditorView({
      parent: ref.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          foldGutter(),
          history(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          highlightSelectionMatches(),
          search({ top: true }),
          cursorPosField,
          wordWrap ? EditorView.lineWrapping : [],
          cursorExt,
          inlineCompletion(async (prefix, suffix) => {
            try {
              const res = await fetch(`http://localhost:${port}/complete`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ prefix, suffix, language: name }),
              });
              const d = (await res.json()) as { text?: string };
              return typeof d.text === "string" ? d.text : "";
            } catch {
              return "";
            }
          }, aiRef),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...searchKeymap,
            indentWithTab,
            { key: "Mod-s", preventDefault: true, run: () => { saveRef.current(); return true; } },
            { key: "Mod-/,", preventDefault: true, run: toggleComment },
            { key: "Mod-Shift-A", preventDefault: true, run: toggleBlockComment },
            { key: "Mod-[", preventDefault: true, run: indentLess },
            { key: "Mod-]", preventDefault: true, run: indentMore },
            { key: "Alt-ArrowDown", preventDefault: true, run: moveLineDown },
            { key: "Alt-ArrowUp", preventDefault: true, run: moveLineUp },
            { key: "Shift-Alt-ArrowDown", preventDefault: true, run: copyLineDown },
            { key: "Shift-Alt-ArrowUp", preventDefault: true, run: copyLineUp },
            { key: "Mod-l", preventDefault: true, run: selectLine },
            { key: "Mod-f", preventDefault: true, run: (vw) => { openSearchPanel(vw); return true; } },
            { key: "Mod-h", preventDefault: true, run: (vw) => { openSearchPanel(vw); return true; } },
            { key: "Mod-Home", preventDefault: true, run: cursorDocStart },
            { key: "Mod-End", preventDefault: true, run: cursorDocEnd },
            { key: "Mod-a", preventDefault: true, run: selectAll },
            { key: "Shift-Mod-\\", preventDefault: true, run: selectParentSyntax },
          ]),
          editorTheme(theme),
          langFor(name),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = v;
    if (handle) {
      handle.current = {
        focus: () => v.focus(),
        view: () => v,
        find: () => openSearchPanel(v),
        replace: () => {
          v.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "", replace: "" })) });
          openSearchPanel(v);
        },
        gotoLine: (ln, col) => gotoLine(v, ln, col),
        toggleComment: () => toggleComment(v),
        format: () => {
          const doc = v.state.doc.toString();
          try {
            const lines: string[] = doc.split("\n");
            let indent = 0;
            const stack: string[] = [];
            const starts = /[\{\[\(]$/;
            const ends = /^[\}\]\)]/;
            for (let i = 0; i < lines.length; i++) {
              const raw = lines[i];
              if (raw == null) continue;
              const t = raw.trim();
              if (!t) continue;
              while (ends.test(t) && stack.length > 0) {
                indent = Math.max(0, indent - 1);
                stack.pop();
                if (!/[\)\]\}][\)\]\}]*$/.test(t)) break;
              }
              lines[i] = "  ".repeat(indent) + t;
              let s = t;
              while (starts.test(s)) {
                indent++;
                stack.push(s.charAt(s.length - 1));
                s = s.slice(0, -1);
              }
            }
            const newDoc = lines.join("\n");
            if (newDoc !== doc) {
              v.dispatch({ changes: { from: 0, to: doc.length, insert: newDoc } });
            }
          } catch {}
        },
        getCursor: () => {
          const st = v.state.field(cursorPosField, false) ?? { line: 1, col: 1, totalLines: 1, selChars: 0 };
          return st;
        },
      };
    }
    v.focus();
    return () => {
      viewRef.current = null;
      if (handle) handle.current = null;
      v.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, theme, wordWrap]);

  return <div className="cm-wrap" ref={ref} />;
}

