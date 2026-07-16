import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  CheckpointManager,
  checkpointDir,
  createSubagentTool,
  discoverAgents,
  discoverCommands,
  discoverMemories,
  discoverSkills,
  saveMemory,
  deleteMemory,
  expandCommand,
  getModelCatalog,
  completeCode,
  agentCanMutate,
  loadConfig,
  saveConfig,
  readGlobalConfig,
  writeGlobalConfig,
  listConnectors,
  getConnector,
  connectorToServerConfig,
  missingRequiredInputs,
  PermissionManager,
  renderSessionHtml,
  renderSessionMarkdown,
  sessionGistFiles,
  importSessionFromGist,
  GitHubClient,
  GitHubError,
  publishPack,
  installPack,
  syncAll,
  pushSessions,
  pullSessions,
  CONNECTABLE_PROVIDERS,
  probeProvider,
  providerHealthSnapshot,
  providerInfo,
  friendlyError,
  beginClaudeLogin,
  completeClaudeLogin,
  saveClaudeOAuth,
  beginChatGPTLogin,
  pollChatGPTLogin,
  saveChatGPTOAuth,
  deckSummaries,
  dueCards,
  gradeCard,
  addCards,
  generateFlashcards,
  recordReview,
  loadProgress,
  reviewsToday,
  type Grade,
  runAutonomous,
  detectVerifyCommand,
  createClassroom,
  joinClassroom,
  fetchClassroom,
  addAssignment,
  submitAssignment,
  listSubmissions,
  listRoster,
  gradeSubmission,
  listGrades,
  loadClassrooms,
  Session,
  SessionStore,
  ToolRegistry,
  transcribeAudio,
  transcriptSegments,
  discoverRecipes,
  saveRecipe,
  deleteRecipe,
  getRecipe,
  composeRecipeRun,
  licenseStatus,
  saveLicenseKey,
  type LicenseInfo,
  type RecipeAudience,
  type RecipeScope,
  type Config,
  type ModelRunner,
  type PermissionDecision,
} from "@termcoder/core";

export interface ServerStatus {
  mcp: Array<{ name: string; ok: boolean; toolCount: number; error?: string; connected?: boolean; reconnects?: number }>;
  lsp: Array<{ name: string; ok: boolean; error?: string }>;
  plugins: Array<{ name: string; ok: boolean; toolCount: number; error?: string }>;
}

export interface ServerDeps {
  config?: Config;
  store?: SessionStore;
  registry?: ToolRegistry;
  runner?: ModelRunner;
  cwd?: string;
  status?: ServerStatus;
  webDir?: string;
  license?: () => LicenseInfo;
}

// A live room = every socket attached to one session. One shared agent runner;
// its events, presence, and chat broadcast to all participants. Enables
// "salas ao vivo" with the host running this server (LAN / tunnel) — no new infra.
interface Room {
  id: string;
  sockets: Set<WebSocket>;
  names: Map<WebSocket, string>;
  peers: Map<WebSocket, string>; // per-socket peer id, for WebRTC signaling
  running: boolean;
  controller: AbortController | null;
  pending: Map<string, (decision: PermissionDecision) => void>;
  permission: PermissionManager;
  registry: ToolRegistry;
}

interface Ctx {
  config: Config;
  store: SessionStore;
  registry: ToolRegistry;
  runner?: ModelRunner;
  cwd: string;
  status: ServerStatus;
  webDir?: string;
  rooms: Map<string, Room>;
  license: () => LicenseInfo;
}

export function createServer(deps: ServerDeps = {}): Server {
  const ctx: Ctx = {
    config: deps.config ?? loadConfig(),
    store: deps.store ?? new SessionStore(),
    registry: deps.registry ?? new ToolRegistry(),
    runner: deps.runner,
    cwd: deps.cwd ?? process.cwd(),
    status: deps.status ?? { mcp: [], lsp: [], plugins: [] },
    webDir: deps.webDir,
    rooms: new Map(),
    license: deps.license ?? (() => licenseStatus()),
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
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type",
};

let claudeVerifier: string | null = null;
let chatgptLogin: { state: string; error?: string } = { state: "idle" };

function hasKey(config: Config, env: NodeJS.ProcessEnv, provider: string): boolean {
  if (provider === "ollama" || provider === "pollinations" || provider === "termcoderfree") return true; // keyless
  if (config.providers[provider]?.apiKey) return true;
  if (config.providers[provider]?.oauth) return true;
  if (provider === "anthropic") return Boolean(env.ANTHROPIC_API_KEY);
  if (provider === "openai") return Boolean(env.OPENAI_API_KEY);
  if (provider === "google") return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY);
  return false;
}

