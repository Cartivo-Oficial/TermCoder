import { describe, expect, it } from "vitest";
import type { SessionRecord } from "../storage/storage";
import { renderSessionHtml, renderSessionMarkdown } from "./share";

function sampleRecord(): SessionRecord {
  return {
    id: "abc12345",
    title: "My session",
    createdAt: Date.parse("2026-06-26T12:00:00Z"),
    updatedAt: Date.parse("2026-06-26T12:05:00Z"),
    cwd: "/work",
    model: "anthropic/claude-sonnet-4-6",
    messages: [
      { role: "user", content: "Hello <script>alert(1)</script>" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Hi! Creating a file." },
          { type: "tool-call", toolName: "write", toolCallId: "t1", input: { path: "a.ts", content: "x" } },
        ],
      },
      {
        role: "tool",
        content: [
          { type: "tool-result", toolName: "write", toolCallId: "t1", output: { type: "text", value: "Created a.ts" } },
        ],
      },
      { role: "assistant", content: "Done." },
    ] as unknown as SessionRecord["messages"],
  };
}

describe("renderSessionMarkdown", () => {
  it("renders user, assistant, tool-call and tool-result segments", () => {
    const md = renderSessionMarkdown(sampleRecord());
    expect(md).toContain("# My session");
    expect(md).toContain("anthropic/claude-sonnet-4-6");
    expect(md).toContain("Hello <script>alert(1)</script>"); // markdown is not HTML-escaped
    expect(md).toContain("Hi! Creating a file.");
    expect(md).toContain("→ write");
    expect(md).toContain('"path": "a.ts"');
    expect(md).toContain("🔧 Tool · write");
    expect(md).toContain("Created a.ts");
    expect(md).toContain("Done.");
  });
});

describe("renderSessionHtml", () => {
  it("produces a self-contained document and escapes HTML", () => {
    const html = renderSessionHtml(sampleRecord());
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>My session · termcoder</title>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;"); // escaped
    expect(html).not.toContain("<script>alert(1)</script>"); // never raw
    expect(html).toContain("Created a.ts");
  });
});
