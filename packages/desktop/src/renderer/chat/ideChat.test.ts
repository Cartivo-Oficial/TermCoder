import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ide = readFileSync(fileURLToPath(new URL("../IDELayout.tsx", import.meta.url)), "utf8");
const css = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");

interface Decl { selector: string; prop: string; value: string }

function ideChatDecls(): Decl[] {
  const out: Decl[] = [];
  let selector = "";
  for (const line of css.split("\n")) {
    const open = line.indexOf("{");
    if (open > 0) selector = line.slice(0, open).trim();
    if (!selector.includes(".ide-chat-inner")) continue;
    for (const m of line.matchAll(/(?:^|[{;])\s*([a-z-]+)\s*:\s*([^;{}]*)/g)) {
      out.push({ selector, prop: m[1]!, value: m[2]! });
    }
  }
  return out;
}

const rule = (selector: string): string => {
  const at = css.indexOf(`\n${selector} {`);
  if (at < 0) return "";
  return css.slice(at + 1, css.indexOf("}", at));
};

describe("the IDE panel and the main transcript are one chat", () => {
  it("renders the reply through the shared message cards", () => {
    expect(ide).toContain('from "./chat/MessageCard"');
    expect(ide).toContain("AssistantMessage");
    expect(ide).toContain("UserMessage");
  });

  it("renders the work summary through the shared card", () => {
    expect(ide).toContain('from "./chat/WorkSummary"');
    expect(ide).toContain("<WorkSummary");
    expect(ide).toContain("turnCards(p.messages)");
  });

  it("hand-rolls no message markup of its own", () => {
    expect(ide).not.toContain("msg-meta");
    expect(ide).not.toContain("msg-spine");
    expect(ide).not.toContain("bubble assistant");
    expect(ide).not.toContain("bubble user");
  });

  it("names no speaker above the reply", () => {
    expect(ide).not.toContain(">termcoder");
  });

  it("gives the reply the same copy control and closing stamp", () => {
    expect(ide).toContain("copyIcon={<IconCopy />}");
    expect(ide).toContain("stamp={stampFor(i)}");
  });

  it("keeps the markdown pipeline inside the error boundary", () => {
    const at = ide.indexOf('className="markdown"');
    expect(at).toBeGreaterThan(-1);
    const body = ide.slice(at, ide.indexOf("</AssistantMessage>", at));
    expect(body).toContain("<ErrorBoundary");
    expect(body).toContain("remarkPlugins={[remarkGfm]}");
    expect(body).toContain("rehypeHighlight");
  });
});

describe("the narrow panel restates no type of its own", () => {
  it("sets no font size anywhere under .ide-chat-inner", () => {
    const sized = ideChatDecls().filter((d) => d.prop === "font-size");
    expect(sized.map((d) => `${d.selector} — ${d.value.trim()}`)).toEqual([]);
  });

  it("restates neither the prose rhythm nor the code size", () => {
    expect(css).not.toContain(".ide-chat-inner .bubble.assistant.markdown");
  });

  it("leaves the message gap to the shared rule, so the summary still butts onto the reply", () => {
    const gaps = ideChatDecls().filter((d) => d.selector === ".ide-chat-inner .msg" && d.prop === "gap");
    expect(gaps).toEqual([]);
  });

  it("keeps the gutter the 420px column needs", () => {
    const gutter = rule(".ide-chat-inner");
    expect(gutter).toContain("padding");
    expect(gutter).toContain("gap");
  });
});
