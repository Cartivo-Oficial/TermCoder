import { z } from "zod";
import { assertFetchAllowed } from "../util/net";
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
  permissionKind: "network",
  target(args) {
    return args.url;
  },
  describe(args) {
    return { title: `Fetch ${args.url}` };
  },
  async run(args) {
    let url = args.url;
    let res: Response;
    for (let hop = 0; ; hop++) {
      await assertFetchAllowed(url);
      res = await fetch(url, { headers: { "user-agent": "termcoder/0.1" }, redirect: "manual" });
      if (res.status < 300 || res.status >= 400) break;
      const location = res.headers.get("location");
      if (!location) break;
      if (hop >= 5) throw new Error("Too many redirects.");
      url = new URL(location, url).toString();
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    const text = contentType.includes("html") ? htmlToText(body) : body;
    return {
      output: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n…(truncated)` : text,
      meta: { url, contentType },
    };
  },
});