function agentMarkdown(body: Record<string, unknown>): string {
  const lines = ["---"];
  if (typeof body.description === "string" && body.description.trim()) {
    lines.push(`description: ${body.description.trim().replace(/\n/g, " ")}`);
  }
  lines.push(`mode: ${body.mode === "primary" || body.mode === "subagent" ? body.mode : "all"}`);
  if (typeof body.model === "string" && body.model.trim()) lines.push(`model: ${body.model.trim()}`);
  if (body.readOnly) {
    lines.push("permission:", "  write: deny", "  edit: deny", "  bash: deny", "  mcp: deny");
  } else if (Array.isArray(body.editPaths)) {
    const globs = (body.editPaths as unknown[])
      .filter((g): g is string => typeof g === "string" && g.trim() !== "")
      .map((g) => g.trim());
    if (globs.length) {
      const map = `{ ${['"**": deny', ...globs.map((g) => `"${g}": allow`)].join(", ")} }`;
      lines.push("permission:", `  edit: ${map}`, `  write: ${map}`);
    }
  }
  lines.push("---");
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  return `${lines.join("\n")}\n${prompt}\n`;
}

function skillMarkdown(body: Record<string, unknown>): string {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim().replace(/\n/g, " ") : "";
  const content = typeof body.body === "string" ? body.body.trim() : "";
  return `---\nname: ${name}\ndescription: ${description}\n---\n${content}\n`;
}

function providerStatus(ctx: Ctx): Array<{ name: string; configured: boolean }> {
  const env = process.env;
  return [
    { name: "anthropic", configured: hasKey(ctx.config, env, "anthropic") },
    { name: "openai", configured: hasKey(ctx.config, env, "openai") },
    { name: "google", configured: hasKey(ctx.config, env, "google") },
    { name: "ollama", configured: true },
    { name: "termcoderfree", configured: true },
  ];
}

function redactConfig(config: Config) {
  const providers: Record<string, { hasKey: boolean; baseURL?: string }> = {};
  for (const [name, p] of Object.entries(config.providers)) {
    providers[name] = { hasKey: Boolean(p.apiKey || p.oauth), baseURL: p.baseURL };
  }
  return {
    model: config.model,
    theme: config.theme,
    keybinds: config.keybinds,
    permission: config.permission,
    providers,
    mcp: config.mcp,
    lsp: config.lsp,
    formatter: config.formatter,
    github: { hasToken: Boolean(config.github?.token) },
    context: config.context,
  };
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function serveStatic(res: ServerResponse, webDir: string, pathname: string): boolean {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\]|\.\.[/\\])+/, "");
  let file = join(webDir, rel || "index.html");
  if (!file.startsWith(webDir)) return false; // path-traversal guard
  if (!existsSync(file) || !statSync(file).isFile()) {
    if (extname(rel)) return false; // a missing asset — not an SPA route
    file = join(webDir, "index.html"); // SPA fallback
    if (!existsSync(file)) return false;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", ...CORS });
  res.end(readFileSync(file));
  return true;
}

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

function inertPermission(config: Config): PermissionManager {
  return new PermissionManager(config.permission, async () => "deny");
}

