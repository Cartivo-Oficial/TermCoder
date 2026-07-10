import { writeFileSync } from "node:fs";
import { builtinTools, loadConfig, ToolRegistry } from "../../packages/core/dist/index.js";
import { createServer } from "../../packages/server/dist/index.js";

const cwd = process.argv[2];
const prompt = process.argv[3];
const model = process.argv[4];

if (!cwd || !prompt) {
  console.error("usage: node website/tools/record-session.mjs <cwd> <prompt> [model]");
  process.exit(2);
}

const config = loadConfig({ cwd });
const registry = new ToolRegistry([...builtinTools]);
const server = createServer({ config, registry, cwd, status: { mcp: [], lsp: [], plugins: [] } });
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const rec = await (
  await fetch(`http://localhost:${port}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  })
).json();

if (model) {
  await fetch(`http://localhost:${port}/sessions/${rec.id}/model`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model }),
  });
}

function label(ev) {
  const args = ev.args ?? {};
  if (ev.name === "bash") return (ev.detail ?? args.command ?? "").split("\n")[0] || "bash";
  if (args.path) return `${ev.name} ${String(args.path).split(/[\\/]/).pop()}`;
  if (ev.title) return ev.title;
  return ev.name;
}

const lines = [{ kind: "prompt", text: prompt }];
let buf = "";

const flush = () => {
  const text = buf.trim();
  buf = "";
  if (text) lines.push({ kind: "text", text });
};

const ws = new WebSocket(`ws://localhost:${port}/sessions/${rec.id}/stream`);

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out after 240s")), 240_000);
  ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "prompt", text: prompt })));
  ws.addEventListener("message", (e) => {
    const ev = JSON.parse(e.data);
    if (ev.type === "permission-request") {
      ws.send(JSON.stringify({ type: "permission-decision", id: ev.id, decision: "allow" }));
    } else if (ev.type === "tool-call") {
      flush();
      lines.push({ kind: "tool", text: label(ev) });
    } else if (ev.type === "text-delta") {
      buf += ev.text;
    } else if (ev.type === "done") {
      flush();
      clearTimeout(timer);
      resolve();
    } else if (ev.type === "error") {
      clearTimeout(timer);
      reject(new Error(ev.error));
    }
  });
  ws.addEventListener("error", () => {
    clearTimeout(timer);
    reject(new Error("websocket failed"));
  });
});

const data = {
  recorded: new Date().toISOString().slice(0, 10),
  model: model ?? rec.model,
  cwd: "~/my-project",
  prompt,
  lines,
};

writeFileSync(
  new URL("../hero-session.js", import.meta.url),
  `window.HERO_SESSION = ${JSON.stringify(data, null, 2)};\n`,
);

console.log(`recorded ${lines.length} lines with ${data.model}`);
server.close();
process.exit(0);
