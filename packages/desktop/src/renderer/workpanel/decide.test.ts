import { describe, expect, it } from "vitest";
import { closedWork, closeWork, pinWork, reduceWork } from "./decide";

const edit = { type: "tool-call", id: "1", name: "edit", patch: [] } as const;
const bash = { type: "tool-call", id: "2", name: "bash" } as const;
const sub = { type: "subagent-start", sessionId: "s", agent: "explore", prompt: "p" } as const;
const done = { type: "done" } as const;

describe("the work panel's decision", () => {
  it("is absent until there is work", () => {
    expect(closedWork.open).toBe(false);
  });

  it("opens on the diff when a file changes", () => {
    const s = reduceWork(closedWork, edit);
    expect(s.open).toBe(true);
    expect(s.tab).toBe("diff");
  });

  it("shows the terminal when a command runs", () => {
    expect(reduceWork(closedWork, bash).tab).toBe("terminal");
  });

  it("shows the canvas when a sub-agent starts", () => {
    expect(reduceWork(closedWork, sub).tab).toBe("canvas");
  });

  it("follows the newest activity", () => {
    const s = reduceWork(reduceWork(closedWork, edit), bash);
    expect(s.tab).toBe("terminal");
  });

  it("stops following once the user picks a tab", () => {
    const pinned = pinWork(reduceWork(closedWork, edit), "diff");
    expect(reduceWork(pinned, bash).tab).toBe("diff");
  });

  it("resumes following on the next turn", () => {
    const pinned = pinWork(reduceWork(closedWork, edit), "diff");
    const idle = reduceWork(pinned, done);
    expect(idle.pinned).toBe(false);
    expect(reduceWork(idle, bash).tab).toBe("terminal");
  });

  it("stays open once it has opened, so a finished diff is still readable", () => {
    const s = reduceWork(reduceWork(closedWork, edit), done);
    expect(s.open).toBe(true);
  });

  it("closes only when the user closes it", () => {
    expect(closeWork(reduceWork(closedWork, edit)).open).toBe(false);
  });

  it("stays closed for the rest of the turn once dismissed", () => {
    const dismissed = closeWork(reduceWork(closedWork, edit));
    expect(reduceWork(dismissed, bash).open).toBe(false);
  });

  it("may open again on the next turn", () => {
    const dismissed = closeWork(reduceWork(closedWork, edit));
    const next = reduceWork(dismissed, done);
    expect(reduceWork(next, bash).open).toBe(true);
  });

  it("ignores a tool call that carries no patch and is not a command", () => {
    const s = reduceWork(closedWork, { type: "tool-call", id: "3", name: "read" });
    expect(s.open).toBe(false);
  });
});
