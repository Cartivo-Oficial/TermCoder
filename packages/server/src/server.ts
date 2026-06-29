import { randomUUID } from "node:crypto";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  createSubagentTool,
  loadConfig,
  PermissionManager,
  renderSessionHtml,
  renderSessionMarkdown,
  Session,
  SessionStore,
  ToolRegistry,
  transcriptSegments,
  type Config,
  type ModelRunner,
  type PermissionDecision,
} from "@termcoder/core";

export interface ServerDeps {
  config?: Config;
  store?: SessionStore;
  registry?: ToolRegistry;
  /** Override the model call (tests / custom providers). */
  runner?: ModelRunner;
  /** Default working directory for new sessions. */
  cwd?: string;
}

interface Ctx {
  config: Config;
  store: SessionStore;
  registry: ToolRegistry;
  runner?: ModelRunner;
  cwd: string;
}

/**
 * A headless HTTP + WebSocket server wrapping the core engine. HTTP manages
 * session resources; the WebSocket streams a turn's events and carries the
 * permission round-trip. The same core powers the TUI, so behavior matches.
 */
export function createServer(deps: ServerDeps = {}): Server {
  const ctx: Ctx = {
    config: deps.config ?? loadConfig(),
    store: deps.store ?? new SessionStore(),
    registry: deps.registry ?? new ToolRegistry(),
    runner: deps.runner,
    cwd: deps.cwd ?? process.cwd(),
  };

  const http = createHttpServer((req, res) => {
    handleHttp(req, res, ctx).catch((err) => sendJson(res, 500, { error: String(err) }));
  });

  const wss = new WebSocketServer({ server: http });
  wss.on("connection", (ws, req) => handleSocket(ws, req, ctx));

  return http;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", ...CORS });
  res.end(payload);
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/** A permission manager used only for resource calls that never prompt. */
function inertPermission(config: Config): PermissionManager {
  return new PermissionManager(config.permission, async () => "deny");
}

async function handleHttp(req: IncomingMessage, res: ServerResponse, ctx: Ctx): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return void res.end();
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "POST" && parts.length === 1 && parts[0] === "sessions") {
    const body = await readJson(req);
    const session = Session.create(
      { ...ctx, permission: inertPermission(ctx.config) },
      { cwd: typeof body.cwd === "string" ? body.cwd : ctx.cwd, title: body.title as string | undefined },
    );
    return sendJson(res, 201, session.record);
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "sessions") {
    return sendJson(res, 200, ctx.store.list());
  }

  if (req.method === "GET" && parts.length === 2 && parts[0] === "sessions") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    return sendJson(res, 200, ctx.store.load(id));
  }

  // Flattened, render-ready transcript for a saved session.
  if (
    req.method === "GET" &&
    parts.length === 3 &&
    parts[0] === "sessions" &&
    parts[2] === "transcript"
  ) {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    return sendJson(res, 200, transcriptSegments(ctx.store.load(id)));
  }

  // Shareable transcript: HTML by default, Markdown with ?format=md.
  if (
    req.method === "GET" &&
    parts.length === 3 &&
    parts[0] === "sessions" &&
    parts[2] === "share"
  ) {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    const record = ctx.store.load(id);
    const format = url.searchParams.get("format");
    if (format === "md" || format === "markdown") {
      res.writeHead(200, { "content-type": "text/markdown; charset=utf-8", ...CORS });
      return void res.end(renderSessionMarkdown(record));
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...CORS });
    return void res.end(renderSessionHtml(record));
  }

  sendJson(res, 404, { error: "not found" });
}

function handleSocket(ws: WebSocket, req: IncomingMessage, ctx: Ctx): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  // Expect /sessions/:id/stream
  if (parts.length !== 3 || parts[0] !== "sessions" || parts[2] !== "stream") {
    ws.close(1008, "expected /sessions/:id/stream");
    return;
  }
  const sessionId = parts[1]!;
  if (!ctx.store.exists(sessionId)) {
    ws.send(JSON.stringify({ type: "error", error: "session not found" }));
    ws.close(1008, "session not found");
    return;
  }

  const pending = new Map<string, (decision: PermissionDecision) => void>();
  const permission = new PermissionManager(
    ctx.config.permission,
    (request) =>
      new Promise<PermissionDecision>((resolve) => {
        const id = randomUUID();
        pending.set(id, resolve);
        ws.send(JSON.stringify({ type: "permission-request", id, request }));
      }),
  );

  // This connection's registry adds a `task` tool bound to its permission gate;
  // the sub-agent runs against ctx.registry (no task tool — single-level delegation).
  const registry = new ToolRegistry([
    ...ctx.registry.list(),
    createSubagentTool({
      store: ctx.store,
      registry: ctx.registry,
      config: ctx.config,
      permission,
      runner: ctx.runner,
    }),
  ]);

  let running = false;

  async function runPrompt(text: string): Promise<void> {
    if (running) {
      ws.send(JSON.stringify({ type: "error", error: "a prompt is already running" }));
      return;
    }
    running = true;
    try {
      const session = Session.resume({ ...ctx, registry, permission }, sessionId);
      for await (const event of session.prompt(text)) {
        ws.send(JSON.stringify(event));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", error: String(err) }));
    } finally {
      running = false;
    }
  }

  ws.on("message", (raw) => {
    let msg: { type?: string; text?: string; id?: string; decision?: PermissionDecision };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "invalid JSON message" }));
      return;
    }
    if (msg.type === "prompt" && typeof msg.text === "string") {
      void runPrompt(msg.text);
    } else if (msg.type === "permission-decision" && msg.id && msg.decision) {
      const resolve = pending.get(msg.id);
      if (resolve) {
        pending.delete(msg.id);
        resolve(msg.decision);
      }
    }
  });
}
