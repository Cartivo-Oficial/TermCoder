import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
  client,
  ndJsonStream,
  PROTOCOL_VERSION,
  type AgentApp,
  type RequestPermissionResponse,
} from "@agentclientprotocol/sdk";
import type { SessionEvent } from "../session/session";
import type { AgentSpec } from "./registry";
import { translateStop, translateUpdate } from "./translate";

export interface PermissionChoice {
  id: string;
  name: string;
}

export interface PermissionAsk {
  title: string;
  options: PermissionChoice[];
}

export type AskPermission = (ask: PermissionAsk) => Promise<string>;

export interface RunSessionOptions {
  connectTo: unknown;
  cwd: string;
  prompt: string;
  sourceId: string;
  emit: (event: SessionEvent) => void;
  askPermission: AskPermission;
  signal?: AbortSignal;
}

export interface RunAgentOptions extends Omit<RunSessionOptions, "connectTo"> {
  spec: AgentSpec;
  env?: NodeJS.ProcessEnv;
}

const CLIENT_CAPABILITIES = {
  fs: { readTextFile: false, writeTextFile: false },
  terminal: false,
};

function answer(ask: PermissionAsk, chosen: string): RequestPermissionResponse {
  const match =
    ask.options.find((option) => option.id === chosen) ??
    ask.options.find((option) => option.name === chosen);
  if (!match) return { outcome: { outcome: "cancelled" } };
  return { outcome: { outcome: "selected", optionId: match.id } };
}

export async function runSession(opts: RunSessionOptions): Promise<void> {
  const app = client({ name: "termcoder" }).onRequest(
    "session/request_permission",
    async (ctx) => {
      const ask: PermissionAsk = {
        title: ctx.params.toolCall.title ?? ctx.params.toolCall.toolCallId,
        options: ctx.params.options.map((option) => ({
          id: option.optionId,
          name: option.name,
        })),
      };
      return answer(ask, await opts.askPermission(ask));
    },
  );

  await app.connectWith(opts.connectTo as AgentApp, async (agentCx) => {
    await agentCx.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: CLIENT_CAPABILITIES,
    });

    const session = await agentCx.buildSession(opts.cwd).start();
    const cancel = () => {
      void agentCx.notify("session/cancel", { sessionId: session.sessionId }).catch(() => {});
    };

    try {
      if (opts.signal?.aborted) cancel();
      else opts.signal?.addEventListener("abort", cancel, { once: true });

      const finished = session.prompt(opts.prompt);
      finished.catch(() => {});

      for (;;) {
        const message = await session.nextUpdate();
        if (message.kind === "stop") {
          opts.emit(translateStop(message.stopReason, opts.sourceId));
          break;
        }
        const event = translateUpdate(message.update, opts.sourceId);
        if (event) opts.emit(event);
      }
    } finally {
      opts.signal?.removeEventListener("abort", cancel);
      session.dispose();
    }
  });
}

function killTree(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid !== undefined) {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      }).on("error", () => {});
    } catch {
      child.kill();
    }
    return;
  }
  child.kill();
}

export function agentEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) continue;
    out[key] = value;
  }
  return out;
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { spec, env, ...rest } = opts;
  const child = spawn(spec.command, spec.args, {
    cwd: rest.cwd,
    env: agentEnv(env ?? process.env),
    stdio: ["pipe", "pipe", "inherit"],
    shell: process.platform === "win32",
  });

  let spawnFailure: Error | null = null;
  child.on("error", (error) => {
    spawnFailure = error;
  });

  const stop = () => killTree(child);
  rest.signal?.addEventListener("abort", stop, { once: true });

  try {
    const stream = ndJsonStream(
      Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
    );
    await runSession({ ...rest, connectTo: stream });
  } catch (error) {
    throw spawnFailure ?? error;
  } finally {
    rest.signal?.removeEventListener("abort", stop);
    stop();
  }
}
