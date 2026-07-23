import { z } from "zod";
import { defineTool, type TermTool, type ToolContext } from "../tools/types";
import { buildToolBridge } from "./bridge";
import { runProgram } from "./sandbox";
import { builtinTools } from "../tools/builtins";

export const CODEMODE_LIMITS = {
  timeoutMs: 30000,
  maxCalls: 100,
  maxLog: 16384,
  maxOutput: 24576,
};

export const runCodeTool: TermTool = defineTool({
  name: "run_code",
  description:
    "Run a JavaScript program that orchestrates the available tools in one execution. " +
    "Call tools with `await tools.<name>(args)`; you may sequence, loop, branch, and `Promise.all`. " +
    "No filesystem, network, or process access except through the tools. `return` a value and `console.log` for output.",
  inputSchema: z.object({ code: z.string().describe("The JavaScript program to run.") }),
  readOnly: false,
  permissionKind: "bash",
  describe: () => ({ title: "run code" }),
  async run({ code }, ctx: ToolContext) {
    const list = ctx.tools ?? builtinTools;
    const bridge = buildToolBridge(list, ctx, { maxCalls: CODEMODE_LIMITS.maxCalls });
    const r = await runProgram(code, { tools: bridge.tools }, {
      timeoutMs: CODEMODE_LIMITS.timeoutMs,
      maxLog: CODEMODE_LIMITS.maxLog,
    });
    return { output: format(r), meta: { calls: bridge.callCount() } };
  },
});

function format(r: { returnValue: unknown; logs: string; error?: string }): string {
  const parts: string[] = [];
  if (r.error) {
    parts.push("CodeMode error: " + r.error);
  } else {
    parts.push("Result: " + stringify(r.returnValue));
  }
  if (r.logs) parts.push("Logs:\n" + r.logs);
  return truncate(parts.join("\n\n"), CODEMODE_LIMITS.maxOutput);
}

function stringify(value: unknown): string {
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const marker = "\n… [truncated]";
  return text.slice(0, Math.max(0, max - marker.length)) + marker;
}
