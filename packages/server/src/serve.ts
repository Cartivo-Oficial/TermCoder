import {
  builtinTools,
  connectLspServers,
  connectMcpServers,
  loadConfig,
  loadPlugins,
  ToolRegistry,
} from "@termcoder/core";
import { createServer } from "./server";

const port = Number(process.env.PORT ?? 4096);

async function main() {
  const config = loadConfig();
  const cwd = process.cwd();
  const mcp = await connectMcpServers(config);
  const lsp = await connectLspServers(config, cwd);
  for (const s of mcp.servers) {
    process.stdout.write(
      s.ok
        ? `MCP "${s.name}" connected — ${s.toolCount} tool(s).\n`
        : `MCP "${s.name}" failed: ${s.error}\n`,
    );
  }
  for (const s of lsp.servers) {
    process.stdout.write(s.ok ? `LSP "${s.name}" started.\n` : `LSP "${s.name}" failed: ${s.error}\n`);
  }
  const plugins = await loadPlugins(config.plugins, { config, cwd });
  for (const p of plugins.plugins) {
    process.stdout.write(
      p.ok ? `Plugin "${p.name}" loaded — ${p.toolCount} tool(s).\n` : `Plugin "${p.name}" failed: ${p.error}\n`,
    );
  }
  const registry = new ToolRegistry([
    ...builtinTools,
    ...mcp.tools,
    ...lsp.tools,
    ...plugins.tools,
  ]);

  const server = createServer({ config, registry, cwd });
  server.listen(port, () => {
    process.stdout.write(`termcoder server listening on http://localhost:${port}\n`);
    process.stdout.write(
      "  POST /sessions · GET /sessions · GET /sessions/:id · WS /sessions/:id/stream\n",
    );
  });

  const shutdown = () => {
    void Promise.all([mcp.close(), lsp.close()]).finally(() =>
      server.close(() => process.exit(0)),
    );
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
