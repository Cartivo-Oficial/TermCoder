import { describe, expect, it } from "vitest";
import { htmlToText } from "./webfetch";
import { parseDuckDuckGo } from "./websearch";

describe("htmlToText", () => {
  it("strips tags, scripts, and decodes entities", () => {
    const html = "<p>Hello &amp; <b>world</b></p><script>evil()</script>";
    const text = htmlToText(html);
    expect(text).toContain("Hello & world");
    expect(text).not.toContain("evil");
    expect(text).not.toContain("<");
  });
});

describe("parseDuckDuckGo", () => {
  it("extracts titles, decoded urls, and snippets", () => {
    const html = `
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgo.dev%2Fdoc">The Go Docs</a>
        <a class="result__snippet">Go is an open source programming language.</a>
      </div>
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgo.dev%2Ftour">A Tour of Go</a>
        <a class="result__snippet">Interactive introduction to Go.</a>
      </div>`;
    const results = parseDuckDuckGo(html);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: "The Go Docs",
      url: "https://go.dev/doc",
      snippet: "Go is an open source programming language.",
    });
    expect(results[1]?.url).toBe("https://go.dev/tour");
  });

  it("returns empty for a page with no results", () => {
    expect(parseDuckDuckGo("<html>nothing</html>")).toEqual([]);
  });
});
