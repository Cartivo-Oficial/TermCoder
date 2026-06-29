import { z } from "zod";
import { defineTool } from "./types";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function decodeRedirect(href: string): string {
  const m = /[?&]uddg=([^&]+)/.exec(href);
  if (m) return decodeURIComponent(m[1]!);
  if (href.startsWith("//")) return `https:${href}`;
  return href;
}

/** Parse DuckDuckGo's HTML results page into structured results. */
export function parseDuckDuckGo(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const snippets: string[] = [];

  const snippetRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html)) !== null) snippets.push(stripTags(sm[1]!));

  const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = linkRe.exec(html)) !== null) {
    results.push({
      title: stripTags(m[2]!),
      url: decodeRedirect(m[1]!),
      snippet: snippets[i] ?? "",
    });
    i++;
  }
  return results;
}

export const websearchTool = defineTool({
  name: "websearch",
  description:
    "Search the web (DuckDuckGo) and return the top results with titles, snippets, and URLs. " +
    "Follow up with webfetch to read a result in full.",
  inputSchema: z.object({
    query: z.string().describe("The search query."),
  }),
  readOnly: true,
  async run(args) {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`,
      { headers: { "user-agent": "Mozilla/5.0 (compatible; termcoder/0.1)" } },
    );
    if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
    const results = parseDuckDuckGo(await res.text()).slice(0, 8);
    if (results.length === 0) return { output: "No results found (or the search was blocked)." };
    return {
      output: results
        .map((r, idx) => `${idx + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`)
        .join("\n\n"),
      meta: { count: results.length },
    };
  },
});
