import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { jsonSchema } from "ai";
import type { Config, McpServerConfig } from "../config/config";
import type { TermTool } from "../tools/types";
import { abortableDelay, backoffMs } from "../provider/reliability";

export interface McpServerStatus {
  name: string;
  ok: boolean;
  toolCount: number;
  error?: string;
  connected: boolean;
  reconnects: number;
}

export interface McpConnectResult {
  tools: TermTool[];
  servers: McpServerStatus[];
  close: () => Promise<void>;
}

interface RemoteTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: { readOnlyHint?: boolean };
}

export interface McpClientLike {
  listTools(): Promise<{ tools: RemoteTool[] }>;
  callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<{
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }>;
}

function extractText(content: Array<{ type: string; text?: string }> = []): string {
  const parts = content.map((c) =>
    c.type === "text" ? (c.text ?? "") : `[${c.type} content]`,
  );
  return parts.join("\n").trim();
}

function previewArgs(args: unknown): string | undefined {
  if (!args || (typeof args === "object" && Object.keys(args).length === 0)) return undefined;
  const json = JSON.stringify(args);
  return json.length > 200 ? `${json.slice(0, 197)}…` : json;
}

export async function wrapClientTools(
  serverName: string,
  client: McpClientLike,
): Promise<TermTool[]> {
  const { tools } = await client.listTools();
  return tools.map((remote): TermTool => {
    const readOnly = Boolean(remote.annotations?.readOnlyHint);
    return {
      name: `${serverName}_${remote.name}`,
      description: remote.description ?? `${remote.name} (via MCP server "${serverName}")`,
      inputSchema: jsonSchema((remote.inputSchema as object) ?? { type: "object" }),
      readOnly,
      permissionKind: readOnly ? undefined : "mcp",
      describe: (args) => ({
        title: `${serverName}: ${remote.name}`,
        detail: previewArgs(args),
      }),
      run: async (args) => {
        const result = await client.callTool({
          name: remote.name,
          arguments: (args ?? {}) as Record<string, unknown>,
        });
        const text = extractText(result.content);
        if (result.isError) throw new Error(text || `MCP tool "${remote.name}" failed`);
        return { output: text || "(no output)", meta: { server: serverName } };
      },
    };
  });
}

function makeTransport(cfg: McpServerConfig) {
  if (cfg.type === "stdio") {
    return new StdioClientTransport({
      command: cfg.command,
      args: cfg.args,
      env: cfg.env,
    });
  }
  return new StreamableHTTPClientTransport(
    new URL(cfg.url),
    cfg.headers ? { requestInit: { headers: cfg.headers } } : undefined,
  );
}

const DISCONNECT_RE =
  /\bclosed|not\s*connected|econnreset|epipe|socket\s*hang\s*up|disconnect\w*|terminated|transport|broken\s*pipe|econnrefused\b/i;

function looksLikeDisconnect(err: unknown): boolean {
  return DISCONNECT_RE.test(String((err as { message?: string })?.message ?? err));
}

const MAX_RECONNECT_ATTEMPTS = 4;

export class ManagedMcpClient implements McpClientLike {
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;
  private closed = false;
  private connectCount = 0;

  constructor(
    private readonly cfg: McpServerConfig,
    private readonly makeClient: () => Client = () => new Client({ name: "termcoder", version: "0.0.0" }),
    private readonly connectClient: (client: Client, cfg: McpServerConfig) => Promise<void> = (client, c) =>
      client.connect(makeTransport(c)),
  ) {}

  get connected(): boolean {
    return this.client !== null;
  }

  get reconnects(): number {
    return Math.max(0, this.connectCount - 1);
  }

  private async ensure(): Promise<Client> {
    if (this.closed) throw new Error("MCP client closed");
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = this.makeClient();
      await this.connectClient(client, this.cfg);
      client.onclose = () => {
        if (this.client === client) this.client = null;
      };
      this.client = client;
      this.connectCount++;
      return client;
    })().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async reconnect(): Promise<Client> {
    this.client = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_RECONNECT_ATTEMPTS; attempt++) {
      if (this.closed) throw new Error("MCP client closed");
      if (attempt > 0) await abortableDelay(backoffMs(attempt - 1));
      try {
        return await this.ensure();
      } catch (err) {
        lastErr = err;
        this.client = null;
      }
    }
    throw lastErr;
  }

  async listTools(): Promise<{ tools: RemoteTool[] }> {
    const client = await this.ensure();
    return client.listTools() as unknown as Promise<{ tools: RemoteTool[] }>;
  }

  async callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<{
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }> {
    try {
      const client = await this.ensure();
      return (await client.callTool(params)) as {
        content?: Array<{ type: string; text?: string }>;
        isError?: boolean;
      };
    } catch (err) {
      if (this.closed || (this.client !== null && !looksLikeDisconnect(err))) throw err;
      const client = await this.reconnect();
      return (await client.callTool(params)) as {
        content?: Array<{ type: string; text?: string }>;
        isError?: boolean;
      };
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    const client = this.client;
    this.client = null;
    if (client) await client.close().catch(() => undefined);
  }
}

export async function connectMcpServers(config: Config): Promise<McpConnectResult> {
  const entries = Object.entries(config.mcp).filter(([, cfg]) => cfg.enabled);
  const managed: ManagedMcpClient[] = [];
  const servers: McpServerStatus[] = [];
  const tools: TermTool[] = [];

  for (const [name, cfg] of entries) {
    const client = new ManagedMcpClient(cfg);
    managed.push(client);
    try {
      const wrapped = await wrapClientTools(name, client);
      tools.push(...wrapped);
      servers.push({
        name,
        ok: true,
        toolCount: wrapped.length,
        get connected() {
          return client.connected;
        },
        get reconnects() {
          return client.reconnects;
        },
      } as McpServerStatus);
    } catch (err) {
      await client.close().catch(() => undefined);
      servers.push({ name, ok: false, toolCount: 0, error: String(err), connected: false, reconnects: 0 });
    }
  }

  return {
    tools,
    servers,
    close: async () => {
      await Promise.all(managed.map((c) => c.close()));
    },
  };
}
