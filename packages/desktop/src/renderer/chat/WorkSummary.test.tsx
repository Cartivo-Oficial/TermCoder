import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkSummary } from "./WorkSummary";
import type { TurnSummary } from "./summary";

const LABELS = { passed: "passed", failed: "failed" };

const css = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");

const rule = (selector: string): string => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return "";
  return css.slice(at, css.indexOf("}", at));
};

const summary = (over: Partial<TurnSummary> = {}): TurnSummary => ({
  files: [],
  added: 0,
  removed: 0,
  checks: [],
  didWork: false,
  ...over,
});

const withFiles = summary({
  files: [
    { path: "packages/desktop/src/renderer/App.tsx", added: 531, removed: 149 },
    { path: "packages/core/src/agent.ts", added: 12, removed: 3 },
  ],
  added: 543,
  removed: 152,
  didWork: true,
});

const bare = (html: string) => html.replace(/\s(?:class|style|data-[a-z-]+)="[^"]*"/g, "");

describe("the work summary card", () => {
  it("renders nothing when the turn did no work", () => {
    expect(renderToStaticMarkup(<WorkSummary labels={LABELS} summary={summary()} seconds={4} />)).toBe("");
  });

  it("renders nothing when a turn with a stray count still did no work", () => {
    const s = summary({ added: 9, removed: 2 });
    expect(renderToStaticMarkup(<WorkSummary labels={LABELS} summary={s} seconds={4} />)).toBe("");
  });

  it("opens with the totals for the whole turn", () => {
    const html = renderToStaticMarkup(<WorkSummary labels={LABELS} summary={withFiles} seconds={12} />);
    expect(html).toContain("+543");
    expect(html).toContain("−152");
  });

  it("shows every file it touched, with that file's own counts", () => {
    const html = renderToStaticMarkup(<WorkSummary labels={LABELS} summary={withFiles} seconds={12} />);
    expect(html).toContain("App.tsx");
    expect(html).toContain("packages/desktop/src/renderer/");
    expect(html).toContain("agent.ts");
    expect(html).toContain("+531");
    expect(html).toContain("−149");
    expect(html).toContain("+12");
    expect(html).toContain("−3");
  });

  it("shows the elapsed time it was handed", () => {
    expect(renderToStaticMarkup(<WorkSummary labels={LABELS} summary={withFiles} seconds={12} />)).toContain("12s");
    expect(renderToStaticMarkup(<WorkSummary labels={LABELS} summary={withFiles} seconds={125} />)).toContain(
      "2m 05s",
    );
  });

  it("leaves the time out rather than inventing a zero when no clock ran", () => {
    const html = renderToStaticMarkup(<WorkSummary labels={LABELS} summary={withFiles} />);
    expect(html).not.toContain("ws-time");
    expect(html).not.toContain("0s");
  });

  it("tells a failed check from a passed one without any colour", () => {
    const s = summary({
      checks: [
        { command: "pnpm typecheck", ok: true },
        { command: "pnpm test", ok: false },
      ],
      didWork: true,
    });
    const html = bare(renderToStaticMarkup(<WorkSummary labels={LABELS} summary={s} seconds={3} />));
    expect(html).toContain("passed");
    expect(html).toContain("failed");
    expect(html).toContain("pnpm typecheck");
    expect(html).toContain("pnpm test");
  });

  it("names the outcome for a screen reader and hides the bare glyph", () => {
    const s = summary({ checks: [{ command: "pnpm test", ok: false }], didWork: true });
    const html = renderToStaticMarkup(<WorkSummary labels={LABELS} summary={s} seconds={3} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("✗");
  });

  it("drops the totals when the turn ran checks and touched no file", () => {
    const s = summary({ checks: [{ command: "pnpm build", ok: true }], didWork: true });
    const html = renderToStaticMarkup(<WorkSummary labels={LABELS} summary={s} seconds={3} />);
    expect(html).not.toContain("u-panel-head");
    expect(html).toContain("pnpm build");
  });

  it("keeps the whole path reachable when the row has to truncate it", () => {
    const long = "packages/desktop/src/renderer/canvas/AgentCanvasInspectorPanel.tsx";
    const s = summary({
      files: [{ path: long, added: 1, removed: 0 }],
      added: 1,
      removed: 0,
      didWork: true,
    });
    const html = renderToStaticMarkup(<WorkSummary labels={LABELS} summary={s} seconds={1} />);
    expect(html).toContain(`title="${long}"`);
    expect(html).toContain("AgentCanvasInspectorPanel.tsx");
  });

  it("keeps a long command reachable too", () => {
    const long = "pnpm --filter @termcoder/desktop exec vitest run packages/desktop/src/renderer";
    const s = summary({ checks: [{ command: long, ok: true }], didWork: true });
    expect(renderToStaticMarkup(<WorkSummary labels={LABELS} summary={s} seconds={1} />)).toContain(
      `title="${long}"`,
    );
  });

  it("is built on the shared panel primitive", () => {
    const html = renderToStaticMarkup(<WorkSummary labels={LABELS} summary={withFiles} seconds={1} />);
    expect(html).toContain("u-panel");
    expect(html).toContain("u-panel-body");
    expect(html).toContain("work-summary");
  });
});

describe("the card's width holds", () => {
  it("ellipsises the directory part of a path rather than growing the card", () => {
    expect(rule(".ws-dir")).toContain("text-overflow: ellipsis");
    expect(rule(".ws-dir")).toContain("min-width: 0");
  });

  it("ellipsises a long command", () => {
    expect(rule(".ws-cmd")).toContain("text-overflow: ellipsis");
    expect(rule(".ws-cmd")).toContain("min-width: 0");
  });
});
