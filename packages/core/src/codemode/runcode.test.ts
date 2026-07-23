import { describe, it, expect } from "vitest";
import { z } from "zod";
import { runCodeTool } from "./runcode";
import { defineTool } from "../tools/types";

const echo = defineTool({
  name: "echo",
  description: "echo",
  inputSchema: z.object({ text: z.string() }),
  readOnly: true,
  async run(args) {
    return { output: "echo:" + args.text };
  },
});

describe("run_code tool", () => {
  it("runs a program that calls a tool and returns a value", async () => {
    const ctx = { cwd: "/tmp", tools: [echo] };
    const res = await runCodeTool.run(
      { code: "const a = await tools.echo({ text: 'x' }); console.log('did', a); return a.length;" },
      ctx,
    );
    expect(res.output).toContain("6");
    expect(res.output).toContain("did echo:x");
  });

  it("surfaces program errors as CodeMode error", async () => {
    const ctx = { cwd: "/tmp", tools: [echo] };
    const res = await runCodeTool.run({ code: "throw new Error('nope');" }, ctx);
    expect(res.output).toContain("CodeMode error: nope");
  });

  it("is registered as run_code and not read-only", () => {
    expect(runCodeTool.name).toBe("run_code");
    expect(runCodeTool.readOnly).toBe(false);
  });
});
