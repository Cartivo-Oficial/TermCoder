import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  discoverSkills,
  expandCommand,
  getModelCatalog,
  completeCode,
  agentCanMutate,
  loadConfig,
  saveConfig,
  readGlobalConfig,
  writeGlobalConfig,
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
  CONNECTABLE_PROVIDERS,
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
  Session,
  SessionStore,
  ToolRegistry,
  transcribeAudio,
  transcriptSegments,
  type Config,
  type ModelRunner,
  type PermissionDecision,
} from "@termcoder/core";

export interface ServerStatus {
  mcp: Array<{ name: string; ok: boolean; toolCount: number; error?: string }>;
  lsp: Array<{ name: string; ok: boolean; error?: string }>;
  plugins: Array<{ name: string; ok: boolean; toolCount: number; error?: string }>;
}

export interface ServerDeps {
  config?: Config;
  store?: SessionStore;
  registry?: ToolRegistry;
  /** Override the model call (tests / custom providers). */
  runner?: ModelRunner;
  /** Default working directory for new sessions. */
  cwd?: string;
  /** MCP/LSP/plugin connection status to expose at GET /status. */
  status?: ServerStatus;
}

interface Ctx {
  config: Config;
  store: SessionStore;
  registry: ToolRegistry;
  runner?: ModelRunner;
  cwd: string;
  status: ServerStatus;
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
    status: deps.status ?? { mcp: [], lsp: [], plugins: [] },
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

function hasKey(config: Config, env: NodeJS.ProcessEnv, provider: string): boolean {
  if (provider === "ollama" || provider === "pollinations") return true; // keyless
  if (config.providers[provider]?.apiKey) return true;
  if (provider === "anthropic") return Boolean(env.ANTHROPIC_API_KEY);
  if (provider === "openai") return Boolean(env.OPENAI_API_KEY);
  if (provider === "google") return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY);
  return false;
}

/** Build a `.md` agent file from the builder form fields. */
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
    // Restrict writes/edits to an allowlist of globs: deny everything, then
    // re-allow the listed paths (later matches win).
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
    { name: "pollinations", configured: true },
  ];
}