async function withGitHub(
  res: ServerResponse,
  ctx: Ctx,
  fn: (client: GitHubClient) => Promise<unknown>,
): Promise<void> {
  let client: GitHubClient;
  try {
    client = GitHubClient.fromConfig(ctx.config);
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 400;
    return sendJson(res, status, { error: err instanceof Error ? err.message : String(err) });
  }
  try {
    return sendJson(res, 200, await fn(client));
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 400;
    return sendJson(res, status, { error: err instanceof Error ? err.message : String(err) });
  }
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
      {
        cwd: typeof body.cwd === "string" ? body.cwd : ctx.cwd,
        title: body.title as string | undefined,
        mode: body.mode === "plan" || body.mode === "build" ? body.mode : undefined,
        agent: typeof body.agent === "string" ? body.agent : undefined,
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
        maxSteps: typeof body.maxSteps === "number" ? body.maxSteps : undefined,
      },
    );
    return sendJson(res, 201, session.record);
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "sessions") {
    return sendJson(res, 200, ctx.store.list());
  }

  if (req.method === "DELETE" && parts.length === 1 && parts[0] === "sessions") {
    const removed = ctx.store.deleteAll();
    return sendJson(res, 200, { removed });
  }

  if (req.method === "DELETE" && parts.length === 2 && parts[0] === "sessions") {
    const id = parts[1]!;
    const removed = ctx.store.delete(id);
    return sendJson(res, removed ? 200 : 404, removed ? { id } : { error: "session not found" });
  }

  if (req.method === "POST" && parts.length === 1 && parts[0] === "transcribe") {
    const body = await readJson(req);
    const audioB64 = typeof body.audio === "string" ? body.audio : "";
    const mediaType = typeof body.mediaType === "string" ? body.mediaType : "audio/wav";
    if (!audioB64) return sendJson(res, 400, { error: "missing audio" });
    try {
      const audio = new Uint8Array(Buffer.from(audioB64, "base64"));
      const text = await transcribeAudio({ config: ctx.config, audio, mediaType });
      return sendJson(res, 200, { text });
    } catch (err) {
      return sendJson(res, 400, { error: String(err instanceof Error ? err.message : err) });
    }
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "status") {
    return sendJson(res, 200, { model: ctx.config.model, providers: providerStatus(ctx), ...ctx.status });
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "license") {
    return sendJson(res, 200, ctx.license());
  }
  if (req.method === "POST" && parts.length === 1 && parts[0] === "license") {
    const body = await readJson(req);
    const key = typeof body.key === "string" ? body.key : "";
    const info = saveLicenseKey(key);
    return sendJson(res, info.active ? 200 : 400, info);
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "agents") {
    const agents = discoverAgents({ config: ctx.config, cwd: ctx.cwd }).map((a) => ({
      name: a.name,
      description: a.description,
      mode: a.mode,
      model: a.model,
      color: a.color,
      builtin: Boolean(a.builtin),
      readOnly: !agentCanMutate(a),
    }));
    return sendJson(res, 200, agents);
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "recipes") {
    const cwd = url.searchParams.get("cwd") || ctx.cwd;
    return sendJson(res, 200, discoverRecipes({ cwd }));
  }

  if (req.method === "POST" && parts.length === 1 && parts[0] === "recipes") {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name : "";
    const steps = Array.isArray(body.steps) ? body.steps.filter((s): s is string => typeof s === "string") : [];
    if (!name.trim() || steps.length === 0) return sendJson(res, 400, { error: "name and at least one step required" });
    const cwd = typeof body.cwd === "string" && body.cwd ? body.cwd : ctx.cwd;
    const scope: RecipeScope = body.scope === "user" ? "user" : "project";
    const audience: RecipeAudience =
      body.audience === "dev" || body.audience === "study" ? body.audience : "any";
    try {
      const r = saveRecipe({
        scope,
        name,
        description: typeof body.description === "string" ? body.description : "",
        audience,
        steps,
        cwd,
      });
      return sendJson(res, 200, r);
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (req.method === "GET" && parts.length === 3 && parts[0] === "recipes" && parts[2] === "run") {
    const cwd = url.searchParams.get("cwd") || ctx.cwd;
    const r = getRecipe(decodeURIComponent(parts[1]!), { cwd });
    if (!r) return sendJson(res, 404, { error: "recipe not found" });
    return sendJson(res, 200, { prompt: composeRecipeRun(r), recipe: r });
  }

  if (req.method === "DELETE" && parts.length === 2 && parts[0] === "recipes") {
    const cwd = url.searchParams.get("cwd") || ctx.cwd;
    const removed = deleteRecipe({ name: decodeURIComponent(parts[1]!), cwd });
    return sendJson(res, removed ? 200 : 404, removed ? { ok: true } : { error: "recipe not found" });
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "models") {
    const env = process.env;
    const catalog = await getModelCatalog({ config: ctx.config });
    const withConfigured = catalog.map((e) => ({
      ...e,
      configured:
        e.provider === "ollama" || e.provider === "termcoder" || e.provider === "termexplorer"
          ? true
          : hasKey(ctx.config, env, e.provider),
    }));
    return sendJson(res, 200, withConfigured);
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "study") {
    const p = loadProgress();
    return sendJson(res, 200, { decks: deckSummaries(), streak: p.streak, reviewsToday: reviewsToday() });
  }
  if (req.method === "GET" && parts.length === 2 && parts[0] === "study" && parts[1] === "due") {
    const deck = url.searchParams.get("deck") ?? "";
    return sendJson(res, 200, dueCards(deck));
  }
  if (req.method === "POST" && parts.length === 2 && parts[0] === "study" && parts[1] === "grade") {
    const body = await readJson(req);
    const deck = typeof body.deck === "string" ? body.deck : "";
    const cardId = typeof body.cardId === "string" ? body.cardId : "";
    const grade = Math.max(0, Math.min(5, Number(body.grade) || 0)) as Grade;
    const card = gradeCard(deck, cardId, grade);
    if (card) recordReview();
    return sendJson(res, 200, { ok: Boolean(card), card });
  }
  if (req.method === "POST" && parts.length === 2 && parts[0] === "study" && parts[1] === "generate") {
    const body = await readJson(req);
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (!topic) return sendJson(res, 400, { error: "missing 'topic'" });
    const deck = typeof body.deck === "string" && body.deck.trim() ? body.deck.trim() : topic.slice(0, 40);
    try {
      const cards = await generateFlashcards({ topic, config: ctx.config });
      if (!cards.length) {
        return sendJson(res, 502, { error: "The free model didn't return cards — try again, or connect a key." });
      }
      addCards(deck, cards);
      return sendJson(res, 200, { deck, added: cards.length });
    } catch {
      return sendJson(res, 502, { error: "Couldn't reach the model (the free service can be busy). Try again." });
    }
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "classrooms") {
    return sendJson(res, 200, loadClassrooms());
  }
  if (req.method === "POST" && parts.length === 1 && parts[0] === "classroom") {
    const body = await readJson(req);
    const action = body.action;
    const code = typeof body.code === "string" ? body.code : "";
    const needsPro = action === "create" || action === "assign" || action === "grade";
    if (needsPro && !ctx.license().active) {
      return sendJson(res, 402, { error: "termcoder Pro is required to host a classroom.", upgrade: true });
    }
    return withGitHub(res, ctx, async (client) => {
      if (action === "create") {
        if (!body.name) throw new GitHubError(400, "missing 'name'");
        return await createClassroom(String(body.name), client);
      }
      if (action === "join") {
        if (!code) throw new GitHubError(400, "missing 'code'");
        return await joinClassroom(code, client, { cwd: ctx.cwd });
      }
      if (action === "fetch") return await fetchClassroom(code, client);
      if (action === "assign") {
        if (!body.title) throw new GitHubError(400, "missing 'title'");
        return await addAssignment(code, { title: String(body.title), description: body.description as string | undefined, due: body.due as string | undefined }, client);
      }
      if (action === "submit") {
        return await submitAssignment(code, { assignmentId: String(body.assignmentId ?? ""), link: String(body.link ?? ""), note: body.note as string | undefined }, client).then(() => ({ ok: true }));
      }
      if (action === "submissions") return await listSubmissions(code, client, body.assignmentId as string | undefined);
      if (action === "roster") return await listRoster(code, client);
      if (action === "grade") {
        if (!body.assignmentId || !body.user || !body.grade) throw new GitHubError(400, "missing grade fields");
        return await gradeSubmission(code, {
          assignmentId: String(body.assignmentId),
          user: String(body.user),
          grade: String(body.grade),
          feedback: body.feedback as string | undefined,
        }, client).then(() => ({ ok: true }));
      }
      if (action === "grades") return await listGrades(code, client, body.assignmentId as string | undefined);
      throw new GitHubError(400, "unknown classroom action");
    });
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "providers") {
    const env = process.env;
    const snapshot = providerHealthSnapshot();
    return sendJson(
      res,
      200,
      CONNECTABLE_PROVIDERS.map((p) => {
        const h = snapshot[p.provider];
        const fresh = h && Date.now() <= h.until;
        return {
          ...p,
          configured: hasKey(ctx.config, env, p.provider),
          keyUrl: providerInfo(p.provider)?.keyUrl,
          freeTier: providerInfo(p.provider)?.freeTier,
          health: !fresh ? "unknown" : h.ok ? "ok" : "bad",
          error: fresh && !h.ok && h.error ? friendlyError(h.error) : undefined,
        };
      }),
    );
  }

  if (req.method === "POST" && parts.length === 2 && parts[0] === "providers" && parts[1] === "probe") {
    const body = await readJson(req);
    const provider = typeof body.provider === "string" ? body.provider : "";
    if (!provider || !providerInfo(provider)) return sendJson(res, 400, { error: "unknown provider" });
    const result = await probeProvider(provider, { config: ctx.config });
    return sendJson(res, 200, result.ok ? result : { ok: false, error: friendlyError(result.error ?? "no response") });
  }

  if (req.method === "POST" && parts.length === 3 && parts[0] === "auth" && parts[1] === "claude" && parts[2] === "start") {
    const { url, verifier } = beginClaudeLogin();
    claudeVerifier = verifier;
    return sendJson(res, 200, { url });
  }

  if (req.method === "POST" && parts.length === 3 && parts[0] === "auth" && parts[1] === "claude" && parts[2] === "complete") {
    const body = await readJson(req);
    if (!claudeVerifier) return sendJson(res, 400, { error: "start the login first" });
    try {
      const creds = await completeClaudeLogin(String(body.code ?? ""), claudeVerifier);
      saveClaudeOAuth(creds);
      claudeVerifier = null;
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (req.method === "POST" && parts.length === 3 && parts[0] === "auth" && parts[1] === "chatgpt" && parts[2] === "start") {
    try {
      const grant = await beginChatGPTLogin();
      chatgptLogin = { state: "pending" };
      pollChatGPTLogin(grant.deviceCode, { intervalMs: grant.interval * 1000 })
        .then((creds) => {
          saveChatGPTOAuth(creds);
          chatgptLogin = { state: "connected" };
        })
        .catch((err) => {
          chatgptLogin = { state: "failed", error: err instanceof Error ? err.message : String(err) };
        });
      return sendJson(res, 200, { verificationUri: grant.verificationUri, userCode: grant.userCode });
    } catch (err) {
      return sendJson(res, 502, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (req.method === "GET" && parts.length === 3 && parts[0] === "auth" && parts[1] === "chatgpt" && parts[2] === "status") {
    return sendJson(res, 200, chatgptLogin);
  }

  if (req.method === "POST" && parts.length === 1 && parts[0] === "complete") {
    const body = await readJson(req);
    const prefix = typeof body.prefix === "string" ? body.prefix : "";
    const suffix = typeof body.suffix === "string" ? body.suffix : "";
    if (!prefix.trim()) return sendJson(res, 200, { text: "" });
    try {
      const text = await completeCode({
        config: ctx.config,
        prefix,
        suffix,
        language: typeof body.language === "string" ? body.language : undefined,
      });
      return sendJson(res, 200, { text });
    } catch {
      return sendJson(res, 200, { text: "" });
    }
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "commands") {
    const cmds = discoverCommands({ cwd: ctx.cwd }).map((c) => ({
      name: c.name,
      description: c.description,
      agent: c.agent,
      model: c.model,
    }));
    return sendJson(res, 200, cmds);
  }

  if (req.method === "POST" && parts.length === 2 && parts[0] === "commands" && parts[1] === "expand") {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name : "";
    const args = typeof body.args === "string" ? body.args : "";
    const cmd = discoverCommands({ cwd: ctx.cwd }).find((c) => c.name === name);
    if (!cmd) return sendJson(res, 404, { error: "command not found" });
    const prompt = expandCommand(cmd.template, args, ctx.cwd);
    return sendJson(res, 200, { prompt, agent: cmd.agent, model: cmd.model });
  }

  if (req.method === "POST" && parts.length === 1 && parts[0] === "agents") {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") : "";
    if (!name) return sendJson(res, 400, { error: "agent name required" });
    const dir = join(ctx.cwd, ".termcoder", "agents");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.md`), agentMarkdown(body), "utf8");
    return sendJson(res, 201, { name });
  }

  if (req.method === "DELETE" && parts.length === 2 && parts[0] === "agents") {
    const name = parts[1]!;
    const file = join(ctx.cwd, ".termcoder", "agents", `${name}.md`);
    if (!existsSync(file)) return sendJson(res, 404, { error: "custom agent not found" });
    rmSync(file, { force: true });
    return sendJson(res, 200, { name });
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "skills") {
    const skills = discoverSkills({ cwd: ctx.cwd }).map((s) => ({
      name: s.name,
      description: s.description,
      source: s.source,
    }));
    return sendJson(res, 200, skills);
  }

  if (req.method === "POST" && parts.length === 1 && parts[0] === "skills") {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") : "";
    if (!name) return sendJson(res, 400, { error: "skill name required" });
    const dir = join(ctx.cwd, ".termcoder", "skills");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.md`), skillMarkdown({ ...body, name }), "utf8");
    return sendJson(res, 201, { name });
  }

  if (req.method === "DELETE" && parts.length === 2 && parts[0] === "skills") {
    const name = parts[1]!;
    const file = join(ctx.cwd, ".termcoder", "skills", `${name}.md`);
    if (!existsSync(file)) return sendJson(res, 404, { error: "skill not found" });
    rmSync(file, { force: true });
    return sendJson(res, 200, { name });
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "memory") {
    const memories = discoverMemories({ cwd: ctx.cwd }).map((m) => ({
      name: m.name, description: m.description, type: m.type, scope: m.scope, body: m.body,
    }));
    return sendJson(res, 200, { memories });
  }
  if (req.method === "POST" && parts.length === 1 && parts[0] === "memory") {
    const body = await readJson(req);
    try {
      const m = saveMemory({
        scope: body.scope === "user" ? "user" : "project",
        name: String(body.name ?? ""),
        description: String(body.description ?? ""),
        type: ["project", "preference", "decision"].includes(body.type as string) ? (body.type as "project" | "preference" | "decision") : "project",
        body: String(body.body ?? ""),
        cwd: ctx.cwd,
      });
      return sendJson(res, 200, { ok: true, name: m.name });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (req.method === "DELETE" && parts.length === 2 && parts[0] === "memory") {
    const removed = deleteMemory({ name: parts[1]!, cwd: ctx.cwd });
    return sendJson(res, 200, { ok: removed });
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "config") {
    return sendJson(res, 200, redactConfig(ctx.config));
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "connectors") {
    return sendJson(res, 200, { connectors: listConnectors() });
  }

  if (req.method === "GET" && parts.length === 2 && parts[0] === "room" && parts[1] === "addresses") {
    const host = typeof req.headers.host === "string" ? req.headers.host : "";
    const port = host.includes(":") ? host.split(":").pop() ?? "" : "";
    return sendJson(res, 200, { addresses: lanAddresses(), port, rooms: ctx.rooms.size });
  }

  if (req.method === "POST" && parts.length === 1 && parts[0] === "mcp") {
    const body = await readJson(req);
    try {
      let name: string;
      let entry: Record<string, unknown>;
      if (typeof body.connectorId === "string") {
        // One-click connector: build the server config from the catalog.
        const connector = getConnector(body.connectorId);
        if (!connector) return sendJson(res, 400, { error: `unknown connector "${body.connectorId}"` });
        const values = (body.values ?? {}) as Record<string, string>;
        const missing = missingRequiredInputs(connector, values);
        if (missing.length) {
          return sendJson(res, 400, { error: `missing required input(s): ${missing.map((i) => i.key).join(", ")}` });
        }
        entry = connectorToServerConfig(connector, values) as unknown as Record<string, unknown>;
        name = (typeof body.name === "string" && body.name.trim()) || connector.id;
      } else {
        name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) return sendJson(res, 400, { error: "missing name" });
        entry =
          body.type === "http"
            ? {
                type: "http",
                url: String(body.url ?? ""),
                enabled: true,
                ...(body.headers && typeof body.headers === "object" ? { headers: body.headers } : {}),
              }
            : {
                type: "stdio",
                command: String(body.command ?? ""),
                args: Array.isArray(body.args) ? body.args.map(String) : [],
                enabled: true,
                ...(body.env && typeof body.env === "object" ? { env: body.env } : {}),
              };
      }
      const raw = readGlobalConfig();
      const mcp = { ...(raw.mcp as Record<string, unknown> | undefined), [name]: entry };
      writeGlobalConfig({ ...raw, mcp });
      ctx.config = loadConfig({ cwd: ctx.cwd });
      return sendJson(res, 200, { ok: true, needsRestart: true, mcp: ctx.config.mcp });
    } catch (err) {
      return sendJson(res, 400, { error: String(err instanceof Error ? err.message : err) });
    }
  }

  if (parts.length >= 2 && parts[0] === "mcp") {
    const name = parts[1]!;
    const raw = readGlobalConfig();
    const mcp = { ...(raw.mcp as Record<string, Record<string, unknown>> | undefined) };
    if (!mcp[name]) return sendJson(res, 404, { error: "mcp server not found" });
    if (req.method === "DELETE" && parts.length === 2) {
      delete mcp[name];
    } else if (req.method === "POST" && parts.length === 3 && parts[2] === "toggle") {
      mcp[name] = { ...mcp[name], enabled: mcp[name]!.enabled === false };
    } else {
      return sendJson(res, 404, { error: "not found" });
    }
    try {
      writeGlobalConfig({ ...raw, mcp });
      ctx.config = loadConfig({ cwd: ctx.cwd });
      return sendJson(res, 200, { ok: true, needsRestart: true, mcp: ctx.config.mcp });
    } catch (err) {
      return sendJson(res, 400, { error: String(err instanceof Error ? err.message : err) });
    }
  }

  if (req.method === "POST" && parts.length === 1 && parts[0] === "config") {
    const body = await readJson(req);
    try {
      saveConfig(body);
      ctx.config = loadConfig({ cwd: ctx.cwd });
      return sendJson(res, 200, {
        ok: true,
        model: ctx.config.model,
        providers: providerStatus(ctx),
        config: redactConfig(ctx.config),
      });
    } catch (err) {
      return sendJson(res, 400, { error: String(err instanceof Error ? err.message : err) });
    }
  }

  if (req.method === "GET" && parts.length === 2 && parts[0] === "sessions") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    return sendJson(res, 200, ctx.store.load(id));
  }

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

  if (req.method === "POST" && parts.length === 3 && parts[0] === "sessions" && parts[2] === "model") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    const body = await readJson(req);
    const record = ctx.store.load(id);
    if (typeof body.model === "string" && body.model) {
      record.model = body.model;
      ctx.store.save(record);
    }
    return sendJson(res, 200, { model: record.model });
  }

  if (req.method === "POST" && parts.length === 3 && parts[0] === "sessions" && parts[2] === "settings") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    const body = await readJson(req);
    const record = ctx.store.load(id);
    if (body.mode === "plan" || body.mode === "build") {
      record.mode = body.mode;
    }
    if (typeof body.agent === "string") {
      record.agent = body.agent;
    }
    if (typeof body.temperature === "number") {
      record.temperature = Math.min(2, Math.max(0, body.temperature));
    }
    if (typeof body.maxSteps === "number") {
      record.maxSteps = Math.min(100, Math.max(1, Math.round(body.maxSteps)));
    }
    ctx.store.save(record);
    return sendJson(res, 200, {
      mode: record.mode,
      agent: record.agent,
      temperature: record.temperature,
      maxSteps: record.maxSteps,
    });
  }

  if (req.method === "POST" && parts.length === 3 && parts[0] === "sessions" && parts[2] === "title") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    const body = await readJson(req);
    const record = ctx.store.load(id);
    if (typeof body.title === "string" && body.title.trim()) {
      record.title = body.title.trim().slice(0, 80);
      ctx.store.save(record);
    }
    return sendJson(res, 200, { title: record.title });
  }

  if (req.method === "GET" && parts.length === 3 && parts[0] === "sessions" && parts[2] === "checkpoint") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    const record = ctx.store.load(id);
    const cm = new CheckpointManager(checkpointDir(record.cwd, id));
    return sendJson(res, 200, { hasCheckpoint: cm.hasLatest() });
  }

  if (req.method === "POST" && parts.length === 3 && parts[0] === "sessions" && parts[2] === "revert") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    const record = ctx.store.load(id);
    const cm = new CheckpointManager(checkpointDir(record.cwd, id));
    const restored = cm.revertLatest();
    return sendJson(res, 200, { restored });
  }

  if (req.method === "POST" && parts.length === 3 && parts[0] === "sessions" && parts[2] === "gist") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    const body = await readJson(req);
    const record = ctx.store.load(id);
    return withGitHub(res, ctx, async (client) => {
      const gist = await client.createGist({
        description: `termcoder session — ${record.title}`,
        public: body.public === true,
        files: sessionGistFiles(record),
      });
      return {
        url: gist.html_url,
        id: gist.id,
        viewer: `https://cartivo-oficial.github.io/TermCoder/viewer.html?gist=${gist.id}`,
      };
    });
  }

  if (req.method === "GET" && parts.length === 1 && parts[0] === "github") {
    return withGitHub(res, ctx, async (client) => ({ user: await client.whoami() }));
  }

  if (req.method === "POST" && parts.length === 2 && parts[0] === "sessions" && parts[1] === "import") {
    const body = await readJson(req);
    const ref = typeof body.ref === "string" ? body.ref : "";
    if (!ref) return sendJson(res, 400, { error: "missing 'ref' (a gist id or URL)" });
    return withGitHub(res, ctx, async (client) => {
      const record = await importSessionFromGist(ref, client, ctx.store);
      return record;
    });
  }

  if (req.method === "POST" && parts.length === 1 && parts[0] === "packs") {
    const body = await readJson(req);
    const action = body.action;
    return withGitHub(res, ctx, async (client) => {
      if (action === "publish") {
        const cwd = typeof body.cwd === "string" ? body.cwd : ctx.cwd;
        const manifest = {
          name: typeof body.name === "string" ? body.name : "pack",
          description: typeof body.description === "string" ? body.description : undefined,
          author: typeof body.author === "string" ? body.author : undefined,
        };
        const url = await publishPack(manifest, join(cwd, ".termcoder"), client, { public: body.public === true });
        return { url };
      }
      if (action === "install") {
        const ref = typeof body.ref === "string" ? body.ref : "";
        if (!ref) throw new GitHubError(400, "missing 'ref'");
        const target = body.target === "global" ? "global" : "project";
        const cwd = typeof body.cwd === "string" ? body.cwd : ctx.cwd;
        return await installPack(ref, client, { target, cwd });
      }
      throw new GitHubError(400, "unknown pack action (expected publish|install)");
    });
  }

  if (req.method === "POST" && parts.length === 2 && parts[0] === "sync") {
    const op = parts[1];
    return withGitHub(res, ctx, async (client) => {
      if (op === "push") return await syncAll(client).then(() => ({ ok: true }));
      if (op === "pull") {
        const { pulled } = await syncAll(client);
        return { pulled };
      }
      throw new GitHubError(400, "unknown sync op (expected push|pull)");
    });
  }

  if (req.method === "POST" && parts.length === 2 && parts[0] === "sessions" && parts[1] === "sync") {
    if (!ctx.license().active) {
      return sendJson(res, 402, { error: "termcoder Pro is required to sync sessions across devices.", upgrade: true });
    }
    return withGitHub(res, ctx, async (client) => {
      const pulled = await pullSessions(ctx.store, client);
      const pushed = await pushSessions(ctx.store, client);
      return { pulled, pushed };
    });
  }

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

  if ((req.method === "GET" || req.method === "HEAD") && ctx.webDir && serveStatic(res, ctx.webDir, url.pathname)) {
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const iface of Object.values(networkInterfaces())) {
    for (const info of iface ?? []) {
      if (info.family === "IPv4" && !info.internal) out.push(info.address);
    }
  }
  return out;
}

