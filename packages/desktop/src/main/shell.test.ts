import { describe, expect, it } from "vitest";
import { defaultShell, detectQuickTools, resolveOnPath, terminalEnv } from "./shell";

const fake = (present: string[]) => (p: string) => present.includes(p.replace(/\\/g, "/"));

describe("defaultShell", () => {
  it("uses ComSpec on windows", () => {
    expect(defaultShell("win32", { ComSpec: "C:\\Windows\\System32\\cmd.exe" })).toEqual({
      file: "C:\\Windows\\System32\\cmd.exe",
      args: [],
    });
  });

  it("falls back to cmd.exe when ComSpec is unset", () => {
    expect(defaultShell("win32", {})).toEqual({ file: "cmd.exe", args: [] });
  });

  it("uses a login shell on unix", () => {
    expect(defaultShell("darwin", { SHELL: "/bin/zsh" })).toEqual({ file: "/bin/zsh", args: ["-l"] });
    expect(defaultShell("linux", {})).toEqual({ file: "/bin/bash", args: ["-l"] });
  });
});

describe("terminalEnv", () => {
  it("strips electron vars that break child processes", () => {
    const out = terminalEnv({ ELECTRON_RUN_AS_NODE: "1", ELECTRON_NO_ATTACH_CONSOLE: "1", HOME: "/home/x" });
    expect(out.ELECTRON_RUN_AS_NODE).toBeUndefined();
    expect(out.ELECTRON_NO_ATTACH_CONSOLE).toBeUndefined();
    expect(out.HOME).toBe("/home/x");
  });

  it("advertises a color terminal", () => {
    const out = terminalEnv({ TERM: "dumb" });
    expect(out.TERM).toBe("xterm-256color");
    expect(out.COLORTERM).toBe("truecolor");
  });

  it("drops undefined values", () => {
    const out = terminalEnv({ A: undefined, B: "b" });
    expect("A" in out).toBe(false);
    expect(out.B).toBe("b");
  });
});

describe("resolveOnPath", () => {
  it("finds a windows executable via PATHEXT", () => {
    const env = { Path: "C:\\bin;C:\\other", PATHEXT: ".COM;.EXE;.CMD" };
    const hit = resolveOnPath("claude", env, "win32", fake(["C:/bin/claude.EXE"]));
    expect(hit).toBe("C:\\bin\\claude.EXE");
  });

  it("does not match an extensionless file on windows", () => {
    const env = { Path: "C:\\bin", PATHEXT: ".EXE" };
    expect(resolveOnPath("claude", env, "win32", fake(["C:/bin/claude"]))).toBeNull();
  });

  it("finds an extensionless binary on unix", () => {
    const env = { PATH: "/usr/bin:/usr/local/bin" };
    expect(resolveOnPath("claude", env, "linux", fake(["/usr/local/bin/claude"]))).toBe("/usr/local/bin/claude");
  });

  it("returns null when absent, and when PATH is empty", () => {
    expect(resolveOnPath("nope", { PATH: "/usr/bin" }, "linux", fake([]))).toBeNull();
    expect(resolveOnPath("nope", {}, "linux", fake(["/usr/bin/nope"]))).toBeNull();
  });
});

describe("detectQuickTools", () => {
  it("returns only the CLIs present on PATH, claude first", () => {
    const tools = detectQuickTools({ PATH: "/usr/bin" }, "linux", fake(["/usr/bin/claude", "/usr/bin/term"]));
    expect(tools.map((t) => t.id)).toEqual(["claude", "termcoder"]);
    expect(tools[0]).toEqual({ id: "claude", label: "Claude Code", command: "claude" });
  });

  it("returns an empty list when nothing is installed", () => {
    expect(detectQuickTools({ PATH: "/usr/bin" }, "linux", fake([]))).toEqual([]);
  });
});
