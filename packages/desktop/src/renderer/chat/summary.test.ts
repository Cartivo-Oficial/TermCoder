import { filePatch } from "@termcoder/core";
import { describe, expect, it } from "vitest";
import {
  countPatch,
  elapsedSeconds,
  formatDuration,
  lastUserIndex,
  splitPath,
  turnCards,
  turnSummary,
} from "./summary";

const edit = (target: string, before: string, after: string) => ({
  role: "tool",
  name: "edit",
  status: "done",
  target,
  patch: filePatch(before, after),
});

describe("counting a patch", () => {
  it("counts added and removed lines, not context", () => {
    const patch = filePatch("a\nb\nc\n", "a\nB\nc\nd\n");
    const { added, removed } = countPatch(patch);
    expect(added).toBe(2);
    expect(removed).toBe(1);
  });

  it("survives an empty patch", () => {
    expect(countPatch([])).toEqual({ added: 0, removed: 0 });
  });
});

describe("summarising a turn", () => {
  it("says nothing happened when nothing did", () => {
    const s = turnSummary([{ role: "assistant", text: "Here is what I think." }]);
    expect(s.didWork).toBe(false);
    expect(s.files).toEqual([]);
  });

  it("lists each file once, with its own counts", () => {
    const s = turnSummary([
      edit("src/a.ts", "one\n", "one\ntwo\n"),
      edit("src/b.ts", "x\ny\n", "x\n"),
    ]);
    expect(s.didWork).toBe(true);
    expect(s.files.map((f) => f.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(s.files[0]).toMatchObject({ added: 1, removed: 0 });
    expect(s.files[1]).toMatchObject({ added: 0, removed: 1 });
  });

  it("adds up a file edited twice rather than listing it twice", () => {
    const s = turnSummary([
      edit("src/a.ts", "one\n", "one\ntwo\n"),
      edit("src/a.ts", "one\ntwo\n", "one\ntwo\nthree\n"),
    ]);
    expect(s.files).toHaveLength(1);
    expect(s.files[0]).toMatchObject({ path: "src/a.ts", added: 2 });
  });

  it("totals what it lists", () => {
    const s = turnSummary([edit("a.ts", "1\n", "1\n2\n"), edit("b.ts", "9\n", "")]);
    expect(s.added).toBe(s.files.reduce((n, f) => n + f.added, 0));
    expect(s.removed).toBe(s.files.reduce((n, f) => n + f.removed, 0));
  });

  it("records a command and whether it exited clean, and nothing about its output", () => {
    const s = turnSummary([
      { role: "tool", name: "bash", status: "done", text: "pnpm typecheck" },
      { role: "tool", name: "bash", status: "error", text: "pnpm test" },
    ]);
    expect(s.checks).toEqual([
      { command: "pnpm typecheck", ok: true },
      { command: "pnpm test", ok: false },
    ]);
  });

  it("counts a command as work even with no files touched", () => {
    const s = turnSummary([{ role: "tool", name: "bash", status: "done", text: "pnpm build" }]);
    expect(s.didWork).toBe(true);
  });

  it("ignores a tool that produced no patch, rather than inventing a zero", () => {
    const s = turnSummary([{ role: "tool", name: "read", status: "done", text: "src/a.ts" }]);
    expect(s.files).toEqual([]);
    expect(s.didWork).toBe(false);
  });

  it("ignores a tool still running", () => {
    const s = turnSummary([{ ...edit("a.ts", "1\n", "1\n2\n"), status: "running" }]);
    expect(s.files).toEqual([]);
  });
});

describe("splitting a path for a narrow row", () => {
  it("keeps the file name whole and the directory separate", () => {
    expect(splitPath("packages/desktop/src/renderer/App.tsx")).toEqual({
      dir: "packages/desktop/src/renderer/",
      base: "App.tsx",
    });
  });

  it("handles a bare file name", () => {
    expect(splitPath("README.md")).toEqual({ dir: "", base: "README.md" });
  });

  it("handles a windows separator", () => {
    expect(splitPath("src\\main\\index.ts")).toEqual({ dir: "src\\main\\", base: "index.ts" });
  });
});

describe("formatting a duration", () => {
  it("reads in seconds under a minute", () => {
    expect(formatDuration(12)).toBe("12s");
    expect(formatDuration(0)).toBe("0s");
  });

  it("reads in minutes and padded seconds over one", () => {
    expect(formatDuration(60)).toBe("1m 00s");
    expect(formatDuration(125)).toBe("2m 05s");
  });

  it("rounds rather than showing a fraction", () => {
    expect(formatDuration(12.4)).toBe("12s");
  });
});

describe("the turn clock", () => {
  it("measures a finished turn end to start", () => {
    expect(elapsedSeconds({ start: 1000, end: 13_000 }, 99_000)).toBe(12);
  });

  it("measures a running turn against now", () => {
    expect(elapsedSeconds({ start: 1000 }, 4000)).toBe(3);
  });

  it("has nothing to say about a turn it never timed", () => {
    expect(elapsedSeconds(undefined, 4000)).toBeUndefined();
  });

  it("never goes negative when the clock is behind", () => {
    expect(elapsedSeconds({ start: 5000 }, 1000)).toBe(0);
  });
});

describe("finding the turn a card belongs to", () => {
  const user = (text: string) => ({ role: "user", text });
  const reply = (text: string) => ({ role: "assistant", text });

  it("points at the last user message", () => {
    expect(lastUserIndex([user("a"), reply("b"), user("c"), reply("d")])).toBe(2);
    expect(lastUserIndex([reply("b")])).toBe(-1);
  });

  it("hangs one card off the reply that closes the turn", () => {
    const cards = turnCards([
      user("fix it"),
      reply("On it."),
      edit("src/a.ts", "one\n", "one\ntwo\n"),
      reply("Done."),
    ]);
    expect([...cards.keys()]).toEqual([3]);
    expect(cards.get(3)?.start).toBe(0);
    expect(cards.get(3)?.summary.files.map((f) => f.path)).toEqual(["src/a.ts"]);
  });

  it("keeps each turn's work to itself", () => {
    const cards = turnCards([
      user("first"),
      edit("a.ts", "1\n", "1\n2\n"),
      reply("did a"),
      user("second"),
      edit("b.ts", "1\n", "1\n2\n"),
      reply("did b"),
    ]);
    expect([...cards.keys()]).toEqual([2, 5]);
    expect(cards.get(2)?.summary.files.map((f) => f.path)).toEqual(["a.ts"]);
    expect(cards.get(5)?.summary.files.map((f) => f.path)).toEqual(["b.ts"]);
  });

  it("hangs no card off a turn that only talked", () => {
    expect(turnCards([user("hello"), reply("hi")]).size).toBe(0);
  });

  it("waits for a reply before it has somewhere to hang the card", () => {
    expect(turnCards([user("fix it"), edit("a.ts", "1\n", "1\n2\n")]).size).toBe(0);
  });

  it("ignores work that arrived before any turn began", () => {
    expect(turnCards([edit("a.ts", "1\n", "1\n2\n"), reply("stray")]).size).toBe(0);
  });
});
