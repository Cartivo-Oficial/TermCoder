import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createMessageConnection,
  NullLogger,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/node.js";
import { z } from "zod";
import type { Config } from "../config/config";
import type { TermTool } from "../tools/types";
import { resolveInside } from "../util/path";

interface Position {
  line: number;
  character: number;
}
interface Range {
  start: Position;
  end: Position;
}
/** A subset of the LSP Diagnostic shape that we surface. */
export interface LspDiagnostic {
  range: Range;
  severity?: number;
  message: string;
  source?: string;
}

const SEVERITY = ["", "error", "warning", "info", "hint"] as const;
function severityName(severity?: number): string {
  return SEVERITY[severity ?? 1] ?? "error";
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".json": "json",
  ".md": "markdown",
};
function languageIdForExt(ext: string): string {
  return LANGUAGE_BY_EXT[ext] ?? ext.replace(/^\./, "");
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

/**
 * A thin LSP client over a JSON-RPC connection. It tracks pushed
 * `publishDiagnostics` per document URI and lets callers open a document and
 * await its diagnostics. Constructed from a {@link MessageConnection} so it can
 * be tested in-process against a fake server.
 */
export class LspClient {
  private readonly byUri = new Map<string, LspDiagnostic[]>();
  private readonly waiters = new Map<string, (diagnostics: LspDiagnostic[]) => void>();
  private readonly versions = new Map<string, number>();

  constructor(private readonly conn: MessageConnection) {
    conn.onNotification("textDocument/publishDiagnostics", (params: unknown) => {
      const p = params as { uri: string; diagnostics?: LspDiagnostic[] };
      const diagnostics = p.diagnostics ?? [];
      this.byUri.set(p.uri, diagnostics);
      const waiter = this.waiters.get(p.uri);
      if (waiter) {
        this.waiters.delete(p.uri);
        waiter(diagnostics);
      }
    });
    conn.listen();
  }

  async initialize(rootUri: string): Promise<void> {
    await this.conn.sendRequest("initialize", {
      processId: process.pid,
      rootUri,
      capabilities: { textDocument: { publishDiagnostics: {} } },
      workspaceFolders: null,
    });
    await this.conn.sendNotification("initialized", {});
  }

  /** Open (or update) a document and wait for its diagnostics, or time out. */
  async diagnostics(
    uri: string,
    languageId: string,
    text: string,
    timeoutMs = 2500,
  ): Promise<LspDiagnostic[]> {
    const arrived = new Promise<LspDiagnostic[]>((resolve) => this.waiters.set(uri, resolve));
    const version = (this.versions.get(uri) ?? 0) + 1;
    this.versions.set(uri, version);

    if (version === 1) {
      await this.conn.sendNotification("textDocument/didOpen", {
        textDocument: { uri, languageId, version, text },
      });
    } else {
      await this.conn.sendNotification("textDocument/didChange", {
        textDocument: { uri, version },
        contentChanges: [{ text }],
      });
    }

    const timeout = new Promise<LspDiagnostic[]>((resolve) =>
      setTimeout(() => resolve(this.byUri.get(uri) ?? []), timeoutMs),
    );
    const result = await Promise.race([arrived, timeout]);
    this.waiters.delete(uri);
    return result;
  }

  dispose(): void {
    this.conn.dispose();
  }
}

export interface LspServerHandle {
  name: string;
  client: LspClient;
  extensions: string[];
}

/**
 * Routes diagnostics requests to the right language server by file extension and
 * exposes a single read-only `diagnostics` tool to the agent.
 */
export class LspManager {
  constructor(
    private readonly handles: LspServerHandle[],
    private readonly cwd: string,
  ) {}

  private forExt(ext: string): LspServerHandle | undefined {
    return this.handles.find((h) => h.extensions.includes(ext));
  }

  async diagnostics(relPath: string): Promise<string> {
    const abs = resolveInside(this.cwd, relPath);
    const ext = extname(abs);
    const handle = this.forExt(ext);
    if (!handle) return `No LSP server configured for "${ext}" files.`;

    const text = readFileSync(abs, "utf8");
    const uri = pathToFileURL(abs).href;
    const diagnostics = await handle.client.diagnostics(uri, languageIdForExt(ext), text);
    if (diagnostics.length === 0) return `No diagnostics for ${relPath}.`;

    return diagnostics
      .map((d) => {
        const where = `${relPath}:${d.range.start.line + 1}:${d.range.start.character + 1}`;
        const src = d.source ? ` [${d.source}]` : "";
        return `${where} ${severityName(d.severity)}: ${d.message}${src}`;
      })
      .join("\n");
  }

  tool(): TermTool {
    return {
      name: "diagnostics",
      description:
        "Get language-server diagnostics (errors and warnings) for a file in the workspace.",
      inputSchema: z.object({
        path: z.string().describe("File to check, relative to the workspace root."),
      }),
      readOnly: true,
      describe: (args: { path: string }) => ({ title: `diagnostics ${args.path}` }),
      run: async (args: { path: string }) => ({ output: await this.diagnostics(args.path) }),
    };
  }

  async close(): Promise<void> {
    for (const handle of this.handles) handle.client.dispose();
  }
}

export interface LspConnectResult {
  tools: TermTool[];
  servers: Array<{ name: string; ok: boolean; error?: string }>;
  close: () => Promise<void>;
}

/**
 * Launch every enabled language server and build the diagnostics tool. A server
 * that fails to start is recorded but never blocks the others or the agent.
 */
export async function connectLspServers(
  config: Config,
  cwd: string = process.cwd(),
): Promise<LspConnectResult> {
  const handles: LspServerHandle[] = [];
  const children: ChildProcess[] = [];
  const servers: LspConnectResult["servers"] = [];

  for (const [name, cfg] of Object.entries(config.lsp).filter(([, c]) => c.enabled)) {
    let child: ChildProcess | undefined;
    try {
      child = spawn(cfg.command, cfg.args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
      // Surface an immediate spawn failure (e.g. command not found).
      await new Promise<void>((resolve, reject) => {
        const onError = (err: Error) => reject(err);
        child!.once("error", onError);
        setTimeout(() => {
          child!.off("error", onError);
          resolve();
        }, 100);
      });

      const conn = createMessageConnection(
        new StreamMessageReader(child.stdout!),
        new StreamMessageWriter(child.stdin!),
        NullLogger,
      );
      const client = new LspClient(conn);
      await withTimeout(
        client.initialize(pathToFileURL(`${cwd}/`).href),
        5000,
        `LSP "${name}" initialize`,
      );

      handles.push({ name, client, extensions: cfg.extensions });
      children.push(child);
      servers.push({ name, ok: true });
    } catch (err) {
      child?.kill();
      servers.push({ name, ok: false, error: String(err) });
    }
  }

  const manager = new LspManager(handles, cwd);
  return {
    tools: handles.length ? [manager.tool()] : [],
    servers,
    close: async () => {
      await manager.close();
      for (const c of children) c.kill();
    },
  };
}