function roomBroadcast(room: Room, msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const s of room.sockets) {
    if (s.readyState === 1 /* OPEN */) s.send(data);
  }
}

function roomPeerList(room: Room): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = [];
  for (const s of room.sockets) {
    out.push({ id: room.peers.get(s) ?? "", name: room.names.get(s) ?? "" });
  }
  return out;
}

function roomPresence(room: Room): void {
  roomBroadcast(room, {
    type: "room-presence",
    participants: [...room.names.values()],
    peers: roomPeerList(room),
    count: room.sockets.size,
  });
}

function roomSendTo(room: Room, peerId: string, msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const s of room.sockets) {
    if (room.peers.get(s) === peerId && s.readyState === 1 /* OPEN */) {
      s.send(data);
      return;
    }
  }
}

function getRoom(ctx: Ctx, sessionId: string): Room {
  const existing = ctx.rooms.get(sessionId);
  if (existing) return existing;
  const pending = new Map<string, (decision: PermissionDecision) => void>();
  const room = {
    id: sessionId,
    sockets: new Set<WebSocket>(),
    names: new Map<WebSocket, string>(),
    peers: new Map<WebSocket, string>(),
    running: false,
    controller: null as AbortController | null,
    pending,
  } as Room;
  room.permission = new PermissionManager(
    ctx.config.permission,
    (request) =>
      new Promise<PermissionDecision>((resolve) => {
        const id = randomUUID();
        pending.set(id, resolve);
        // Any participant may answer a permission prompt; first response wins.
        roomBroadcast(room, { type: "permission-request", id, request });
      }),
  );
  room.registry = new ToolRegistry([
    ...ctx.registry.list(),
    createSubagentTool({
      store: ctx.store,
      registry: ctx.registry,
      config: ctx.config,
      permission: room.permission,
      runner: ctx.runner,
    }),
  ]);
  ctx.rooms.set(sessionId, room);
  return room;
}

