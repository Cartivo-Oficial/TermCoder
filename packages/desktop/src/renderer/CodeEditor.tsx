import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";
import { inlineCompletion } from "./copilot";
import { editorTheme } from "./editorThemes";
import type { ReviewMark } from "./review/decorations";

const setReviewMarks = StateEffect.define<ReviewMark[]>();

const reviewField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setReviewMarks)) {
        const builder = new RangeSetBuilder<Decoration>();
        const total = tr.state.doc.lines;
        for (const m of e.value) {
          if (m.line < 1 || m.line > total) continue;
          const line = tr.state.doc.line(m.line);
          builder.add(
            line.from,
            line.from,
            Decoration.line({ class: m.kind === "add" ? "cm-review-add" : "cm-review-remove" }),
          );
        }
        return builder.finish();
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function langFor(name: string): Extension {
  const ext = (name.includes(".") ? name.split(".").pop() : "")?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) {
    return javascript({ typescript: ext.startsWith("ts"), jsx: ext.endsWith("x") });
  }
  if (["html", "htm", "vue", "svelte"].includes(ext)) return html();
  if (["css", "scss", "less"].includes(ext)) return css();
  if (ext === "json") return json();
  if (ext === "py") return python();
  if (["md", "mdx"].includes(ext)) return markdown();
  return [];
}

export function CodeEditor({
  name,
  value,
  onChange,
  onSave,
  port,
  aiSuggest,
  theme,
  marks,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  port: number;
  aiSuggest: boolean;
  theme: string;
  marks?: ReviewMark[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const aiRef = useRef(aiSuggest);
  aiRef.current = aiSuggest;

  useEffect(() => {
    if (!ref.current) return;
    const view = new EditorView({
      parent: ref.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
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
            indentWithTab,
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                saveRef.current();
                return true;
              },
            },
          ]),
          editorTheme(theme),
          langFor(name),
          reviewField,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    view.focus();
    return () => {
      viewRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, theme]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setReviewMarks.of(marks ?? []) });
  }, [marks]);

  return <div className="cm-wrap" ref={ref} />;
}
