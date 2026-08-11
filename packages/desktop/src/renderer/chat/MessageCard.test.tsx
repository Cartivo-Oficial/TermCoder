import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMessage, UserMessage } from "./MessageCard";

const css = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");

const rule = (selector: string): string => {
  const at = css.indexOf(`\n${selector} {`);
  if (at < 0) return "";
  return css.slice(at + 1, css.indexOf("}", at));
};

describe("the user's message", () => {
  it("is a panel carrying its own layout class", () => {
    const html = renderToStaticMarkup(<UserMessage text="rewrite the transcript" />);
    expect(html).toContain("u-panel");
    expect(html).toContain("u-panel-body");
    expect(html).toContain("bubble user");
    expect(html).toContain("rewrite the transcript");
  });

  it("has no head, because nothing needs to name the person typing", () => {
    expect(renderToStaticMarkup(<UserMessage text="hi" />)).not.toContain("u-panel-head");
  });

  it("keeps the attachments and their alt text", () => {
    const html = renderToStaticMarkup(<UserMessage text="look" images={["data:image/png;base64,aa"]} />);
    expect(html).toContain("msg-images");
    expect(html).toContain('alt="attachment"');
    expect(html).toContain('src="data:image/png;base64,aa"');
  });

  it("renders no image strip when there is nothing attached", () => {
    expect(renderToStaticMarkup(<UserMessage text="hi" images={[]} />)).not.toContain("msg-images");
    expect(renderToStaticMarkup(<UserMessage text="hi" />)).not.toContain("msg-images");
  });
});

describe("the assistant's message", () => {
  it("opens on the answer, with no line spent naming the speaker", () => {
    const html = renderToStaticMarkup(<AssistantMessage>answer</AssistantMessage>);
    expect(html).not.toContain("u-panel-head");
    expect(html).not.toContain("msg-meta");
    expect(html).not.toContain("msg-spine");
    expect(html).not.toContain("TERMCODER");
    expect(html).not.toContain("termcoder");
  });

  it("keeps the body class the markdown styling hangs off", () => {
    const html = renderToStaticMarkup(<AssistantMessage className="markdown">answer</AssistantMessage>);
    expect(html).toContain("bubble assistant markdown");
  });

  it("keeps the streaming class while the reply is still arriving", () => {
    const html = renderToStaticMarkup(<AssistantMessage className="streaming">half an ans</AssistantMessage>);
    expect(html).toContain("bubble assistant streaming");
  });

  it("keeps the copy control a real button with its title", () => {
    const html = renderToStaticMarkup(
      <AssistantMessage copyLabel="Copy" copyIcon={<svg />} onCopy={() => {}}>
        answer
      </AssistantMessage>,
    );
    expect(html).toContain("<button");
    expect(html).toContain("msg-copy");
    expect(html).toContain('title="Copy"');
  });

  it("re-anchors the copy control into the foot, after the reply", () => {
    const html = renderToStaticMarkup(
      <AssistantMessage copyLabel="Copy" copyIcon={<svg />} onCopy={() => {}} stamp="14:02 · 12s">
        answer
      </AssistantMessage>,
    );
    expect(html).toContain("msg-foot");
    expect(html.indexOf("msg-foot")).toBeGreaterThan(html.indexOf("answer"));
    expect(html.indexOf("msg-copy")).toBeGreaterThan(html.indexOf("msg-foot"));
  });

  it("sits the timestamp and the copy control on the same closing line", () => {
    const html = renderToStaticMarkup(
      <AssistantMessage copyLabel="Copy" copyIcon={<svg />} onCopy={() => {}} stamp="14:02 · 12s">
        answer
      </AssistantMessage>,
    );
    expect(html.match(/msg-foot/g)).toHaveLength(1);
    expect(html.indexOf("msg-stamp")).toBeGreaterThan(html.indexOf("msg-foot"));
    expect(html).toContain("14:02 · 12s");
  });

  it("grows no foot when there is neither a stamp nor a copy control", () => {
    expect(renderToStaticMarkup(<AssistantMessage>answer</AssistantMessage>)).not.toContain("msg-foot");
  });

  it("still shows the stamp when the reply cannot be copied", () => {
    const html = renderToStaticMarkup(<AssistantMessage stamp="14:02 · 12s">answer</AssistantMessage>);
    expect(html).toContain("msg-foot");
    expect(html).toContain("14:02 · 12s");
    expect(html).not.toContain("msg-copy");
  });

  it("has no copy control while the reply is still streaming", () => {
    const html = renderToStaticMarkup(<AssistantMessage className="streaming">half an ans</AssistantMessage>);
    expect(html).not.toContain("msg-copy");
  });

  it("is the same panel primitive the user's message and the tool card are", () => {
    const html = renderToStaticMarkup(<AssistantMessage>answer</AssistantMessage>);
    expect(html).toContain("u-panel");
    expect(html).toContain("u-panel-body");
    expect(html).toContain("assistant-wrap");
  });
});

describe("controls that hide until hover stay reachable by keyboard", () => {
  it("forces the copy button visible on focus, not only on hover", () => {
    const focus = rule(".msg-copy:focus-visible");
    expect(focus).toContain("opacity: 1");
    expect(focus).toContain("var(--ring)");
  });

  it("forces the diff comment gutter visible on focus, not only on hover", () => {
    const focus = rule(".diff-gutter:focus-visible");
    expect(focus).toContain("opacity: 1");
    expect(focus).toContain("var(--ring)");
  });

  it("keeps the copy button in the flow of the card's foot, where overflow cannot clip it", () => {
    expect(rule(".msg-card > .u-panel-body")).toContain("position: relative");
    expect(rule(".msg-card .msg-copy")).toContain("position: static");
  });

  it("reveals the copy button on hover of the whole reply, not of the button alone", () => {
    expect(css).toContain(".assistant-wrap:hover .msg-copy { opacity: 1; }");
  });
});

describe("a turn reads as one block", () => {
  it("squares off the seam between the work summary and the reply under it", () => {
    const join = rule(".work-summary + .msg-card");
    expect(join).toContain("margin-top: calc(var(--s-2) * -1)");
    expect(join).toContain("border-top-left-radius: 0");
    expect(join).toContain("border-top-right-radius: 0");
    expect(rule(".work-summary")).toContain("border-bottom-left-radius: 0");
  });

  it("leaves no gutter under the summary", () => {
    expect(rule(".work-summary")).not.toContain("margin-bottom");
  });
});

describe("the message cards hold their width", () => {
  it("breaks a long unbroken word rather than widening the transcript", () => {
    expect(rule(".bubble")).toContain("word-break: break-word");
    expect(rule(".bubble")).toContain("max-width: 100%");
  });

  it("scrolls a wide code block inside the reply", () => {
    expect(rule(".markdown pre")).toContain("overflow-x: auto");
  });
});
