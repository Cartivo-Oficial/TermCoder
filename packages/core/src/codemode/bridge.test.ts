import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { buildToolBridge } from "./bridge";
import { defineTool, type TermTool } from "../tools/types";

const echo = defineTool({
  name: "echo",
  description: "echo",
  inputSchema: z.object({ text: z.string() }),
  readOnly: true,
  async run(args) {
    return { output: "echo:" + args.text };
  },
});

const ctx = { cwd: "/tmp" };

describe("buildToolBridge", () => {
  it("exposes each tool as a validated async function returning output", async () => {
    const bridge = buildToolBridge([echo], ctx, { maxCalls: 10 });
    const out = await bridge.tools.echo({ text: "hi" });
    expect(out).toBe("echo:hi");
    expect(bridge.callCount()).toBe(1);
  });

  it("rejects invalid args with a readable message", async () => {
    const bridge = buildToolBridge([echo], ctx, { maxCalls: 10 });
    await expect(bridge.tools.echo({ text: 5 })).rejects.toThrow();
  });

  it("enforces the tool-call cap", async () => {
    const bridge = buildToolBridge([echo], ctx, { maxCalls: 1 });
    await bridge.tools.echo({ text: "a" });
    await expect(bridge.tools.echo({ text: "b" })).rejects.toThrow(/limit/);
  });

  it("excludes run_code from the surface", () => {
    const runCode = defineTool({
      name: "run_code",
      description: "x",
      inputSchema: z.object({ code: z.string() }),
      readOnly: false,
      async run() {
        return { output: "" };
      },
    });
    const bridge = buildToolBridge([echo, runCode], ctx, { maxCalls: 10 });
    expect(bridge.tools.run_code).toBeUndefined();
    expect(typeof bridge.tools.echo).toBe("function");
  });

  it("passes ctx through to the tool", async () => {
    const spy = vi.fn(async () => ({ output: "ok" }));
    const t = defineTool({ name: "t", description: "t", inputSchema: z.object({}), readOnly: true, run: spy });
    const bridge = buildToolBridge([t], ctx, { maxCalls: 10 });
    await bridge.tools.t({});
    expect(spy).toHaveBeenCalledWith({}, ctx);
  });

  it("does not crash on a non-Zod schema and forwards args unchanged", async () => {
    const spy = vi.fn(async () => ({ output: "ok" }));
    const nonZod: TermTool = {
      name: "mcp_tool",
      description: "mcp_tool",
      inputSchema: { validate() {} } as unknown as TermTool["inputSchema"],
      readOnly: true,
      run: spy,
    };
    const bridge = buildToolBridge([nonZod], ctx, { maxCalls: 10 });
    await expect(bridge.tools.mcp_tool({ any: 1 })).resolves.toBe("ok");
    expect(spy).toHaveBeenCalledWith({ any: 1 }, ctx);
  });
});
