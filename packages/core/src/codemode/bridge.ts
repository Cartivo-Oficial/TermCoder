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
    if (t.permissionKind) continue;
    tools[t.name] = async (args: unknown) => {
      calls += 1;
      if (calls > opts.maxCalls) {
        throw new Error("CodeMode: tool-call limit reached (" + opts.maxCalls + ")");
      }
      const schema = t.inputSchema as { parse?: (a: unknown) => unknown };
      const parsed = typeof schema.parse === "function" ? schema.parse(args ?? {}) : (args ?? {});
      const result = await t.run(parsed, ctx);
      return result.output;
    };
  }

  for (const fn of Object.values(tools)) Object.freeze(fn);
  Object.freeze(tools);
  return { tools, callCount: () => calls };
}
