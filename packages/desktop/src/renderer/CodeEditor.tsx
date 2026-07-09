import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
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
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  port: number;
  aiSuggest: boolean;
  theme: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.focus();
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, theme]);

  return <div className="cm-wrap" ref={ref} />;
}
