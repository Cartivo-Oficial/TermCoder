import vm from "node:vm";

export type SandboxResult = { returnValue: unknown; logs: string; error?: string };

export async function runProgram(
  code: string,
  globals: Record<string, unknown>,
  opts: { timeoutMs: number; maxLog: number },
): Promise<SandboxResult> {
  const buffer: string[] = [];
  let size = 0;
  let truncated = false;
  const capture = (...parts: unknown[]) => {
    if (size >= opts.maxLog) {
      if (!truncated) {
        truncated = true;
        buffer.push("[log truncated]");
      }
      return;
    }
    const line = parts.map((p) => (typeof p === "string" ? p : safeStringify(p))).join(" ");
    size += line.length + 1;
    buffer.push(line);
  };
  const console = { log: capture, info: capture, warn: capture, error: capture, debug: capture };

  const context = vm.createContext({ ...globals, console });
  const wrapped = "(async () => {\n" + code + "\n})()";

  try {
    const script = new vm.Script(wrapped, { filename: "codemode.js" });
    const started = script.runInContext(context, { timeout: opts.timeoutMs }) as Promise<unknown>;
    const returnValue = await withTimeout(started, opts.timeoutMs);
    return { returnValue, logs: buffer.join("\n") };
  } catch (err) {
    return { returnValue: undefined, logs: buffer.join("\n"), error: errorMessage(err) };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      const t = setTimeout(() => reject(new Error("timed out after " + ms + "ms")), ms);
      if (typeof t.unref === "function") t.unref();
    }),
  ]);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return String(err);
}
