import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiffBlock, ToolCard } from "./ToolCard";

const css = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");

const rule = (selector: string): string => {
  const at = css.indexOf(`\n${selector} {`);
  if (at < 0) return "";
  return css.slice(at + 1, css.indexOf("}", at));
};

describe("the tool card's head", () => {
  it("is a real button, disabled when there is nothing to expand", () => {
    const html = renderToStaticMarkup(<ToolCard name="read" text="src/app.ts" defaultOpen={false} />);
    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).toContain("disabled");
    expect(html).toContain("tool-card-head");
  });

  it("stays enabled and announces that it is collapsed when there is a detail", () => {
    const html = renderToStaticMarkup(
      <ToolCard name="bash" text="pnpm test" detail="ok" defaultOpen={false} />,
    );
    expect(html).not.toContain("disabled");
    expect(html).toContain('aria-expanded="false"');
  });

  it("announces that it is expanded when it opens by default", () => {
    const html = renderToStaticMarkup(<ToolCard name="bash" text="pnpm test" detail="ok" defaultOpen />);
    expect(html).toContain('aria-expanded="true"');
  });

  it("names the tool and keeps its title reachable when the row has to truncate", () => {
    const long = "pnpm --filter @termcoder/desktop exec vitest run packages/desktop/src/renderer";
    const html = renderToStaticMarkup(<ToolCard name="bash" text={long} defaultOpen={false} />);
    expect(html).toContain("bash");
    expect(html).toContain(`title="${long}"`);
  });

  it("carries no aria-expanded at all when there is nothing to expand", () => {
    const html = renderToStaticMarkup(<ToolCard name="read" text="src/app.ts" defaultOpen />);
    expect(html).not.toContain("aria-expanded");
  });
});

describe("the tool card's status", () => {
  it("tells done, failed and running apart by glyph, not only by colour", () => {
    expect(renderToStaticMarkup(<ToolCard name="x" status="done" defaultOpen={false} />)).toContain("✓");
    expect(renderToStaticMarkup(<ToolCard name="x" status="error" defaultOpen={false} />)).toContain("✗");
    expect(renderToStaticMarkup(<ToolCard name="x" status="running" defaultOpen={false} />)).toContain("•");
  });

  it("leaves the glyph readable by assistive tech, since nothing else names the state", () => {
    const html = renderToStaticMarkup(<ToolCard name="x" status="error" defaultOpen={false} />);
    expect(html).toContain('class="status error"');
    expect(html).not.toContain('class="status error" aria-hidden');
  });

  it("carries the state on the card itself and falls back to running", () => {
    expect(renderToStaticMarkup(<ToolCard name="x" status="error" defaultOpen={false} />)).toContain(
      "tool-card error",
    );
    expect(renderToStaticMarkup(<ToolCard name="x" defaultOpen={false} />)).toContain("tool-card running");
  });
});

describe("the tool card's target", () => {
  it("shows the file it wrote, splitting the directory from the name", () => {
    const path = "packages/desktop/src/renderer/chat/MessageCard.tsx";
    const html = renderToStaticMarkup(<ToolCard name="write" text="" target={path} defaultOpen={false} />);
    expect(html).toContain(`title="${path}"`);
    expect(html).toContain("MessageCard.tsx");
    expect(html).toContain("packages/desktop/src/renderer/chat/");
  });

  it("does not repeat a path the title already names", () => {
    const path = "src/main.ts";
    const html = renderToStaticMarkup(
      <ToolCard name="write" text="write src/main.ts" target={path} defaultOpen={false} />,
    );
    expect(html).not.toContain("tool-target");
  });
});

describe("the tool card's detail", () => {
  it("is collapsed by default", () => {
    const html = renderToStaticMarkup(
      <ToolCard name="bash" text="pnpm test" detail="134 passed" defaultOpen={false} />,
    );
    expect(html).not.toContain("134 passed");
    expect(html).toContain("▸");
  });

  it("is shown when the card opens by default", () => {
    const html = renderToStaticMarkup(
      <ToolCard name="bash" text="pnpm test" detail="134 passed" defaultOpen />,
    );
    expect(html).toContain("134 passed");
    expect(html).toContain("▾");
    expect(html).toContain('class="detail"');
  });

  it("renders a patch as a diff rather than as plain output", () => {
    const html = renderToStaticMarkup(
      <ToolCard name="edit" detail={"- old line\n+ new line"} defaultOpen />,
    );
    expect(html).toContain('class="diff"');
    expect(html).toContain('class="add"');
    expect(html).toContain('class="del"');
  });
});

describe("the tool card is built on the shared primitives", () => {
  it("is a panel with a head and a body", () => {
    const html = renderToStaticMarkup(<ToolCard name="bash" text="pnpm test" detail="ok" defaultOpen />);
    expect(html).toContain("u-panel");
    expect(html).toContain("u-panel-head");
    expect(html).toContain("u-panel-body");
    expect(html).toContain("tool-card");
  });
});

describe("DiffBlock", () => {
  it("classes each line by what it does to the file", () => {
    const html = renderToStaticMarkup(<DiffBlock text={"- a\n+ b\n  c"} />);
    expect(html).toContain('class="del"');
    expect(html).toContain('class="add"');
    expect(html).toContain('class="ctx"');
  });
});

describe("the tool card holds its width and its focus ring", () => {
  it("ellipsises a long title rather than growing the card", () => {
    expect(rule(".tool-title")).toContain("text-overflow: ellipsis");
    expect(rule(".tool-title")).toContain("min-width: 0");
  });

  it("ellipsises the directory part of a long target", () => {
    expect(rule(".tool-dir")).toContain("text-overflow: ellipsis");
    expect(rule(".tool-dir")).toContain("min-width: 0");
  });

  it("scrolls a wide detail inside the card instead of past it", () => {
    expect(rule(".detail")).toContain("overflow-x: auto");
    expect(rule(".diff")).toContain("overflow-x: auto");
  });

  it("draws a focus ring on the head from the shared token", () => {
    expect(rule(".tool-card-head:focus-visible")).toContain("var(--ring)");
  });
});
