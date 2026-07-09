import { z } from "zod";
import { defineTool } from "./types";

const MAX_CHARS = 8000;

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const webfetchTool = defineTool({
  name: "webfetch",
  description:
    "Fetch a URL and return its readable text content. Use to read documentation or web pages.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to fetch (http or https)."),
  }),
  readOnly: true,
  async run(args) {
    const res = await fetch(args.url, { headers: { "user-agent": "termcoder/0.1" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    const text = contentType.includes("html") ? htmlToText(body) : body;
    return {
      output: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n…(truncated)` : text,
      meta: { url: args.url, contentType },
    };
  },
});
