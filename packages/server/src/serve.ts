import { builtinTools, connectMcpServers, loadConfig, ToolRegistry } from "@termcoder/core";
import { createServer } from "./server";

const port = Number(process.env.PORT ?? 4096);

async function main() {
  const config = loadConfig();
  const mcp = await connectMcpServers(config);
  for (const s of mcp.servers) {
    process.stdout.write(
      s.ok
        ? `MCP "${s.name}" connected — ${s.toolCount} tool(s).\n`
        : `MCP "${s.name}" failed: ${s.error}\n`,
    );
  }
  const registry = new ToolRegistry([...builtinTools, ...mcp.tools]);

  const server = createServer({ config, registry });
  server.listen(port, () => {
    process.stdout.write(`termcoder server listening on http://localhost:${port}\n`);
    process.stdout.write(
      "  POST /sessions · GET /sessions · GET /sessions/:id · WS /sessions/:id/stream\n",
    );
  });

  const shutdown = () => {
    void mcp.close().finally(() => server.close(() => process.exit(0)));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
