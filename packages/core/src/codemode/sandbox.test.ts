import { describe, it, expect } from "vitest";
import { runProgram } from "./sandbox";

const OPTS = { timeoutMs: 2000, maxLog: 4096 };

describe("runProgram", () => {
  it("returns the program's value and captured logs", async () => {
    const r = await runProgram(
      "console.log('hi'); return 1 + 2;",
      {},
      OPTS,
    );
    expect(r.returnValue).toBe(3);
    expect(r.logs).toContain("hi");
    expect(r.error).toBeUndefined();
  });

  it("awaits injected async globals", async () => {
    const r = await runProgram(
      "const v = await double(21); return v;",
      { double: async (n: number) => n * 2 },
      OPTS,
    );
    expect(r.returnValue).toBe(42);
  });

  it("denies ambient authority", async () => {
    const r = await runProgram(
      "return [typeof require, typeof process, typeof fetch, typeof Buffer, typeof setTimeout];",
      {},
      OPTS,
    );
    expect(r.returnValue).toEqual(["undefined", "undefined", "undefined", "undefined", "undefined"]);
  });

  it("returns a readable error when the program throws", async () => {
    const r = await runProgram("throw new Error('boom');", {}, OPTS);
    expect(r.error).toContain("boom");
    expect(r.returnValue).toBeUndefined();
  });

  it("extracts the exact message from a vm-thrown Error (cross-realm)", async () => {
    const r = await runProgram("throw new Error('boom');", {}, { timeoutMs: 2000, maxLog: 4096 });
    expect(r.error).toBe("boom");
  });

  it("aborts a synchronous infinite loop via timeout", async () => {
    const r = await runProgram("while (true) {}", {}, { timeoutMs: 200, maxLog: 4096 });
    expect(r.error).toBeTruthy();
  });

  it("aborts a never-resolving await via the host race", async () => {
    const r = await runProgram("await new Promise(() => {}); return 1;", {}, { timeoutMs: 200, maxLog: 4096 });
    expect(r.error).toContain("timed out");
  });
});
