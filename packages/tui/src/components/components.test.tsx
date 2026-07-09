import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useState } from "react";
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { getTheme } from "../theme";
import type { ViewItem } from "../types";
import { Transcript } from "./Transcript";
import { PermissionModal } from "./PermissionModal";
import { TrustPrompt } from "./TrustPrompt";
import { CommandMenu } from "./CommandMenu";
import { StatusBar } from "./StatusBar";
import { CodeBlock } from "./CodeBlock";
import { MentionMenu } from "./MentionMenu";
import { MultilineInput } from "./MultilineInput";
import { Markdown } from "./Markdown";
import { DiffView } from "./DiffView";
import { ModelPicker } from "./ModelPicker";
import { ReviewMode } from "./ReviewMode";
import { matchCommands } from "../commands";
import { matchFiles } from "../files";
import { wordLines, starfield, makeStars, renderStars } from "../logo";

const theme = getTheme("default");
const tick = () => new Promise((r) => setTimeout(r, 30));

describe("Transcript", () => {
  it("renders user, assistant, and completed tool items", () => {
    const items: ViewItem[] = [
      { kind: "user", text: "create a file" },
      { kind: "assistant", text: "On it." },
      {
        kind: "tool",
        id: "t1",
        name: "write",
        title: "Create hello.txt",
        status: "done",
        output: "Created hello.txt",
      },
    ];
    const { lastFrame } = render(<Transcript theme={theme} items={items} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("create a file");
    expect(frame).toContain("On it.");
    expect(frame).toContain("write");
    expect(frame).toContain("Create hello.txt");
    expect(frame).toContain("✓");
  });

  it("shows an error item", () => {
    const { lastFrame } = render(
      <Transcript theme={theme} items={[{ kind: "error", text: "boom" }]} />,
    );
    expect(lastFrame()).toContain("boom");
  });

  it("collapses long tool output with a ▸ line count", () => {
    const output = Array.from({ length: 20 }, (_, i) => `out ${i}`).join("\n");
    const { lastFrame } = render(
      <Transcript theme={theme} items={[{ kind: "tool", id: "t", name: "bash", status: "done", output }]} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("▸ 20 lines");
    expect(frame).toContain("more lines");
    expect(frame).not.toContain("out 19"); // tail hidden
  });

  it("shows a message timestamp when present", () => {
    const { lastFrame } = render(
      <Transcript theme={theme} items={[{ kind: "user", text: "hi", time: "14:07" }]} />,
    );
    expect(lastFrame()).toContain("14:07");
  });
});

describe("PermissionModal", () => {
  it("renders the request and resolves on the 'a' key", async () => {
    const onDecision = vi.fn();
    const { stdin, lastFrame } = render(
      <PermissionModal
        theme={theme}
        request={{ toolName: "write", kind: "write", title: "Create x.ts" }}
        onDecision={onDecision}
      />,
    );
    expect(lastFrame()).toContain("Create x.ts");

    await new Promise((r) => setTimeout(r, 30));
    stdin.write("a");
    await new Promise((r) => setTimeout(r, 30));
    expect(onDecision).toHaveBeenCalledWith("allow");
  });

  it("resolves allow-always on 'A'", async () => {
    const onDecision = vi.fn();
    const { stdin } = render(
      <PermissionModal
        theme={theme}
        request={{ toolName: "bash", kind: "bash", title: "Run ls" }}
        onDecision={onDecision}
      />,
    );
    await new Promise((r) => setTimeout(r, 30));
    stdin.write("A");
    await new Promise((r) => setTimeout(r, 30));
    expect(onDecision).toHaveBeenCalledWith("allow-always");
  });
});

describe("TrustPrompt", () => {
  it("renders the folder and resolves true on 'y'", async () => {
    const onDecision = vi.fn();
    const { stdin, lastFrame } = render(
      <TrustPrompt theme={theme} cwd="/home/me/project" onDecision={onDecision} />,
    );
    expect(lastFrame()).toContain("Do you trust");
    expect(lastFrame()).toContain("/home/me/project");
    await tick();
    stdin.write("y");
    await tick();
    expect(onDecision).toHaveBeenCalledWith(true);
  });

  it("resolves false on 'n'", async () => {
    const onDecision = vi.fn();
    const { stdin } = render(<TrustPrompt theme={theme} cwd="/x" onDecision={onDecision} />);
    await tick();
    stdin.write("n");
    await tick();
    expect(onDecision).toHaveBeenCalledWith(false);
  });
});

describe("matchCommands", () => {
  it("ranks prefix matches above fuzzy ones", () => {
    const names = matchCommands("mo").map((c) => c.name);
    expect(names[0]).toBe("model"); // prefix
    expect(names).toContain("model");
  });

  it("finds subsequence matches", () => {
    expect(matchCommands("ss").map((c) => c.name)).toContain("sessions");
  });

  it("returns everything for an empty query", () => {
    expect(matchCommands("").length).toBeGreaterThan(5);
  });
});

describe("CommandMenu", () => {
  it("marks the selected command", () => {
    const cmds = matchCommands("").slice(0, 4);
    const { lastFrame } = render(<CommandMenu theme={theme} commands={cmds} selected={1} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain(`/${cmds[1]!.name}`);
    expect(frame).toContain("❯"); // selection marker
  });
});

describe("StatusBar", () => {
  it("shows the folder, context, tokens and version (minimal footer)", () => {
    const { lastFrame } = render(
      <StatusBar theme={theme} cwd="/tmp/proj" tokens={1500} lastCtx={8200} ctxPct={3} autoApprove version="0.1.0" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("proj");
    expect(frame).toContain("ctx 8.2k (3%)");
    expect(frame).toContain("1.5k tok");
    expect(frame).toContain("auto");
    expect(frame).toContain("0.1.0");
  });

  it("is bare on a fresh home — just folder and version", () => {
    const { lastFrame } = render(
      <StatusBar theme={theme} cwd="/tmp/proj" tokens={0} lastCtx={0} autoApprove={false} version="0.1.3" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("proj");
    expect(frame).toContain("0.1.3");
    expect(frame).not.toContain("tok");
    expect(frame).not.toContain("ctx");
  });
});

describe("logo", () => {
  it("renders a word as 5 aligned block rows", () => {
    const rows = wordLines("TERM");
    expect(rows).toHaveLength(5);
    const widths = new Set(rows.map((r) => r.length));
    expect(widths.size).toBe(1);
    expect(rows.join("")).toContain("█");
  });

  it("produces a deterministic starfield for a given seed", () => {
    expect(starfield(40, 2, 7)).toEqual(starfield(40, 2, 7));
    expect(starfield(40, 2, 7)).not.toEqual(starfield(40, 2, 8));
  });

  it("twinkles: stars keep position but change glyph across frames", () => {
    const stars = makeStars(30, 3, 8, 7);
    const f0 = renderStars(stars, 30, 3, 0);
    const f1 = renderStars(stars, 30, 3, 1);
    expect(f0).toHaveLength(3);
    expect(f0.join("\n")).not.toEqual(f1.join("\n"));
    expect(f0.join("").trim().length).toBeGreaterThan(0);
  });
});

describe("matchFiles", () => {
  const files = ["src/app.ts", "src/components/Composer.tsx", "README.md", "docs/sdk.md"];
  it("ranks basename prefix matches first", () => {
    expect(matchFiles(files, "comp")[0]).toBe("src/components/Composer.tsx");
  });
  it("matches path substrings", () => {
    expect(matchFiles(files, "docs")).toContain("docs/sdk.md");
  });
});

describe("CodeBlock", () => {
  it("shows the language label and line numbers", () => {
    const { lastFrame } = render(
      <CodeBlock theme={theme} lang="ts" lines={["const x = 1;", "return x;"]} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("ts");
    expect(frame).toContain("const x = 1;");
    expect(frame).toContain("1"); // gutter
  });
});

describe("Markdown", () => {
  it("renders a fenced code block distinctly", () => {
    const { lastFrame } = render(
      <Markdown theme={theme} text={"Here:\n```js\nconst a = 2;\n```\nDone."} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("const a = 2;");
    expect(frame).toContain("js");
    expect(frame).toContain("Done.");
  });
});

describe("MentionMenu", () => {
  it("marks the selected file", () => {
    const { lastFrame } = render(
      <MentionMenu theme={theme} files={["src/a.ts", "src/b.ts"]} selected={1} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("b.ts");
    expect(frame).toContain("❯");
  });

  it("previews the first lines of the selected file", () => {
    const dir = mkdtempSync(join(tmpdir(), "tc-mm-"));
    writeFileSync(join(dir, "notes.ts"), "export const answer = 42;\nconst other = 1;");
    const { lastFrame } = render(<MentionMenu theme={theme} files={["notes.ts"]} selected={0} cwd={dir} />);
    expect(lastFrame() ?? "").toContain("export const answer = 42;");
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("ModelPicker", () => {
  const entries = [
    { id: "termcoder/auto", provider: "termcoder", model: "auto", name: "termcoder Auto", free: true },
    { id: "termexplorer/auto", provider: "termexplorer", model: "auto", name: "termexplorer", free: true },
    { id: "anthropic/x", provider: "anthropic", model: "x", name: "Claude X" },
    { id: "ollama/llama3.1", provider: "ollama", model: "llama3.1", name: "Llama 3.1", local: true },
  ];
  const pickerProps = {
    onSelect: () => {},
    onToggleFavorite: () => {},
    onConnectProvider: () => {},
    onClose: () => {},
    favorites: [] as string[],
  };

  it("groups our models / cloud / local and marks readiness", () => {
    const { lastFrame } = render(
      <ModelPicker theme={theme} entries={entries} readiness={(e) => (e.provider !== "anthropic" ? "ready" : "needs-key")} current="termcoder/auto" {...pickerProps} />,
    );
    const f = lastFrame() ?? "";
    expect(f).toContain("termcoder AI");
    expect(f).toContain("Cloud");
    expect(f).toContain("Local");
    expect(f).toContain("termexplorer");
    expect(f).toContain("●"); // a ready model
    expect(f).toContain("○"); // anthropic needs a key
  });

  it("pins favorites to the top", () => {
    const { lastFrame } = render(
      <ModelPicker theme={theme} entries={entries} readiness={() => "ready"} current="x" {...pickerProps} favorites={["ollama/llama3.1"]} />,
    );
    const f = lastFrame() ?? "";
    expect(f).toContain("★ Favorites");
    expect(f.indexOf("Favorites")).toBeLessThan(f.indexOf("termcoder AI"));
  });

  it("filters as you type and selects on enter", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <ModelPicker theme={theme} entries={entries} readiness={() => "ready"} current="x" {...pickerProps} onSelect={onSelect} />,
    );
    await tick();
    stdin.write("llama");
    await tick();
    stdin.write("\r");
    await tick();
    expect(onSelect).toHaveBeenCalledWith("ollama/llama3.1");
  });
});

describe("DiffView", () => {
  it("numbers new-side lines and keeps +/- signs", () => {
    const diff = "  const a = 1;\n- const b = 2;\n+ const b = 3;\n  return a;";
    const { lastFrame } = render(<DiffView theme={theme} text={diff} />);
    const f = lastFrame() ?? "";
    expect(f).toContain("const b = 3;");
    expect(f).toContain("+ ");
    expect(f).toContain("- ");
    expect(f).toMatch(/\d\s+[+ ]/); // a line-number gutter before the sign
  });
});

describe("Markdown rich blocks", () => {
  it("renders numbered lists, tables and links", () => {
    const md = "1. First\n2. Second\n\n| A | B |\n| --- | --- |\n| x | y |\n\nSee [the docs](http://x).";
    const { lastFrame } = render(<Markdown theme={theme} text={md} />);
    const f = lastFrame() ?? "";
    expect(f).toContain("1. First");
    expect(f).toContain("│"); // table column divider
    expect(f).toContain("x");
    expect(f).toContain("the docs"); // link text (not the url)
    expect(f).not.toContain("http://x");
  });
});

describe("MultilineInput", () => {
  function Harness({ onSubmit }: { onSubmit: (v: string) => void }) {
    const [v, setV] = useState("");
    return <MultilineInput theme={theme} value={v} onChange={setV} onSubmit={onSubmit} focus />;
  }

  it("inserts typed text and submits on enter", async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(<Harness onSubmit={onSubmit} />);
    await tick();
    stdin.write("hello");
    await tick();
    expect(lastFrame()).toContain("hello");
    stdin.write("\r"); // enter
    await tick();
    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("scrolls long input, keeping the cursor line visible", () => {
    const value = Array.from({ length: 15 }, (_, i) => `line${i}`).join("\n");
    const { lastFrame } = render(
      <MultilineInput theme={theme} value={value} onChange={() => {}} onSubmit={() => {}} focus />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("more line"); // scroll indicator
    expect(frame).toContain("line14"); // cursor (at end) line visible
    expect(frame).not.toContain("line0 "); // top scrolled off
  });

  it("turns a trailing backslash + enter into a newline instead of submitting", async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(<Harness onSubmit={onSubmit} />);
    await tick();
    stdin.write("a\\");
    await tick();
    stdin.write("\r"); // enter → newline
    await tick();
    stdin.write("b");
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("a");
    expect(frame).toContain("b");
  });
});

describe("ReviewMode", () => {
  const theme = getTheme("mono");
  const card = { id: "c1", front: "Capital of France?", back: "Paris", ease: 2.5, interval: 0, reps: 0, due: 0, createdAt: 0 };

  it("shows the front and hides the back until revealed", async () => {
    const { stdin, lastFrame } = render(
      <ReviewMode theme={theme} deck="geo" cards={[card]} onGrade={() => {}} onExit={() => {}} />,
    );
    await tick();
    expect(lastFrame()).toContain("Capital of France?");
    expect(lastFrame()).not.toContain("Paris");
    stdin.write("\r"); // enter → reveal
    await tick();
    expect(lastFrame()).toContain("Paris");
  });

  it("grades a revealed card and exits after the last one", async () => {
    const onGrade = vi.fn();
    const onExit = vi.fn();
    const { stdin } = render(
      <ReviewMode theme={theme} deck="geo" cards={[card]} onGrade={onGrade} onExit={onExit} />,
    );
    await tick();
    stdin.write("\r"); // reveal
    await tick();
    stdin.write("5"); // grade
    await tick();
    expect(onGrade).toHaveBeenCalledWith("c1", 5);
    expect(onExit).toHaveBeenCalledWith(1);
  });
});
