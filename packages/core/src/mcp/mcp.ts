import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { jsonSchema } from "ai";
import type { Config, McpServerConfig } from "../config/config";
import type { TermTool } from "../tools/types";

export interface McpConnectResult {
  tools: TermTool[];
  servers: Array<{ name: string; ok: boolean; toolCount: number; error?: string }>;
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
  return new StreamableHTTPClientTransport(new URL(cfg.url));
}

export async function connectMcpServers(config: Config): Promise<McpConnectResult> {
  const entries = Object.entries(config.mcp).filter(([, cfg]) => cfg.enabled);
  const clients: Client[] = [];
  const servers: McpConnectResult["servers"] = [];
  const tools: TermTool[] = [];

  for (const [name, cfg] of entries) {
    try {
      const client = new Client({ name: "termcoder", version: "0.0.0" });
      await client.connect(makeTransport(cfg));
      clients.push(client);
      const wrapped = await wrapClientTools(name, client as unknown as McpClientLike);
      tools.push(...wrapped);
      servers.push({ name, ok: true, toolCount: wrapped.length });
    } catch (err) {
      servers.push({ name, ok: false, toolCount: 0, error: String(err) });
    }
  }

  return {
    tools,
    servers,
    close: async () => {
      await Promise.all(clients.map((c) => c.close().catch(() => undefined)));
    },
  };
}
