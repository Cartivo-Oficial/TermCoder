import { exec } from "node:child_process";
import { z } from "zod";
import { defineTool } from "./types";

const DEFAULT_TIMEOUT = 60_000;
const MAX_TIMEOUT = 600_000;
const MAX_BUFFER = 1024 * 1024;

interface ExecOutcome {
  stdout: string;
  stderr: string;
  code: number;
  timedOut: boolean;
}

function runCommand(command: string, cwd: string, timeout: number): Promise<ExecOutcome> {
  return new Promise((resolve) => {
    const child = exec(
      command,
      { cwd, timeout, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout, stderr) => {
        const timedOut = Boolean(error && (error as { killed?: boolean }).killed);
        const code =
          error && typeof (error as { code?: number }).code === "number"
            ? ((error as { code?: number }).code as number)
            : error
              ? 1
              : 0;
        resolve({ stdout, stderr, code, timedOut });
      },
    );
    void child;
  });
}

export const bashTool = defineTool({
  name: "bash",
  description:
    "Run a shell command in the workspace directory and return its combined output and exit code.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to run."),
    timeoutMs: z
      .number()
      .int()
      .min(1)
      .max(MAX_TIMEOUT)
      .optional()
      .describe(`Timeout in milliseconds (default ${DEFAULT_TIMEOUT}).`),
  }),
  readOnly: false,
  permissionKind: "bash",
  target(args) {
    return args.command;
  },
  describe(args) {
    return { title: "Run shell command", detail: args.command };
  },
  async run(args, ctx) {
    const timeout = args.timeoutMs ?? DEFAULT_TIMEOUT;
    const { stdout, stderr, code, timedOut } = await runCommand(
      args.command,
      ctx.cwd,
      timeout,
    );
    const parts: string[] = [];
    if (stdout.trim()) parts.push(stdout.trimEnd());
    if (stderr.trim()) parts.push(`[stderr]\n${stderr.trimEnd()}`);
    if (timedOut) parts.push(`[timed out after ${timeout}ms]`);
    parts.push(`[exit code ${code}]`);
    return { output: parts.join("\n"), meta: { code, timedOut } };
  },
});
