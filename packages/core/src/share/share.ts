import { randomUUID } from "node:crypto";
import type { SessionRecord } from "../storage/storage";
import { SessionStore } from "../storage/storage";
import { GitHubClient, parseGistId } from "../github/github";

/** A flattened, render-ready piece of the conversation. */
export interface TranscriptSegment {
  role: "user" | "assistant" | "tool";
  /** Tool name for tool-call/tool-result segments. */
  label?: string;
  /** True when `text` should be shown verbatim in a monospace block. */
  code?: boolean;
  text: string;
}

function outputToText(output: unknown): string {
  if (output == null) return "";
  if (typeof output === "string") return output;
  const o = output as { type?: string; value?: unknown };
  if (o.type === "text") return String(o.value ?? "");
  if (o.type === "json") return JSON.stringify(o.value, null, 2);
  if (o.type === "content" && Array.isArray(o.value)) {
    return o.value
      .map((c) => (c && typeof c === "object" && "text" in c ? String(c.text) : `[${(c as { type?: string }).type ?? "?"}]`))
      .join("\n");
  }
  return JSON.stringify(output, null, 2);
}

/** Flatten a session's messages into ordered, render-ready segments. */
export function transcriptSegments(record: SessionRecord): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const message of record.messages as Array<{ role: string; content: unknown }>) {
    const role = message.role as TranscriptSegment["role"];
    const content = message.content;

    if (typeof content === "string") {
      if (content.trim()) segments.push({ role, text: content });
      continue;
    }
    if (!Array.isArray(content)) continue;

    for (const part of content as Array<Record<string, any>>) {
      switch (part.type) {
        case "text":
          if (part.text?.trim()) segments.push({ role, text: part.text });
          break;
        case "tool-call":
          segments.push({
            role: "assistant",
            label: `→ ${part.toolName}`,
            code: true,
            text: JSON.stringify(part.input ?? {}, null, 2),
          });
          break;
        case "tool-result":
          segments.push({
            role: "tool",
            label: part.toolName,
            code: true,
            text: outputToText(part.output),
          });
          break;
        default:
          break; // reasoning, files, images, etc. are omitted from the transcript
      }
    }
  }
  return segments;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Render a session as a self-contained, shareable HTML document. */
export function renderSessionHtml(record: SessionRecord): string {
  const created = new Date(record.createdAt).toISOString();
  const blocks = transcriptSegments(record)
    .map((s) => {
      const who =
        s.role === "user" ? "You" : s.role === "assistant" ? `Assistant${s.label ? ` ${s.label}` : ""}` : `Tool · ${s.label}`;
      const body = s.code
        ? `<pre>${escapeHtml(s.text)}</pre>`
        : `<p>${escapeHtml(s.text).replace(/\n/g, "<br>")}</p>`;
      return `<div class="seg ${s.role}"><div class="who">${escapeHtml(who)}</div>${body}</div>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(record.title)} · termcoder</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.6 -apple-system, system-ui, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  .meta { color: #888; font-size: .85rem; margin-bottom: 2rem; }
  .seg { margin: 1.25rem 0; padding-left: .9rem; border-left: 3px solid #ddd; }
  .seg.user { border-color: #3aa757; }
  .seg.assistant { border-color: #a64dd0; }
  .seg.tool { border-color: #d0a64d; }
  .who { font-weight: 600; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; color: #999; margin-bottom: .35rem; }
  pre { background: rgba(127,127,127,.12); padding: .7rem .9rem; border-radius: 6px; overflow-x: auto; font-size: .85rem; }
  p { margin: .2rem 0; }
</style>
</head>
<body>
<h1>${escapeHtml(record.title)}</h1>
<div class="meta">${escapeHtml(record.model)} · ${escapeHtml(record.cwd)} · ${escapeHtml(created)}</div>
${blocks}
</body>
</html>
`;
}

/**
 * The files that make up a shared-session gist: a human-readable Markdown and
 * HTML transcript, plus the raw record JSON so it can be re-imported elsewhere.
 */
export function sessionGistFiles(record: SessionRecord): Record<string, { content: string }> {
  return {
    "termcoder-session.md": { content: renderSessionMarkdown(record) },
    "termcoder-session.html": { content: renderSessionHtml(record) },
    "termcoder-session.json": { content: JSON.stringify(record, null, 2) },
  };
}

/**
 * Import a session shared as a gist (by id or URL) into the local store. The
 * imported record gets a fresh id and an "(imported)" title so it never
 * clobbers an existing session.
 */
export async function importSessionFromGist(
  ref: string,
  client: GitHubClient,
  store: SessionStore,
): Promise<SessionRecord> {
  const gist = await client.getGist(parseGistId(ref));
  const raw = await client.gistFileContent(gist, "termcoder-session.json");
  if (!raw) {
    throw new Error("That gist has no termcoder-session.json — was it shared by termcoder?");
  }
  const record = JSON.parse(raw) as SessionRecord;
  record.id = randomUUID();
  if (!record.title?.startsWith("(imported)")) {
    record.title = `(imported) ${record.title ?? "session"}`;
  }
  store.save(record);
  return record;
}

/** Render a session as a Markdown transcript. */
export function renderSessionMarkdown(record: SessionRecord): string {
  const created = new Date(record.createdAt).toISOString();
  const lines: string[] = [
    `# ${record.title}`,
    "",
    `- **Model:** ${record.model}`,
    `- **Directory:** ${record.cwd}`,
    `- **Created:** ${created}`,
    "",
  ];

  for (const s of transcriptSegments(record)) {
    const who =
      s.role === "user" ? "🧑 You" : s.role === "assistant" ? `🤖 Assistant${s.label ? ` ${s.label}` : ""}` : `🔧 Tool · ${s.label}`;
    lines.push(`### ${who}`, "");
    lines.push(s.code ? "```\n" + s.text + "\n```" : s.text, "");
  }

  return lines.join("\n");
}