async function roomRunPrompt(
  ctx: Ctx,
  room: Room,
  text: string,
  attachments?: Array<{ dataUrl: string; mediaType: string }>,
): Promise<void> {
  if (room.running) {
    roomBroadcast(room, { type: "error", error: "a prompt is already running" });
    return;
  }
  room.running = true;
  room.controller = new AbortController();
  const signal = room.controller.signal;
  try {
    const session = Session.resume({ ...ctx, registry: room.registry, permission: room.permission }, room.id);
    for await (const event of session.prompt(text, { signal, attachments })) {
      roomBroadcast(room, event);
    }
    if (signal.aborted) roomBroadcast(room, { type: "stopped" });
  } catch (err) {
    roomBroadcast(room, { type: "error", error: String(err) });
  } finally {
    room.running = false;
    room.controller = null;
  }
}

async function roomRunBackground(ctx: Ctx, room: Room, goal: string): Promise<void> {
  if (room.running) {
    roomBroadcast(room, { type: "error", error: "a prompt is already running" });
    return;
  }
  room.running = true;
  room.controller = new AbortController();
  const signal = room.controller.signal;
  room.permission.setAutoApprove(true);
  try {
    const session = Session.resume({ ...ctx, registry: room.registry, permission: room.permission }, room.id);
    const verifyCommand = detectVerifyCommand(session.record.cwd);
    roomBroadcast(room, { type: "background-start", verify: verifyCommand ?? null });
    for await (const ae of runAutonomous({ session, goal, verifyCommand, signal })) {
      if (ae.type === "session") roomBroadcast(room, ae.event);
      else if (ae.type === "round") roomBroadcast(room, { type: "background-round", round: ae.round });
      else if (ae.type === "verify")
        roomBroadcast(room, { type: "background-verify", ok: ae.ok, output: ae.output.slice(-2000) });
      else if (ae.type === "finished")
        roomBroadcast(room, { type: "background-done", status: ae.status, rounds: ae.rounds });
    }
    if (signal.aborted) roomBroadcast(room, { type: "stopped" });
  } catch (err) {
    roomBroadcast(room, { type: "error", error: String(err) });
  } finally {
    room.permission.setAutoApprove(false);
    room.running = false;
    room.controller = null;
  }
}

