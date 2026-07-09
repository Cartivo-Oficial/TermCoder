import { render } from "ink";
import {
  builtinTools,
  connectLspServers,
  connectMcpServers,
  loadConfig,
  loadPlugins,
  ToolRegistry,
} from "@termcoder/core";
import { App } from "./app";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(
      "termcoder — an AI coding agent in your terminal\n\n" +
        "Usage: term            (or: termcoder)\n" +
        "  Run it in any project folder to open the panel.\n\n" +
        "Install: npm install -g @termcoder/tui\n" +
        "Set an API key first, e.g. ANTHROPIC_API_KEY (or use a free model — see the README).\n" +
        "Configure via .termcoder/config.json or ~/.config/termcoder/config.json.\n",
    );
    return;
  }

  const cwd = process.env.INIT_CWD ?? process.cwd();
  const config = loadConfig({ cwd });

  const provider = config.model.split("/")[0];
  const hasKey =
    provider === "ollama" ||
    Boolean(
      process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GEMINI_API_KEY,
    ) ||
    Object.values(config.providers).some((p) => p.apiKey);
  if (!hasKey) {
    process.stderr.write(
      "[termcoder] No model credentials found. Use a free option — e.g. set " +
        '`model` to "ollama/llama3.1" (local) or "google/gemini-2.0-flash" with a free ' +
        "GEMINI_API_KEY. See the README.\n",
    );
  }

  const mcp = await connectMcpServers(config);
  const lsp = await connectLspServers(config, cwd);
  const plugins = await loadPlugins(config.plugins, { config, cwd });
  const registry = new ToolRegistry([
    ...builtinTools,
    ...mcp.tools,
    ...lsp.tools,
    ...plugins.tools,
  ]);
  const notices = [
    ...mcp.servers.map((s) =>
      s.ok
        ? `MCP "${s.name}" connected — ${s.toolCount} tool(s).`
        : `MCP "${s.name}" failed to connect: ${s.error}`,
    ),
    ...lsp.servers.map((s) =>
      s.ok ? `LSP "${s.name}" started.` : `LSP "${s.name}" failed to start: ${s.error}`,
    ),
    ...plugins.plugins.map((p) =>
      p.ok ? `Plugin "${p.name}" loaded — ${p.toolCount} tool(s).` : `Plugin "${p.name}" failed: ${p.error}`,
    ),
    ...plugins.logs,
  ];

  const app = render(<App config={config} cwd={cwd} registry={registry} notices={notices} />, {
    exitOnCtrlC: true,
  });
  await app.waitUntilExit();
  await Promise.all([mcp.close(), lsp.close()]);
}

void main();