/** Config for the settings UI with API keys masked to a boolean. */
function redactConfig(config: Config) {
  const providers: Record<string, { hasKey: boolean; baseURL?: string }> = {};
  for (const [name, p] of Object.entries(config.providers)) {
    providers[name] = { hasKey: Boolean(p.apiKey), baseURL: p.baseURL };
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

/**
 * Build a GitHub client from config and run a call, turning a missing token or
 * a GitHub API error into the right JSON status instead of a 500.
 */
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

  // Delete every session at once.
  if (req.method === "DELETE" && parts.length === 1 && parts[0] === "sessions") {
    const removed = ctx.store.deleteAll();
    return sendJson(res, 200, { removed });
  }

  // Delete a single session by id.
  if (req.method === "DELETE" && parts.length === 2 && parts[0] === "sessions") {
    const id = parts[1]!;
    const removed = ctx.store.delete(id);
    return sendJson(res, removed ? 200 : 404, removed ? { id } : { error: "session not found" });
  }

  // Transcribe a short audio clip via the configured multimodal model.
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

  // Available agents (built-ins + custom) for the agent picker.
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

  // Model catalog (Models.dev + local Ollama + fallback) for the model browser.
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

  // ---- Study (flashcards) ----
  // Overview: every deck (with due counts) + the study streak.
  if (req.method === "GET" && parts.length === 1 && parts[0] === "study") {
    const p = loadProgress();
    return sendJson(res, 200, { decks: deckSummaries(), streak: p.streak, reviewsToday: reviewsToday() });
  }
  // Cards due for review in a deck.
  if (req.method === "GET" && parts.length === 2 && parts[0] === "study" && parts[1] === "due") {
    const deck = url.searchParams.get("deck") ?? "";
    return sendJson(res, 200, dueCards(deck));
  }
  // Grade a reviewed card (also records a review for the streak).
  if (req.method === "POST" && parts.length === 2 && parts[0] === "study" && parts[1] === "grade") {
    const body = await readJson(req);
    const deck = typeof body.deck === "string" ? body.deck : "";
    const cardId = typeof body.cardId === "string" ? body.cardId : "";
    const grade = Math.max(0, Math.min(5, Number(body.grade) || 0)) as Grade;
    const card = gradeCard(deck, cardId, grade);
    if (card) recordReview();
    return sendJson(res, 200, { ok: Boolean(card), card });
  }
  // Generate flashcards about a topic and add them to a deck.
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

  // Connectable providers + their login methods (for the "Connect" UI).
  if (req.method === "GET" && parts.length === 1 && parts[0] === "providers") {
    const env = process.env;
    return sendJson(
      res,
      200,
      CONNECTABLE_PROVIDERS.map((p) => ({ ...p, configured: hasKey(ctx.config, env, p.provider) })),
    );
  }

  // Inline editor autocomplete (Copilot-style ghost text).
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

  // Available slash commands.
  if (req.method === "GET" && parts.length === 1 && parts[0] === "commands") {
    const cmds = discoverCommands({ cwd: ctx.cwd }).map((c) => ({
      name: c.name,
      description: c.description,
      agent: c.agent,
      model: c.model,
    }));
    return sendJson(res, 200, cmds);
  }

  // Expand a command template (args + shell + @file) into the final prompt.
  if (req.method === "POST" && parts.length === 2 && parts[0] === "commands" && parts[1] === "expand") {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name : "";
    const args = typeof body.args === "string" ? body.args : "";
    const cmd = discoverCommands({ cwd: ctx.cwd }).find((c) => c.name === name);
    if (!cmd) return sendJson(res, 404, { error: "command not found" });
    const prompt = expandCommand(cmd.template, args, ctx.cwd);
    return sendJson(res, 200, { prompt, agent: cmd.agent, model: cmd.model });
  }

  // Create/update a custom agent as a markdown file in .termcoder/agents/.
  if (req.method === "POST" && parts.length === 1 && parts[0] === "agents") {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") : "";
    if (!name) return sendJson(res, 400, { error: "agent name required" });
    const dir = join(ctx.cwd, ".termcoder", "agents");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.md`), agentMarkdown(body), "utf8");
    return sendJson(res, 201, { name });
  }

  // Delete a custom agent file.
  if (req.method === "DELETE" && parts.length === 2 && parts[0] === "agents") {
    const name = parts[1]!;
    const file = join(ctx.cwd, ".termcoder", "agents", `${name}.md`);
    if (!existsSync(file)) return sendJson(res, 404, { error: "custom agent not found" });
    rmSync(file, { force: true });
    return sendJson(res, 200, { name });
  }

  // Available skills (project + global) — names/descriptions for the UI.
  if (req.method === "GET" && parts.length === 1 && parts[0] === "skills") {
    const skills = discoverSkills({ cwd: ctx.cwd }).map((s) => ({
      name: s.name,
      description: s.description,
      source: s.source,
    }));
    return sendJson(res, 200, skills);
  }

  // Create/update a skill as a markdown file in .termcoder/skills/.
  if (req.method === "POST" && parts.length === 1 && parts[0] === "skills") {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") : "";
    if (!name) return sendJson(res, 400, { error: "skill name required" });
    const dir = join(ctx.cwd, ".termcoder", "skills");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.md`), skillMarkdown({ ...body, name }), "utf8");
    return sendJson(res, 201, { name });
  }

  // Delete a project skill file.
  if (req.method === "DELETE" && parts.length === 2 && parts[0] === "skills") {
    const name = parts[1]!;
    const file = join(ctx.cwd, ".termcoder", "skills", `${name}.md`);
    if (!existsSync(file)) return sendJson(res, 404, { error: "skill not found" });
    rmSync(file, { force: true });
    return sendJson(res, 200, { name });
  }

  // Read the live config (without secrets) for the settings UI.
  if (req.method === "GET" && parts.length === 1 && parts[0] === "config") {
    return sendJson(res, 200, redactConfig(ctx.config));
  }

  // Add or update an MCP server (takes effect on next app start).
  if (req.method === "POST" && parts.length === 1 && parts[0] === "mcp") {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return sendJson(res, 400, { error: "missing name" });
    try {
      const entry =
        body.type === "http"
          ? { type: "http", url: String(body.url ?? ""), enabled: true }
          : {
              type: "stdio",
              command: String(body.command ?? ""),
              args: Array.isArray(body.args) ? body.args.map(String) : [],
              enabled: true,
            };
      const raw = readGlobalConfig();
      const mcp = { ...(raw.mcp as Record<string, unknown> | undefined), [name]: entry };
      writeGlobalConfig({ ...raw, mcp });
      ctx.config = loadConfig({ cwd: ctx.cwd });
      return sendJson(res, 200, { ok: true, needsRestart: true, mcp: ctx.config.mcp });
    } catch (err) {
      return sendJson(res, 400, { error: String(err instanceof Error ? err.message : err) });
    }
  }

  // Toggle / delete an MCP server.
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

  // Persist a partial config to the global file and hot-reload it.
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

  // Change the model used by a saved session.
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

  // Update agent settings (temperature, maxSteps) for a saved session.
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

  // Rename a saved session.
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

  // Whether the last turn left a revertable checkpoint.
  if (req.method === "GET" && parts.length === 3 && parts[0] === "sessions" && parts[2] === "checkpoint") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    const record = ctx.store.load(id);
    const cm = new CheckpointManager(checkpointDir(record.cwd, id));
    return sendJson(res, 200, { hasCheckpoint: cm.hasLatest() });
  }

  // Revert the files changed in the last turn.
  if (req.method === "POST" && parts.length === 3 && parts[0] === "sessions" && parts[2] === "revert") {
    const id = parts[1]!;
    if (!ctx.store.exists(id)) return sendJson(res, 404, { error: "session not found" });
    const record = ctx.store.load(id);
    const cm = new CheckpointManager(checkpointDir(record.cwd, id));
    const restored = cm.revertLatest();
    return sendJson(res, 200, { restored });
  }

  // Publish the session transcript as a secret GitHub Gist; return its URL.
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

  // Who is the configured GitHub token? (validates the token.)
  if (req.method === "GET" && parts.length === 1 && parts[0] === "github") {
    return withGitHub(res, ctx, async (client) => ({ user: await client.whoami() }));
  }

  // Import a session shared as a gist (by id or URL) into the local store.
  if (req.method === "POST" && parts.length === 2 && parts[0] === "sessions" && parts[1] === "import") {
    const body = await readJson(req);
    const ref = typeof body.ref === "string" ? body.ref : "";
    if (!ref) return sendJson(res, 400, { error: "missing 'ref' (a gist id or URL)" });
    return withGitHub(res, ctx, async (client) => {
      const record = await importSessionFromGist(ref, client, ctx.store);
      return record;
    });
  }

  // Publish or install a pack of custom agents/skills/commands.
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

  // Push/pull/sync per-user stores (favorites, drafts, …) via the sync gist.
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
  let controller: AbortController | null = null;

  async function runPrompt(
    text: string,
    attachments?: Array<{ dataUrl: string; mediaType: string }>,
  ): Promise<void> {
    if (running) {
      ws.send(JSON.stringify({ type: "error", error: "a prompt is already running" }));
      return;
    }
    running = true;
    controller = new AbortController();
    const signal = controller.signal;
    try {
      const session = Session.resume({ ...ctx, registry, permission }, sessionId);
      for await (const event of session.prompt(text, { signal, attachments })) {
        ws.send(JSON.stringify(event));
      }
      // A cancelled turn ends the generator without a "done"; tell the client.
      if (signal.aborted) ws.send(JSON.stringify({ type: "stopped" }));
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", error: String(err) }));
    } finally {
      running = false;
      controller = null;
    }
  }

  // Autonomous mode: run to the goal without asking, then verify (tests/build)
  // and keep fixing until it passes or the round budget runs out.
  async function runBackground(goal: string): Promise<void> {
    if (running) {
      ws.send(JSON.stringify({ type: "error", error: "a prompt is already running" }));
      return;
    }
    running = true;
    controller = new AbortController();
    const signal = controller.signal;
    permission.setAutoApprove(true);
    try {
      const session = Session.resume({ ...ctx, registry, permission }, sessionId);
      const verifyCommand = detectVerifyCommand(session.record.cwd);
      ws.send(JSON.stringify({ type: "background-start", verify: verifyCommand ?? null }));
      for await (const ae of runAutonomous({ session, goal, verifyCommand, signal })) {
        if (ae.type === "session") ws.send(JSON.stringify(ae.event));
        else if (ae.type === "round") ws.send(JSON.stringify({ type: "background-round", round: ae.round }));
        else if (ae.type === "verify")
          ws.send(JSON.stringify({ type: "background-verify", ok: ae.ok, output: ae.output.slice(-2000) }));
        else if (ae.type === "finished")
          ws.send(JSON.stringify({ type: "background-done", status: ae.status, rounds: ae.rounds }));
      }
      if (signal.aborted) ws.send(JSON.stringify({ type: "stopped" }));
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", error: String(err) }));
    } finally {
      permission.setAutoApprove(false);
      running = false;
      controller = null;
    }
  }

  ws.on("message", (raw) => {
    let msg: {
      type?: string;
      text?: string;
      goal?: string;
      id?: string;
      decision?: PermissionDecision;
      images?: Array<{ dataUrl: string; mediaType: string }>;
    };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "invalid JSON message" }));
      return;
    }
    if (msg.type === "prompt" && typeof msg.text === "string") {
      void runPrompt(msg.text, Array.isArray(msg.images) ? msg.images : undefined);
    } else if (msg.type === "background" && typeof msg.goal === "string") {
      void runBackground(msg.goal);
    } else if (msg.type === "stop") {
      // Abort any in-flight turn; also release a pending permission prompt.
      controller?.abort();
      for (const [id, resolve] of pending) {
        pending.delete(id);
        resolve("deny");
      }
    } else if (msg.type === "permission-decision" && msg.id && msg.decision) {
      const resolve = pending.get(msg.id);
      if (resolve) {
        pending.delete(msg.id);
        resolve(msg.decision);
      }
    }
  });

  ws.on("close", () => controller?.abort());
}
