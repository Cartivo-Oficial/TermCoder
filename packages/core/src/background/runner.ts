import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionEvent } from "../session/session";


export interface AutonomousSession {
  record: { cwd: string };
  prompt(text: string, opts?: { signal?: AbortSignal }): AsyncGenerator<SessionEvent, void>;
}

export type AutonomousStatus = "verified" | "done" | "maxed" | "aborted" | "error";

export type AutonomousEvent =
  | { type: "round"; round: number; instruction: string }
  | { type: "session"; round: number; event: SessionEvent }
  | { type: "verify"; round: number; ok: boolean; output: string }
  | { type: "finished"; status: AutonomousStatus; rounds: number };

export interface RunAutonomousOptions {
  session: AutonomousSession;
  goal: string;
  maxRounds?: number;
  verifyCommand?: string;
  signal?: AbortSignal;
}

export function runVerify(
  command: string,
  cwd: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true });
    let out = "";
    const onData = (b: Buffer) => {
      out += b.toString();
      if (out.length > 20_000) out = out.slice(-20_000); // keep the tail
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    const onAbort = () => child.kill();
    signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort);
      resolve({ ok: false, output: `Could not run \`${command}\`: ${String(err)}` });
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      resolve({ ok: code === 0, output: out.trim() });
    });
  });
}

export function detectVerifyCommand(cwd: string): string | undefined {
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const scripts = (JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> }).scripts ?? {};
      const pm = existsSync(join(cwd, "pnpm-lock.yaml"))
        ? "pnpm"
        : existsSync(join(cwd, "yarn.lock"))
          ? "yarn"
          : "npm";
      for (const name of ["test", "typecheck", "build", "lint"]) {
        if (scripts[name]) return `${pm} run ${name}`;
      }
    } catch {
    }
  }
  if (existsSync(join(cwd, "go.mod"))) return "go build ./...";
  if (existsSync(join(cwd, "Cargo.toml"))) return "cargo check";
  if (existsSync(join(cwd, "pyproject.toml"))) return "python -m pytest -q";
  return undefined;
}

export async function* runAutonomous(opts: RunAutonomousOptions): AsyncGenerator<AutonomousEvent> {
  const maxRounds = Math.max(1, opts.maxRounds ?? 5);
  let instruction = opts.goal;

  for (let round = 1; round <= maxRounds; round++) {
    if (opts.signal?.aborted) return void (yield { type: "finished", status: "aborted", rounds: round - 1 });
    yield { type: "round", round, instruction };

    let errored = false;
    for await (const event of opts.session.prompt(instruction, { signal: opts.signal })) {
      yield { type: "session", round, event };
      if (event.type === "error") errored = true;
    }
    if (errored) return void (yield { type: "finished", status: "error", rounds: round });
    if (opts.signal?.aborted) return void (yield { type: "finished", status: "aborted", rounds: round });

    if (!opts.verifyCommand) return void (yield { type: "finished", status: "done", rounds: round });

    const result = await runVerify(opts.verifyCommand, opts.session.record.cwd, opts.signal);
    yield { type: "verify", round, ok: result.ok, output: result.output };
    if (result.ok) return void (yield { type: "finished", status: "verified", rounds: round });

    instruction =
      `The verification command \`${opts.verifyCommand}\` failed:\n\n` +
      `${result.output.slice(-4000)}\n\n` +
      `Find the cause and fix it so the command passes. Make only the changes needed.`;
  }

  yield { type: "finished", status: "maxed", rounds: maxRounds };
}
