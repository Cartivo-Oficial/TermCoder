import { render } from "ink";
import { builtinTools, connectMcpServers, loadConfig, ToolRegistry } from "@termcoder/core";
import { App } from "./app";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(
      "termcoder — an AI coding agent in your terminal\n\n" +
        "Usage: termcoder\n\n" +
        "Set an API key first, e.g. ANTHROPIC_API_KEY.\n" +
        "Configure via .termcoder/config.json or ~/.config/termcoder/config.json.\n",
    );
    return;
  }

  const config = loadConfig();
  const cwd = process.cwd();

  const hasKey =
    Boolean(process.env.ANTHROPIC_API_KEY) ||
    Boolean(process.env.OPENAI_API_KEY) ||
    Object.values(config.providers).some((p) => p.apiKey);
  if (!hasKey) {
    process.stderr.write(
      "[termcoder] No API key found. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) so the agent can run.\n",
    );
  }

  // Connect any configured MCP servers and fold their tools into the registry.
  const mcp = await connectMcpServers(config);
  const registry = new ToolRegistry([...builtinTools, ...mcp.tools]);
  const notices = mcp.servers.map((s) =>
    s.ok
      ? `MCP "${s.name}" connected — ${s.toolCount} tool(s).`
      : `MCP "${s.name}" failed to connect: ${s.error}`,
  );

  const app = render(<App config={config} cwd={cwd} registry={registry} notices={notices} />, {
    exitOnCtrlC: true,
  });
  await app.waitUntilExit();
  await mcp.close();
}

void main();
