import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinTools, loadConfig, ToolRegistry } from "../packages/core/dist/index.js";
import { createServer } from "../packages/server/dist/index.js";
import { compareToBaseline, gradeChecks } from "./grade.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};

const MODEL = arg("model", "termcoderfree/auto");
const ONLY = arg("task", "");
const CATEGORY = arg("category", "");
const RUNS = Number(arg("runs", "1"));
const TURN_TIMEOUT = Number(arg("timeout", "300")) * 1000;
const BASELINE = arg("baseline", "");
const SAVE = process.argv.includes("--save");

function median(nums) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadTasks() {
  const root = join(here, "tasks");
  return readdirSync(root)
    .filter((name) => statSync(join(root, name)).isDirectory())
    .filter((name) => !ONLY || name === ONLY)
    .map((name) => {
      const spec = JSON.parse(readFileSync(join(root, name, "task.json"), "utf8"));
      return { name, dir: join(root, name), category: spec.category ?? "general", ...spec };
    })
    .filter((task) => !CATEGORY || task.category === CATEGORY);
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

function runShell(command, cwd, timeoutMs) {
  const [cmd, ...cmdArgs] = command.split(" ");
  try {
    const out = execFileSync(cmd, cmdArgs, { cwd, encoding: "utf8", timeout: timeoutMs });
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: (err.stdout || "") + (err.stderr || err.message || "") };
  }
}

async function runTask(task) {
  const cwd = mkdtempSync(join(tmpdir(), `tc-eval-${task.name}-`));
  cpSync(join(task.dir, "seed"), cwd, { recursive: true });

  if (task.setup) runShell(task.setup, cwd, 120_000);

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

  const verifyPass = task.verify ? runShell(task.verify, cwd, 30_000).ok : true;
  const checkResult = gradeChecks(cwd, task.check ?? []);

  rmSync(cwd, { recursive: true, force: true });

  const pass = verifyPass && checkResult.pass && !tamperedTest && !error;
  return {
    task: task.name,
    category: task.category,
    pass,
    verifyPass,
    checkPass: checkResult.pass,
    checkFailures: checkResult.failures,
    tamperedTest,
    error,
    toolCalls: stats.toolCalls,
    tokens: stats.tokens,
    leakedToolNames: stats.leakedToolNames,
    seconds: Math.round(ms / 1000),
  };
}

const tasks = loadTasks();

if (process.argv.includes("--list")) {
  console.log(`\n${tasks.length} task(s):\n`);
  for (const t of tasks) {
    const grade = [t.verify ? "verify" : null, (t.check ?? []).length ? "check" : null].filter(Boolean).join("+");
    console.log(`  ${t.name.padEnd(22)} [${String(t.category).padEnd(10)}] ${grade}`);
  }
  process.exit(0);
}

console.log(`\neval · model=${MODEL} · ${tasks.length} task(s) × ${RUNS} run(s)\n`);

const summary = [];
const raw = [];
for (const task of tasks) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`  ${task.name} #${i + 1} … `);
    const r = await runTask(task);
    raw.push(r);
    runs.push(r);
    const mark = r.pass ? "PASS" : "FAIL";
    const why = r.pass
      ? ""
      : r.tamperedTest
      ? " (edited a protected file)"
      : r.error
      ? ` (${r.error.slice(0, 40)})`
      : !r.verifyPass
      ? " (verify failed)"
      : ` (check: ${(r.checkFailures ?? []).join("; ").slice(0, 60)})`;
    console.log(`${mark}${why} · ${r.toolCalls} tools · ${r.seconds}s · leak=${r.leakedToolNames}`);
  }
  const passes = runs.filter((r) => r.pass).length;
  summary.push({
    task: task.name,
    category: task.category,
    passes,
    runs: RUNS,
    medianSeconds: median(runs.map((r) => r.seconds)),
    leaks: runs.reduce((n, r) => n + r.leakedToolNames, 0),
  });
}

console.log(`\n  model=${MODEL}`);
for (const s of summary) {
  console.log(`  ${s.task.padEnd(20)} ${s.passes}/${s.runs} pass · ${String(s.category).padEnd(10)} · median ${s.medianSeconds}s · leaks ${s.leaks}`);
}

const byCategory = {};
for (const s of summary) {
  const c = (byCategory[s.category] ??= { passes: 0, runs: 0 });
  c.passes += s.passes;
  c.runs += s.runs;
}
console.log("");
for (const [cat, c] of Object.entries(byCategory)) {
  console.log(`  [${cat}] ${c.passes}/${c.runs}`);
}

const totalPass = summary.reduce((n, s) => n + s.passes, 0);
const totalRuns = summary.reduce((n, s) => n + s.runs, 0);
console.log(`\nSCORE ${totalPass}/${totalRuns} · model=${MODEL}`);

const report = { model: MODEL, totalPass, totalRuns, summary, raw };

if (BASELINE && existsSync(BASELINE)) {
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const { regressions, improvements } = compareToBaseline(report, baseline);
  console.log(`\nvs baseline (${baseline.model ?? "?"}):`);
  for (const r of regressions) console.log(`  ↓ REGRESSION ${r.task}: ${r.from} → ${r.to}`);
  for (const i of improvements) console.log(`  ↑ improved   ${i.task}: ${i.from} → ${i.to}`);
  if (!regressions.length && !improvements.length) console.log("  no change");
}

if (SAVE) {
  const resultsDir = join(here, "results");
  mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeModel = MODEL.replace(/[^a-z0-9]+/gi, "-");
  writeFileSync(join(resultsDir, `${stamp}_${safeModel}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(resultsDir, "latest.json"), JSON.stringify(report, null, 2));
  console.log(`\nsaved → eval/results/latest.json`);
}

console.log(JSON.stringify(report));
process.exit(0);
