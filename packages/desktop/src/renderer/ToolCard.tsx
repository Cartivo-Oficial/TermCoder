import { useEffect, useState } from "react";
import { useI18n } from "./i18n";

const isDiff = (t: string) => /^[+-] /m.test(t);

export function DiffBlock({ text }: { text: string }) {
  return (
    <pre className="diff">
      {text.split("\n").map((line, i) => (
        <div key={i} className={line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "ctx"}>
          {line}
        </div>
      ))}
    </pre>
  );
}

export interface DiffComment {
  id: string;
  key: string;
  text: string;
}

interface DiffLineInfo {
  type: "add" | "del" | "ctx";
  text: string;
  key: string;
}

interface DiffHunk {
  file: string;
  header: string;
  lines: DiffLineInfo[];
}

export function parseDiffHunks(content: string, fallbackFile: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let file = fallbackFile;
  let current: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;
  for (const line of content.split("\n")) {
    const fileMatch = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (fileMatch) {
      file = fileMatch[2] || fileMatch[1] || fallbackFile;
      current = null;
      continue;
    }
    const plusMatch = /^\+\+\+ b\/(.+)$/.exec(line);
    if (plusMatch) {
      file = plusMatch[1] || file;
      continue;
    }
    const hunkMatch = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1]!, 10);
      newLine = parseInt(hunkMatch[2]!, 10);
      current = { file, header: line, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.lines.push({ type: "add", text: line, key: `${file}::${newLine}` });
      newLine++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      current.lines.push({ type: "del", text: line, key: `${file}::old${oldLine}` });
      oldLine++;
    } else {
      current.lines.push({ type: "ctx", text: line || " ", key: `${file}::${newLine}` });
      oldLine++;
      newLine++;
    }
  }
  return hunks;
}

export function DiffBody({
  content,
  path,
  comments = [],
  onAddComment,
  onRemoveComment,
  hunkIndex,
  onHunkCount,
}: {
  content: string;
  path?: string;
  comments?: DiffComment[];
  onAddComment?: (key: string, text: string) => void;
  onRemoveComment?: (id: string) => void;
  hunkIndex?: number;
  onHunkCount?: (n: number) => void;
}) {
  const { t } = useI18n();
  const hunks = parseDiffHunks(content, path ?? "");
  const [composerKey, setComposerKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    onHunkCount?.(hunks.length);
  }, [hunks.length]);

  useEffect(() => {
    if (hunkIndex === undefined) return;
    document.getElementById(`hunk-${hunkIndex}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [hunkIndex]);

  function submitComment(key: string) {
    const text = draft.trim();
    if (text) onAddComment?.(key, text);
    setComposerKey(null);
    setDraft("");
  }

  let lastFile = "";
  return (
    <div className="viewer-body diff diff-review">
      {hunks.map((h, hi) => (
        <div key={hi}>
          {hunks.length > 1 && h.file !== lastFile ? (
            (() => {
              lastFile = h.file;
              return <div className="diff-file-header">{h.file}</div>;
            })()
          ) : null}
          <div className="diff-hunk" id={`hunk-${hi}`}>
            <div className="diff-hunk-head">{h.header}</div>
            {h.lines.map((l, li) => {
              const lineComments = comments.filter((c) => c.key === l.key);
              return (
                <div key={li}>
                  <div className={`diff-line ${l.type}`}>
                    <button
                      type="button"
                      className="diff-gutter"
                      title={t("review.addComment")}
                      onClick={() => {
                        setComposerKey(l.key);
                        setDraft("");
                      }}
                    >
                      +
                    </button>
                    {l.text}
                  </div>
                  {lineComments.map((c) => (
                    <div className="diff-comment" key={c.id}>
                      <span className="diff-comment-text">{c.text}</span>
                      <button
                        className="diff-comment-x"
                        title={t("review.removeComment")}
                        onClick={() => onRemoveComment?.(c.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {composerKey === l.key ? (
                    <div className="diff-composer">
                      <input
                        autoFocus
                        className="settings-input"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitComment(l.key);
                          else if (e.key === "Escape") {
                            setComposerKey(null);
                            setDraft("");
                          }
                        }}
                      />
                      <button className="settings-btn sm" onClick={() => submitComment(l.key)}>
                        {t("review.comment")}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToolCard({
  name,
  text,
  status,
  detail,
  defaultOpen,
}: {
  name?: string;
  text?: string;
  status?: "running" | "done" | "error";
  detail?: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const mark = status === "error" ? "✗" : status === "done" ? "✓" : "•";
  return (
    <div className={`tool-card ${status ?? "running"}`}>
      <button className="tool-card-head" onClick={() => detail && setOpen((v) => !v)} disabled={!detail}>
        <span className={`status ${status ?? "running"}`}>{mark}</span>
        <span className="toolname">{name}</span>
        {text ? <span className="tool-title">{text}</span> : null}
        {detail ? <span className="tool-caret">{open ? "▾" : "▸"}</span> : null}
      </button>
      {detail && open ? (isDiff(detail) ? <DiffBlock text={detail} /> : <pre className="detail">{detail}</pre>) : null}
    </div>
  );
}
