import type { TermTool, ToolContext } from "../tools/types";

export type ToolBridge = {
  tools: Record<string, (args: unknown) => Promise<string>>;
  callCount: () => number;
};

export function buildToolBridge(
  toolList: TermTool[],
  ctx: ToolContext,
  opts: { maxCalls: number },
): ToolBridge {
  let calls = 0;
  const tools: Record<string, (args: unknown) => Promise<string>> = {};

  for (const t of toolList) {
    if (t.name === "run_code") continue;
    tools[t.name] = async (args: unknown) => {
      calls += 1;
      if (calls > opts.maxCalls) {
        throw new Error("CodeMode: tool-call limit reached (" + opts.maxCalls + ")");
      }
      const schema = t.inputSchema as { parse: (a: unknown) => unknown };
      const parsed = schema.parse(args ?? {});
      const result = await t.run(parsed, ctx);
      return result.output;
    };
  }

  Object.freeze(tools);
  return { tools, callCount: () => calls };
}
