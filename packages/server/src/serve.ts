import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  builtinTools,
  connectLspServers,
  connectMcpServers,
  loadConfig,
  loadPlugins,
  ToolRegistry,
} from "@termcoder/core";
import { apiHost, isLanHost } from "./host";
import { createServer } from "./server";

const port = Number(process.env.PORT ?? 4096);

function findWebDir(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.TERMCODER_WEB_DIR,
    resolve(here, "../../desktop/dist-web"),
    resolve(here, "web"),
  ].filter((d): d is string => Boolean(d));
  return candidates.find((d) => existsSync(d));
}

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

  const webDir = findWebDir();
  const status = {
    mcp: mcp.servers,
    lsp: lsp.servers,
    plugins: plugins.plugins,
  };
  const server = createServer({ config, registry, cwd, webDir, status });
  server.listen(port, apiHost(), () => {
    if (isLanHost(apiHost())) {
      process.stderr.write(
        `WARNING: HOST=${apiHost()} exposes the termcoder server on the network with NO authentication. Anyone who can reach this host can control your sessions. Use only on a trusted network.\n`,
      );
    }
    process.stdout.write(`termcoder server listening on http://localhost:${port}\n`);
    if (webDir) {
      process.stdout.write(`  🌐 Web app: open http://localhost:${port} in your browser\n`);
    } else {
      process.stdout.write(
        "  POST /sessions · GET /sessions · GET /sessions/:id · WS /sessions/:id/stream\n" +
          "  (build the web app with `pnpm --filter @termcoder/desktop build:web` to serve it here)\n",
      );
    }
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
