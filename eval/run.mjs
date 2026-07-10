import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinTools, loadConfig, ToolRegistry } from "../packages/core/dist/index.js";
import { createServer } from "../packages/server/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};

const MODEL = arg("model", "termcoderfree/auto");
const ONLY = arg("task", "");
const TURN_TIMEOUT = Number(arg("timeout", "600")) * 1000;

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadTasks() {
  const root = join(here, "tasks");
  return readdirSync(root)
    .filter((name) => !ONLY || name === ONLY)
    .map((name) => {
      const spec = JSON.parse(readFileSync(join(root, name, "task.json"), "utf8"));
      return { name, dir: join(root, name), ...spec };
    });
}

async function runTurn(port, sessionId, prompt) {
  const stats = { toolCalls: 0, tokens: 0, leakedToolNames: 0, text: "" };
  const ws = new WebSocket(`ws://localhost:${port}/sessions/${sessionId}/stream`);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("turn timed out")), TURN_TIMEOUT);
    ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "prompt", text: prompt })));
    ws.addEventListener("message", (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === "permission-request") {
        ws.send(JSON.stringify({ type: "permission-decision", id: ev.id, decision: "allow" }));
      } else if (ev.type === "tool-call") {
        stats.toolCalls++;
        if (typeof ev.name === "string" && ev.name.includes("<|")) stats.leakedToolNames++;
      } else if (ev.type === "text-delta") {
        stats.text += ev.text ?? "";
      } else if (ev.type === "usage") {
        stats.tokens += (ev.inputTokens ?? 0) + (ev.outputTokens ?? 0);
      } else if (ev.type === "done") {
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
  return stats;
}

async function runTask(task) {
  const cwd = mkdtempSync(join(tmpdir(), `tc-eval-${task.name}-`));
  cpSync(join(task.dir, "seed"), cwd, { recursive: true });

  const before = Object.fromEntries((task.protect ?? []).map((p) => [p, hashFile(join(cwd, p))]));

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
  await fetch(`http://localhost:${port}/sessions/${rec.id}/model`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL }),
  });

  const start = Date.now();
  let error = null;
  let stats = { toolCalls: 0, tokens: 0, leakedToolNames: 0 };
  try {
    stats = await runTurn(port, rec.id, task.prompt);
  } catch (err) {
    error = err.message;
  }
  const ms = Date.now() - start;
  server.close();

  const tamperedTest = (task.protect ?? []).some((p) => hashFile(join(cwd, p)) !== before[p]);

  let verifyPass = false;
  let verifyOut = "";
  try {
    const [cmd, ...cmdArgs] = task.verify.split(" ");
    verifyOut = execFileSync(cmd, cmdArgs, { cwd, encoding: "utf8", timeout: 30_000 });
    verifyPass = true;
  } catch (err) {
    verifyOut = (err.stdout || "") + (err.stderr || err.message || "");
  }

  rmSync(cwd, { recursive: true, force: true });

  const pass = verifyPass && !tamperedTest && !error;
  return {
    task: task.name,
    pass,
    verifyPass,
    tamperedTest,
    error,
    toolCalls: stats.toolCalls,
    tokens: stats.tokens,
    leakedToolNames: stats.leakedToolNames,
    seconds: Math.round(ms / 1000),
  };
}

const tasks = loadTasks();
console.log(`\neval · model=${MODEL} · ${tasks.length} task(s)\n`);

const results = [];
for (const task of tasks) {
  process.stdout.write(`  ${task.name} … `);
  const r = await runTask(task);
  results.push(r);
  const mark = r.pass ? "PASS" : "FAIL";
  const why = r.pass
    ? ""
    : r.tamperedTest
    ? " (edited the test)"
    : r.error
    ? ` (${r.error.slice(0, 40)})`
    : " (verify failed)";
  console.log(`${mark}${why} · ${r.toolCalls} tools · ${r.seconds}s · leak=${r.leakedToolNames}`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\nSCORE ${passed}/${results.length} · model=${MODEL}`);
console.log(JSON.stringify({ model: MODEL, passed, total: results.length, results }));
process.exit(0);
