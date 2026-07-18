import type { McpServerConfig } from "../config/config";

// A connector input is one value the user supplies when adding a server.
// - "arg":    appended (in declared order) to the stdio command's args
// - "env":    set as an environment variable (key = the var name)
// - "header": set as an HTTP request header (key = the header name; prefix like "Bearer ")
export type ConnectorInputKind = "arg" | "env" | "header";

export interface ConnectorInput {
  key: string;
  label: string;
  kind: ConnectorInputKind;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  prefix?: string;
}

export interface McpConnector {
  id: string;
  name: string;
  description: string;
  category: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  inputs?: ConnectorInput[];
  runtime?: string;
  docsUrl?: string;
}

// Curated one-click connectors. Package names verified against the npm registry;
// the hosted GitHub endpoint is GitHub's official MCP server. This is a starting
// convenience — a server that fails to launch surfaces a clear error to edit.
const CONNECTORS: McpConnector[] = [
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read and write files under a folder you choose.",
    category: "Files",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    inputs: [{ key: "root", label: "Folder to expose", kind: "arg", required: true, placeholder: "/path/to/project" }],
    runtime: "Node (npx)",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
  },
  {
    id: "git",
    name: "Git",
    description: "Inspect and operate on a Git repository.",
    category: "Dev",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-git", "--repository"],
    inputs: [{ key: "repo", label: "Repository path", kind: "arg", required: true, placeholder: "/path/to/repo" }],
    runtime: "Python (uvx)",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
  },
  {
    id: "fetch",
    name: "Web fetch",
    description: "Fetch a URL and return its content as clean markdown.",
    category: "Web",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-fetch"],
    runtime: "Python (uvx)",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
  },
  {
    id: "memory",
    name: "Knowledge graph memory",
    description: "A persistent knowledge-graph memory the agent can read and update.",
    category: "Memory",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    runtime: "Node (npx)",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
  },
  {
    id: "sequential-thinking",
    name: "Sequential thinking",
    description: "A structured step-by-step reasoning scratchpad tool.",
    category: "Reasoning",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    runtime: "Node (npx)",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
  },
  {
    id: "github",
    name: "GitHub",
    description: "GitHub's hosted MCP server — issues, PRs, code, and more. Needs a personal access token.",
    category: "Dev",
    transport: "http",
    url: "https://api.githubcopilot.com/mcp/",
    inputs: [
      {
        key: "Authorization",
        label: "GitHub personal access token",
        kind: "header",
        prefix: "Bearer ",
        required: true,
        secret: true,
        placeholder: "ghp_…",
      },
    ],
    runtime: "Hosted",
    docsUrl: "https://github.com/github/github-mcp-server",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Query a PostgreSQL database (read-only).",
    category: "Data",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    inputs: [
      { key: "conn", label: "Connection string", kind: "arg", required: true, placeholder: "postgresql://user:pass@host/db" },
    ],
    runtime: "Node (npx)",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Web and local search via the Brave Search API.",
    category: "Web",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    inputs: [{ key: "BRAVE_API_KEY", label: "Brave Search API key", kind: "env", required: true, secret: true }],
    runtime: "Node (npx)",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Read and post to Slack channels.",
    category: "Comms",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    inputs: [
      { key: "SLACK_BOT_TOKEN", label: "Slack bot token", kind: "env", required: true, secret: true, placeholder: "xoxb-…" },
      { key: "SLACK_TEAM_ID", label: "Slack team ID", kind: "env", required: true, placeholder: "T01234567" },
    ],
    runtime: "Node (npx)",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
  },
  {
    id: "puppeteer",
    name: "Browser (Puppeteer)",
    description: "Drive a headless browser — navigate, screenshot, and scrape pages.",
    category: "Automation",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    runtime: "Node (npx)",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
  },
];

export function listConnectors(): McpConnector[] {
  return CONNECTORS.map((c) => ({ ...c }));
}

export function getConnector(id: string): McpConnector | undefined {
  const c = CONNECTORS.find((x) => x.id === id);
  return c ? { ...c } : undefined;
}

export function missingRequiredInputs(connector: McpConnector, values: Record<string, string>): ConnectorInput[] {
  return (connector.inputs ?? []).filter((i) => i.required && !((values[i.key] ?? "").trim()));
}

// Build a valid McpServerConfig entry from a connector + the user's input values.
export function connectorToServerConfig(connector: McpConnector, values: Record<string, string> = {}): McpServerConfig {
  const inputs = connector.inputs ?? [];
  if (connector.transport === "http") {
    if (!connector.url) throw new Error(`Connector "${connector.id}" has no url.`);
    const headers: Record<string, string> = {};
    for (const input of inputs) {
      if (input.kind !== "header") continue;
      const val = (values[input.key] ?? "").trim();
      if (val) headers[input.key] = `${input.prefix ?? ""}${val}`;
    }
    return {
      type: "http",
      url: connector.url,
      enabled: true,
      ...(Object.keys(headers).length ? { headers } : {}),
    };
  }
  if (!connector.command) throw new Error(`Connector "${connector.id}" has no command.`);
  const args = [...(connector.args ?? [])];
  const env: Record<string, string> = {};
  for (const input of inputs) {
    const val = (values[input.key] ?? "").trim();
    if (input.kind === "arg") {
      if (val) args.push(val);
    } else if (input.kind === "env") {
      if (val) env[input.key] = val;
    }
  }
  return {
    type: "stdio",
    command: connector.command,
    args,
    enabled: true,
    ...(Object.keys(env).length ? { env } : {}),
  };
}

export interface ConnectorRef {
  id: string;
  inputs: Record<string, string>;
}

export function resolveConnector(ref: ConnectorRef): McpServerConfig | null {
  const connector = getConnector(ref.id);
  if (!connector) return null;
  const inputs = ref.inputs ?? {};
  if (missingRequiredInputs(connector, inputs).length > 0) return null;
  return { ...connectorToServerConfig(connector, inputs), enabled: false };
}