function handleSocket(ws: WebSocket, req: IncomingMessage, ctx: Ctx): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
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

  const room = getRoom(ctx, sessionId);
  if (room.sockets.size >= 2 && !ctx.license().active) {
    ws.send(JSON.stringify({ type: "room-locked", error: "The host needs termcoder Pro to host more than one guest." }));
    ws.close(1008, "host needs termcoder Pro");
    return;
  }
  const rawName = (url.searchParams.get("name") ?? "").trim().slice(0, 40);
  const name = rawName || `Guest ${room.sockets.size + 1}`;
  const peerId = randomUUID();
  room.sockets.add(ws);
  room.names.set(ws, name);
  room.peers.set(ws, peerId);
  // Tell the joiner who they are + who's already here, then announce to everyone.
  ws.send(
    JSON.stringify({
      type: "room-welcome",
      you: name,
      peerId,
      participants: [...room.names.values()],
      peers: roomPeerList(room),
    }),
  );
  roomPresence(room);

  ws.on("message", (raw) => {
    let msg: {
      type?: string;
      text?: string;
      goal?: string;
      id?: string;
      decision?: PermissionDecision;
      images?: Array<{ dataUrl: string; mediaType: string }>;
      to?: string;
      data?: unknown;
    };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "invalid JSON message" }));
      return;
    }
    if (msg.type === "prompt" && typeof msg.text === "string") {
      // Echo the driver's prompt to everyone so the room sees who asked what.
      roomBroadcast(room, { type: "room-prompt", from: name, text: msg.text });
      void roomRunPrompt(ctx, room, msg.text, Array.isArray(msg.images) ? msg.images : undefined);
    } else if (msg.type === "background" && typeof msg.goal === "string") {
      roomBroadcast(room, { type: "room-prompt", from: name, text: msg.goal });
      void roomRunBackground(ctx, room, msg.goal);
    } else if (msg.type === "chat" && typeof msg.text === "string") {
      roomBroadcast(room, { type: "room-chat", from: name, text: msg.text.slice(0, 4000) });
    } else if (msg.type === "signal" && typeof msg.to === "string") {
      // WebRTC signaling (offer/answer/ICE) — relayed peer-to-peer, never stored.
      roomSendTo(room, msg.to, { type: "signal", from: room.peers.get(ws), data: msg.data });
    } else if (msg.type === "stop") {
      room.controller?.abort();
      for (const [id, resolve] of room.pending) {
        room.pending.delete(id);
        resolve("deny");
      }
    } else if (msg.type === "permission-decision" && msg.id && msg.decision) {
      const resolve = room.pending.get(msg.id);
      if (resolve) {
        room.pending.delete(msg.id);
        resolve(msg.decision);
      }
    }
  });

  ws.on("close", () => {
    const leftPeer = room.peers.get(ws);
    room.sockets.delete(ws);
    room.names.delete(ws);
    room.peers.delete(ws);
    // Tell the room a peer left so others can tear down its WebRTC connection.
    if (leftPeer) roomBroadcast(room, { type: "peer-left", peerId: leftPeer });
    if (room.sockets.size === 0) {
      // Last participant left — abort any run and drop the room.
      room.controller?.abort();
      ctx.rooms.delete(sessionId);
    } else {
      roomPresence(room);
    }
  });
}
