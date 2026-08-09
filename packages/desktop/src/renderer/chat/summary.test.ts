import { filePatch } from "@termcoder/core";
import { describe, expect, it } from "vitest";
import { countPatch, turnSummary } from "./summary";

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
