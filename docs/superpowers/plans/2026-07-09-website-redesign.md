# Website Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `website/` around TermCoder's own brand and tell the truth about what the product does, replacing a stale OpenCode look-alike whose hero is a mockup and whose CLI copy is two releases behind.

**Architecture:** Static HTML with one shared `style.css` and no build step, as today. Three pages still inline a duplicated copy of the whole stylesheet; that duplication is deleted first so every later task edits exactly one place. The hero's faux-TUI mockup is replaced by a *recorded real session*, captured by driving the real `@termcoder/server` over its WebSocket and serialized to a plain JS array. A committed verifier script asserts the spec's guarantees so they survive future edits.

**Tech Stack:** HTML, CSS, vanilla JS (no framework, no bundler). Node ≥ 20 for the two offline tooling scripts. Electron + `playwright-core` (already used in this repo) to render pages and to screenshot the desktop app.

## Global Constraints

- **No build step, no framework, no bundler, no runtime dependency.** GitHub Pages serves `website/` verbatim.
- **No emoji in any `website/*.html`.** (Currently true — this is a regression guard, not a fix.)
- **No analytics, no tracking, no cookie banner. No pricing page** — there is no paid tier, per `docs/strategy.md`.
- **Never say "free" as the headline value proposition.** Say "no API key, no account."
- **Never claim `termcoder/auto` is a trained model.** It is a router plus a prompt layer. Say "routes to the best model for the task."
- **Subscription login must be labelled experimental** wherever it appears.
- Wordmark is **TermCoder** / **TermExplorer** in prose; technical tokens (`term`, `@termcoder/tui`, `termcoder/auto`, `.termcoder/`) stay lowercase.
- Ember `#FF7A45` marks **one** thing per screen — the thing to look at. It is not decoration.
- **Never edit these files with PowerShell `Get-Content`/`Set-Content`** — it mojibakes `·`, `—`, `❯`, `█`. Use the Write/Edit tools.
- All versions are **0.8.0** (npm `@termcoder/core`+`@termcoder/tui`, GitHub Release, desktop). Verified 2026-07-09.
- The hero transcript must be a **literal capture of a real run**. If the capture cannot be produced, STOP and ask the user. Do not write a plausible-looking transcript by hand.

## Deviation from the spec

Spec §2 and §5 call for `website/mark.svg`, traced from `packages/desktop/build/icon-source.png`, "so it stays crisp at 18px in the nav and 96px in the hero." **Tracing is unnecessary.** `packages/desktop/src/renderer/assets/mark.png` already exists: 256×256, transparent, white marks, 16 KB — produced by alpha-extracting the source logo. Its largest use on the site is 88 px, so it is only ever downscaled. Copy that file to `website/mark.png` and drive it as a CSS `mask-image`, exactly as the desktop app does. This keeps `currentColor` tinting (the whole reason the spec wanted SVG) with no tracing tool and no new asset pipeline.

## Current state (measured, not assumed)

| File | Inline `<style>` lines | Links `style.css` |
|---|---|---|
| `index.html` | 135 | no |
| `download.html` | 97 | no |
| `docs.html` | 74 | no |
| `viewer.html` | 46 | no |
| `features.html` | 0 | yes |
| `study.html` | 0 | yes |
| `install.html` | 0 | yes |

`style.css` is 101 lines. Selectors defined only inside `index.html`'s inline block: `.hero`, `.hero-cta`, `.term`, `.term-bar`, `.term-body`, `.term-foot`, `.term-in`, `.stars`, `.art`, `.art-tag`, `.runline`, `.providers`, `.logo`, `.logos`, `.feat`, `.feats`, `.cols`, `.study-grid`, `.study-code`.

The hero today is a **mockup**: hand-written ASCII wordmark, a fake typed prompt (`refactor the auth module and run the tests`), and a footer reading `v0.6.0`.

## File Structure

| File | Responsibility |
|---|---|
| `website/style.css` | The single stylesheet. Tokens, layout, every component, every page's sections. |
| `website/mark.png` **(new)** | The brand mark, as a transparent alpha mask. Copied from the desktop asset. |
| `website/app.png` **(new)** | Real screenshot of the built 0.8.0 desktop app, Terminal tab visible. |
| `website/hero-session.js` **(new)** | `window.HERO_SESSION` — the recorded transcript, as data. Nothing else. |
| `website/hero.js` **(new)** | Types `HERO_SESSION` into the terminal frame. Honors `prefers-reduced-motion`. |
| `website/tools/record-session.mjs` **(new)** | Offline. Drives the real server, prints a `hero-session.js`. Never runs in the browser. |
| `website/tools/verify.mjs` **(new)** | Offline. Asserts the spec's guarantees. This is the test suite. |
| `website/index.html` | Hero, proof, capability, install paths, study teaser, support. |
| `website/features.html`, `study.html`, `install.html`, `download.html`, `docs.html` | Content truth pass. |
| `website/viewer.html` | Behavior unchanged; stylesheet unified. |

---

### Task 1: The verifier (write the tests first)

**Files:**
- Create: `website/tools/verify.mjs`

**Interfaces:**
- Produces: `node website/tools/verify.mjs` → exits `0` when every guarantee holds, `1` with a printed list of failures otherwise. `--links` additionally checks that every download URL resolves.

This is the test suite for the whole plan. Written first, it fails first. Every later task drives one of these checks to green.

- [ ] **Step 1: Write the verifier.** Create `website/tools/verify.mjs`:

```js
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = dirname(dirname(fileURLToPath(import.meta.url)));
const pages = readdirSync(site).filter((f) => f.endsWith(".html"));
const failures = [];
const fail = (msg) => failures.push(msg);

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const stripCode = (html) => html.replace(/<pre[\s\S]*?<\/pre>/gi, "").replace(/<code[\s\S]*?<\/code>/gi, "");
const headings = (html) => [
  ...[...html.matchAll(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi)].map((m) => m[1]),
  ...[...html.matchAll(/class="(?:k|sec-h|eyebrow)"[^>]*>([\s\S]*?)</gi)].map((m) => m[1]),
].map((s) => s.replace(/<[^>]+>/g, " "));
const REQUIRED_ON_INDEX = [
  ["no API key", /no API key/i],
  ["memory", /\bmemory\b/i],
  ["retrieval", /\bretrieval\b|searches your codebase/i],
  ["terminal", /embedded terminal|terminal built in|real shell/i],
  ["autonomous", /autonomous/i],
  ["study", /study|TermExplorer/i],
];

for (const page of pages) {
  const html = readFileSync(join(site, page), "utf8");

  if (/<style[\s>]/i.test(html)) fail(`${page}: has an inline <style> block`);
  if (!/href="style\.css"/.test(html)) fail(`${page}: does not link style.css`);
  if (EMOJI.test(html)) fail(`${page}: contains an emoji`);

  if (/\btrained model\b/i.test(html)) fail(`${page}: claims termcoder/auto is a trained model`);

  for (const h of headings(html)) {
    if (/\bfree\b/i.test(h)) fail(`${page}: sells "free" in a heading — say "no API key, no account": ${h.trim()}`);
  }

  const stale = stripCode(html).match(/\bv?0\.(?!8\.0\b)\d+\.\d+\b/g);
  if (stale) fail(`${page}: stale version string(s): ${[...new Set(stale)].join(", ")}`);

  if (/subscription|Claude Pro|ChatGPT Plus/i.test(html) && !/experimental/i.test(html)) {
    fail(`${page}: mentions subscription login without labelling it experimental`);
  }
}

const index = readFileSync(join(site, "index.html"), "utf8");
for (const [label, re] of REQUIRED_ON_INDEX) {
  if (!re.test(index)) fail(`index.html: never mentions ${label}`);
}

for (const asset of ["mark.png", "app.png", "hero-session.js", "hero.js", "style.css"]) {
  if (!existsSync(join(site, asset))) fail(`missing asset: ${asset}`);
}

if (existsSync(join(site, "hero-session.js"))) {
  const src = readFileSync(join(site, "hero-session.js"), "utf8");
  if (!/window\.HERO_SESSION\s*=/.test(src)) fail("hero-session.js: does not assign window.HERO_SESSION");
  if (!/"recorded":|recorded:/.test(src)) fail("hero-session.js: missing provenance (recorded timestamp)");
}

if (process.argv.includes("--links")) {
  const urls = [...new Set([...index.matchAll(/https:\/\/github\.com\/[^"']*releases\/latest\/download\/[^"']+/g)].map((m) => m[0]))];
  const dl = readFileSync(join(site, "download.html"), "utf8");
  for (const m of dl.matchAll(/https:\/\/github\.com\/[^"']*releases\/latest\/download\/[^"']+/g)) urls.push(m[0]);
  for (const url of [...new Set(urls)]) {
    const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    if (!res.ok) fail(`dead download link (${res.status}): ${url}`);
  }
}

if (failures.length) {
  console.error(`FAIL (${failures.length})`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`OK — ${pages.length} pages verified`);
```

- [ ] **Step 2: Run it — expect FAIL.**

```bash
node website/tools/verify.mjs
```
Expected: a `FAIL (n)` list naming the four pages with inline `<style>`, the four missing assets, the stale `0.6.0` in `index.html`, and the six things `index.html` never mentions. Read the list — it is the plan's remaining work.

- [ ] **Step 3: Commit.**

```bash
git add website/tools/verify.mjs
git commit -m "test(website): verifier for stylesheet, copy, version and asset guarantees"
```

---

### Task 2: One stylesheet

**Files:**
- Modify: `website/style.css` (absorb every inline rule)
- Modify: `website/index.html`, `website/download.html`, `website/docs.html`, `website/viewer.html` (delete `<style>`, add `<link>`)

**Interfaces:**
- Produces: every page links `style.css` and carries no `<style>` block. No visual change is intended by this task.

- [ ] **Step 1: Snapshot the "before".** Render each page in Electron and screenshot, so the refactor can be proven visually neutral. `playwright-core` is installed in the scratchpad; Electron lives at `node_modules/.pnpm/electron@33.4.11/node_modules/electron/dist/electron.exe`. Write `<scratchpad>/site-shot.mjs`:

```js
import { _electron as electron } from "playwright-core";
const repo = process.env.REPO;
const app = await electron.launch({
  args: [`${process.env.SCRATCH}/site-main.cjs`],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  executablePath: `${repo}/node_modules/.pnpm/electron@33.4.11/node_modules/electron/dist/electron.exe`,
});
const win = await app.firstWindow();
for (const page of ["index", "features", "study", "install", "download", "docs"]) {
  await win.evaluate((p) => { location.href = `file://${window.SITE}/${p}.html`; }, page);
  await win.waitForLoadState("load");
  await win.waitForTimeout(700);
  await win.screenshot({ path: `${process.env.OUT}/${process.env.TAG}-${page}.png`, fullPage: true });
}
await app.close();
```

and `<scratchpad>/site-main.cjs`:

```js
const { app, BrowserWindow } = require("electron");
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1200, height: 900, show: false, webPreferences: { preload: `${process.env.SCRATCH}/site-preload.cjs` } });
  win.loadFile(`${process.env.SITE}/index.html`);
});
```

and `<scratchpad>/site-preload.cjs`:

```js
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("SITE", process.env.SITE);
```

Run with `TAG=before`. Keep the PNGs.

- [ ] **Step 2: Delete the duplication, then port only what breaks.**

  These four pages do **not** extend `style.css` — they never link it, and each inline block is a *full private copy* of the base sheet plus that page's own sections. Measured: `.nav`, `.nav-in`, `.nav-links`, `.brand`, `.brand .mk`, `body`, `a`, `html` and `pre.block` are each redefined in three or four separate blocks. So this is not a "move the rules" job; it is a "delete four copies of the same sheet" job.

  For each of `index.html`, `download.html`, `docs.html`, `viewer.html`:
  1. Add `<link rel="stylesheet" href="style.css">` to its `<head>`.
  2. Delete the entire `<style>…</style>` block.
  3. Run the pixel diff in Step 3. It will show what is now missing.
  4. Append **only the missing, page-specific sections** to `style.css` — the ones with no counterpart in the base sheet. Roughly: `.hero*`, `.term*`, `.providers`, `.logo*`, `.feat*`, `.runline`, `.study-code`, `.col*` (index); `.os*`, `.allrel`, `.cli-tab*`, `.req`, `.next` (download); `aside*`, `main*`, `.note`, `.menu-btn`, table rules (docs); `.open-row`, `.status`, `.frame-wrap` (viewer).

  Do not trust that list — derive it from the diff. A `:root` block inside an inline copy is always redundant; drop it. Page sections go *after* the shared rules, so later-wins cascade is preserved.

  (`index.html` and `download.html` also redefine `.cmd` with values that differ from `style.css`'s. Keep the `style.css` definition and delete both copies; if the diff shows a real difference, reconcile to one value rather than scoping it per page.)

- [ ] **Step 3: Prove it is visually neutral.** Re-run the shot script with `TAG=after`, then compare:

```bash
node -e "
const sharp = require('./packages/desktop/node_modules/sharp');
for (const p of ['index','features','study','install','download','docs']) {
  Promise.all([sharp(\`\${process.env.OUT}/before-\${p}.png\`).raw().toBuffer({resolveWithObject:true}),
               sharp(\`\${process.env.OUT}/after-\${p}.png\`).raw().toBuffer({resolveWithObject:true})])
    .then(([a,b]) => {
      if (a.info.width!==b.info.width || a.info.height!==b.info.height) return console.log(p,'SIZE CHANGED');
      let diff=0; for (let i=0;i<a.data.length;i++) if (Math.abs(a.data[i]-b.data[i])>6) diff++;
      console.log(p, (100*diff/a.data.length).toFixed(3)+'% pixels differ');
    });
}"
```
Expected once Step 2.4 is complete: `< 0.10%` for every page (anti-aliasing jitter only). On the first run, before porting the page sections, the diff will be large — that is the point; it tells you exactly which sections are missing. Iterate Step 2.4 → Step 3 until every page is under the threshold. Anything still high after porting means a rule was dropped or reordered.

- [ ] **Step 4: Run the verifier.** `node website/tools/verify.mjs` — the four `inline <style>` and four `does not link style.css` failures are gone. Missing-asset and copy failures remain.

- [ ] **Step 5: Commit.**

```bash
git add website/style.css website/index.html website/download.html website/docs.html website/viewer.html
git commit -m "refactor(website): one stylesheet, no inline duplication"
```

---

### Task 3: The brand mark

**Files:**
- Create: `website/mark.png` (copied)
- Modify: `website/style.css`
- Modify: all seven `website/*.html` (nav mark)

**Interfaces:**
- Produces: `.brand-mark` — a mask-driven element that renders the diamond in `currentColor` at any size. Used at 18 px in the nav and 88 px in the hero (Task 4).

- [ ] **Step 1: Copy the asset.**

```bash
cp packages/desktop/src/renderer/assets/mark.png website/mark.png
```
Expected: 16 KB, 256×256, RGBA. Verify with `node -e "const b=require('fs').readFileSync('website/mark.png'); console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20), b.length)"` → `256x256 16105`.

- [ ] **Step 2: Style it.** Append to `website/style.css`:

```css
.brand-mark {
  display: inline-block;
  background: currentColor;
  -webkit-mask: url("mark.png") center / contain no-repeat;
  mask: url("mark.png") center / contain no-repeat;
}
.brand .mk { width: 18px; height: 18px; margin-right: 8px; vertical-align: -4px; color: var(--accent); }
```

The mark's dashes are thin. Below ~24 px it reads as a radial burst rather than individual strokes. That is expected at nav size — do not compensate by adding weight or a background.

- [ ] **Step 3: Use it in the nav.** In every `website/*.html`, replace the existing `.brand .mk` element (an `<img>` or inline SVG — grep `class="mk"`) with:

```html
<span class="brand-mark mk" aria-hidden="true"></span>
```

The `<a class="brand">` keeps its text (`<span class="t">Term</span><span class="c">Coder</span>`), which is what screen readers announce; the mark is decorative.

- [ ] **Step 4: Verify.** Re-run the Electron shot script and open `after-index.png`: the nav shows an ember diamond, not a broken-image glyph. `node website/tools/verify.mjs` no longer reports `missing asset: mark.png`.

- [ ] **Step 5: Commit.**

```bash
git add website/mark.png website/style.css website/*.html
git commit -m "feat(website): brand mark in the nav"
```

---

### Task 4: Record a real session, and make the hero type it

**Files:**
- Create: `website/tools/record-session.mjs`
- Create: `website/hero-session.js`
- Create: `website/hero.js`
- Modify: `website/index.html` (hero markup), `website/style.css`

**Interfaces:**
- Produces: `window.HERO_SESSION = { recorded: "<ISO date>", model: "<id>", cwd: "<label>", prompt: "<text>", lines: Array<{ kind: "prompt"|"tool"|"text"|"result", text: string }> }`
- Consumes: nothing from earlier tasks except `.brand-mark`.

**This transcript must be real.** `record-session.mjs` starts the actual `@termcoder/server` in-process, creates a session, and streams a real turn over the documented WebSocket (`WS /sessions/:id/stream`, `docs/server-api.md:74`). If the model is unreachable, the script exits non-zero. **Do not hand-write a transcript.** If you cannot record one, stop and ask the user.

**Two resolution facts, verified — do not "simplify" them back:**
- `website/` is not a package. Bare specifiers (`@termcoder/core`) do **not** resolve from `website/tools/`; those packages live only under `packages/*/node_modules/@termcoder/`. Import the built ESM by relative path instead, as the code below does. Their own internal imports still resolve, because Node resolves from *their* location, not the importer's.
- Therefore `pnpm --filter @termcoder/core --filter @termcoder/server build` must run before the recorder. Confirmed: `packages/core/dist/index.js` exports `builtinTools`, `ToolRegistry`, `loadConfig`; `packages/server/dist/index.js` exports `createServer`.
- `WebSocket` is a global on Node ≥ 22. No `ws` dependency is needed.

- [ ] **Step 1: Write the recorder.** Create `website/tools/record-session.mjs`:

```js
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtinTools, loadConfig, ToolRegistry } from "../../packages/core/dist/index.js";
import { createServer } from "../../packages/server/dist/index.js";

const cwd = process.argv[2] ?? mkdtempSync(join(tmpdir(), "tc-hero-"));
const prompt = process.argv[3] ?? "add a --version flag to src/cli.js and run the tests";

const config = loadConfig({ cwd });
const registry = new ToolRegistry([...builtinTools]);
const server = createServer({ config, registry, cwd, status: { mcp: [], lsp: [], plugins: [] } });
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const rec = await (await fetch(`http://localhost:${port}/sessions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ cwd }),
})).json();

const lines = [{ kind: "prompt", text: prompt }];
let buf = "";
const ws = new WebSocket(`ws://localhost:${port}/sessions/${rec.id}/stream`);

await new Promise((resolve, reject) => {
  ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "prompt", text: prompt })));
  ws.addEventListener("message", (e) => {
    const ev = JSON.parse(e.data);
    if (ev.type === "permission-request") {
      ws.send(JSON.stringify({ type: "permission-decision", id: ev.id, decision: "allow" }));
    } else if (ev.type === "tool-call") {
      lines.push({ kind: "tool", text: ev.title ?? ev.name });
    } else if (ev.type === "text-delta") {
      buf += ev.text;
    } else if (ev.type === "done") {
      resolve();
    } else if (ev.type === "error") {
      reject(new Error(ev.error));
    }
  });
  ws.addEventListener("error", () => reject(new Error("websocket failed")));
});

for (const l of buf.split("\n").map((s) => s.trimEnd()).filter(Boolean)) {
  lines.push({ kind: "text", text: l });
}

const data = {
  recorded: new Date().toISOString().slice(0, 10),
  model: rec.model,
  cwd: "~/my-project",
  prompt,
  lines,
};
writeFileSync(
  new URL("../hero-session.js", import.meta.url),
  `window.HERO_SESSION = ${JSON.stringify(data, null, 2)};\n`,
);
console.log(`recorded ${lines.length} lines with ${rec.model}`);
server.close();
process.exit(0);
```

- [ ] **Step 2: Record against a real project.** Point it at a small scratch git repo with a real `src/cli.js` and a test script, so the agent genuinely reads, edits and runs. Then:

```bash
node website/tools/record-session.mjs "<path-to-scratch-repo>" "add a --version flag and run the tests"
```
Expected: `recorded N lines with <model id>` and a `website/hero-session.js` whose `lines` contain at least one `tool` entry. If it exits with `Cannot connect` or a key error, configure a model first (`term` → `/setup`) — do **not** proceed by inventing lines.

Then hand-trim `hero-session.js`: keep the prompt, 2–4 tool lines, and the first 2–3 sentences of the reply. Trimming a real capture is fine; adding to it is not.

- [ ] **Step 3: Write the typer.** Create `website/hero.js`:

```js
(function () {
  var data = window.HERO_SESSION;
  var body = document.getElementById("termBody");
  if (!data || !body) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function render(line) {
    var el = document.createElement("div");
    el.className = "tline " + line.kind;
    if (line.kind === "prompt") {
      el.innerHTML = '<span class="p">❯</span> ';
      el.appendChild(document.createTextNode(line.text));
    } else if (line.kind === "tool") {
      el.innerHTML = '<span class="tk">✓</span> ';
      el.appendChild(document.createTextNode(line.text));
    } else {
      el.textContent = line.text;
    }
    body.appendChild(el);
    return el;
  }

  if (reduced) {
    data.lines.forEach(render);
    return;
  }

  var i = 0;
  (function next() {
    if (i >= data.lines.length) return;
    var line = data.lines[i++];
    if (line.kind !== "prompt") {
      render(line);
      setTimeout(next, 420);
      return;
    }
    var el = render({ kind: "prompt", text: "" });
    var j = 0;
    (function type() {
      if (j < line.text.length) {
        el.appendChild(document.createTextNode(line.text[j++]));
        setTimeout(type, 32);
      } else {
        setTimeout(next, 500);
      }
    })();
  })();
})();
```

- [ ] **Step 4: Rebuild the hero markup.** In `website/index.html`, replace the whole `<div class="term" …>…</div>` block (the one containing `class="art"`, `class="art-tag"`, `class="term-in"` and the `v0.6.0` footer) with:

```html
    <span class="brand-mark hero-mark" aria-hidden="true"></span>
    <div class="term" role="img" aria-label="A recorded TermCoder session: a prompt, tool calls, and the result">
      <div class="term-bar"><i></i><i></i><i></i><span>term — ~/my-project</span></div>
      <div class="term-body" id="termBody"></div>
      <div class="term-foot"><span class="b">Build · termcoder/auto</span><span>~/my-project · v0.8.0</span></div>
    </div>
    <script src="hero-session.js"></script>
    <script src="hero.js"></script>
```

Delete the `#stars` element, the `.art` / `.art-tag` markup, and the starfield JS that populates `#stars` (grep `getElementById("stars")`). The recorded session is the signature now; the starfield was decoration competing with it.

- [ ] **Step 5: Style it.** In `website/style.css`, remove the now-dead `.stars`, `.art`, `.art-tag`, `.term-in` rules and add:

```css
.hero-mark { width: 88px; height: 88px; margin: 0 auto 26px; color: var(--accent); filter: drop-shadow(0 0 30px rgba(255,122,69,.18)); }
.term-body { min-height: 220px; padding: 16px 18px; font-family: var(--mono); font-size: 13.5px; line-height: 1.85; text-align: left; }
.tline { white-space: pre-wrap; word-break: break-word; }
.tline.prompt { color: var(--fg); }
.tline.prompt .p { color: var(--accent); }
.tline.tool { color: var(--muted); }
.tline.tool .tk { color: var(--accent); }
.tline.text { color: #c7c7cd; }
@media (prefers-reduced-motion: reduce) { .tline { animation: none; } }
```

- [ ] **Step 6: Verify.** Screenshot `index.html` in Electron: the mark sits above a terminal that fills with a real prompt, tool lines, and a reply. Then force reduced motion and confirm the transcript renders complete and instantly:

```js
// in site-main.cjs, before loadFile:
// win.webContents.on("did-finish-load", () => {}) is not enough — set the emulation:
// win.webContents.debugger.attach("1.3"); await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
```
Expected: with reduced motion, all lines are present in the first screenshot (no typing delay).

- [ ] **Step 7: Commit.**

```bash
git add website/tools/record-session.mjs website/hero-session.js website/hero.js website/index.html website/style.css
git commit -m "feat(website): hero replays a real recorded session"
```

---

### Task 5: The desktop, as it really looks

**Files:**
- Create: `website/app.png`
- Modify: `website/index.html`, `website/style.css`

**Interfaces:**
- Consumes: the built desktop app (`packages/desktop/out/`).
- Produces: a proof section directly under the hero's install paths.

- [ ] **Step 1: Build the desktop app.**

```bash
env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop build
```

- [ ] **Step 2: Capture it.** Write `<scratchpad>/app-shot.mjs`:

```js
import { _electron as electron } from "playwright-core";
const repo = process.env.REPO, desktop = `${repo}/packages/desktop`;
const app = await electron.launch({
  args: [`${desktop}/out/main/index.js`], cwd: desktop,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  executablePath: `${repo}/node_modules/.pnpm/electron@33.4.11/node_modules/electron/dist/electron.exe`,
});
const win = await app.firstWindow();
await win.waitForLoadState("domcontentloaded");
await win.waitForTimeout(3500);
if (await win.locator(".welcome-overlay").count()) {
  await win.locator(".welcome-choice.code").click();
  await win.waitForTimeout(1200);
}
await win.setViewportSize({ width: 1280, height: 800 });
await win.waitForTimeout(600);
await win.screenshot({ path: `${repo}/website/app.png` });
await app.close();
```

Run it. Then confirm the image is what you think it is — **open it and look**. It must show the rail with the brand mark, the session list, the `CHAT | TERMINAL` tabs, and the composer. If a stale session or an error toast is on screen, clear it and re-shoot. Compress: `node -e "require('./packages/desktop/node_modules/sharp')('website/app.png').png({quality:80,compressionLevel:9}).toFile('website/app.tmp.png')"` then replace. Target under 400 KB.

- [ ] **Step 3: Place it.** In `website/index.html`, immediately after the install-paths block and before the providers strip, insert:

```html
  <section class="proof">
    <div class="wrap">
      <div class="sec-h">The desktop app</div>
      <h2 class="sec-t">Same agent, with a real terminal inside it.</h2>
      <p class="sec-p">Chat, an editor, and an embedded shell in one window. Launch Claude Code, Codex, or any CLI on your PATH without leaving the app.</p>
      <img class="shot" src="app.png" width="1280" height="800" loading="lazy"
           alt="The TermCoder desktop app: session list, chat, and a Terminal tab running a shell." />
    </div>
  </section>
```

- [ ] **Step 4: Style it.** Append to `website/style.css`:

```css
.proof .shot { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 12px; margin-top: 24px; display: block; }
```

- [ ] **Step 5: Verify.** `node website/tools/verify.mjs` no longer reports `missing asset: app.png`. Screenshot `index.html` at 1200 px and at 360 px wide; the image scales and never causes horizontal scroll.

- [ ] **Step 6: Commit.**

```bash
git add website/app.png website/index.html website/style.css
git commit -m "feat(website): show the real desktop app"
```

---

### Task 6: Tell the truth

**Files:**
- Modify: `website/index.html`, `features.html`, `study.html`, `install.html`, `download.html`, `docs.html`

**Interfaces:**
- Consumes: the verifier's `REQUIRED_ON_INDEX` list and `BANNED_COPY` rules from Task 1.

Every claim below is true today. Write them plainly; do not inflate them.

- [ ] **Step 0: Stop selling "free" in headings.** The Task-1 verifier fails on all six of these. They exist today; this is the exhaustive list:

| File | Heading now | Heading after |
|---|---|---|
| `index.html` | `Free, no API key` | `No API key` |
| `index.html` | `Free and open — kept alive by the people it helps.` | `Open source — kept alive by the people it helps.` |
| `features.html` | `// free` | `// no key` |
| `features.html` | `Free, with no API key` | `Runs with no API key` |
| `install.html` | `Start free — or connect a model` | `Start with no key — or connect a model` |
| `docs.html` | `A reliable free tier` | `A reliable keyless tier` |

The word "free" stays legal in body prose (it *is* free) — the rule is only that it must not be the headline promise. Do not sweep it out of paragraphs.

- [ ] **Step 1: Rewrite the `index.html` hero copy.** Headline leads with the keyless claim, sub-headline says what it is:

```html
    <div class="eyebrow">Open source · MIT</div>
    <h1>An AI coding agent that runs with <span class="a">no API key</span>.</h1>
    <p class="sub">TermCoder reads your code, runs commands, and ships changes — from your terminal or a
      desktop app with a real shell inside it. Bring your own model, sign in with a plan you already pay for,
      or use the keyless one and start now. A study tutor is built in.</p>
```

- [ ] **Step 2: Replace the `index.html` capability section.** The six `.feat` cards become these, verbatim:

| Eyebrow | Body |
|---|---|
| No API key | Starts on a keyless community-hosted model — no account, no card. It is rate-limited at peak, and prompts go to a third party. Run Ollama locally when you want it private and unlimited. |
| Bring your own model | Anthropic, OpenAI, Google, Ollama, and more. `termcoder/auto` routes each turn to the best model for the task. |
| Sign in with your plan | Use an existing Claude Pro/Max or ChatGPT Plus/Pro subscription instead of an API key. Experimental. |
| It remembers, and it looks | Memory across sessions, and retrieval that searches your codebase before it answers. |
| A terminal, inside the app | A real shell in the desktop app. One click launches Claude Code, Codex, or any CLI on your PATH. |
| Autonomous mode | Give it a goal and a verify command. It iterates until the command passes, checkpointing so you can revert. |

Note the free-model card states its two caveats in the same breath as the claim. That is deliberate — the keyless model is a third party's, not ours (`docs/strategy.md`). Do not trim the caveats.

- [ ] **Step 3: Fix the version strings.** Grep every page for `0.6.0` and `0.5.` and replace with `0.8.0`, or delete the version if the sentence reads fine without it:

```bash
grep -rn "0\.[0-7]\.[0-9]" website/*.html
```
Expected after the edit: no matches.

- [ ] **Step 4: Fix and extend `features.html`.**

  First, a real violation: its opening row is `<div class="k">// free</div>` with `<h3>Free, with no API key</h3>`. That sells "free" as the headline, which the brand rule forbids and the Task-1 verifier now catches. Rewrite that row's eyebrow to `// no key` and its heading to `Runs with no API key`, keeping the body prose.

  Then append these four rows, matching the file's existing `.frow` shape exactly:

```html
    <div class="frow">
      <div class="k">// memory</div>
      <div>
        <h3>It remembers</h3>
        <p>Facts you tell it once — your stack, your conventions, the thing that always breaks — persist
          across sessions, so you stop re-explaining your own project.</p>
      </div>
    </div>
    <div class="frow">
      <div class="k">// retrieval</div>
      <div>
        <h3>It reads before it answers</h3>
        <p>A symbol index and a repo map let it find where something is defined and how the project fits
          together, instead of guessing from the file you happened to open.</p>
      </div>
    </div>
    <div class="frow">
      <div class="k">// terminal</div>
      <div>
        <h3>A real shell, inside the app</h3>
        <p>The desktop app embeds a terminal. It detects the coding CLIs on your PATH — Claude Code, Codex,
          Gemini — and launches any of them in one click, in your project folder.</p>
      </div>
    </div>
    <div class="frow">
      <div class="k">// sign in</div>
      <div>
        <h3>Use a plan you already pay for</h3>
        <p>Sign in with Claude Pro/Max or ChatGPT Plus/Pro instead of buying API credits. Experimental:
          it uses the vendors' own login flows, and those can change without notice.</p>
      </div>
    </div>
```

- [ ] **Step 5: Extend `docs.html`.** Add two sidebar links inside the existing `aside`, in the group where `Configuration` lives:

```html
      <a href="#terminal">Terminal</a>
      <a href="#subscription">Subscription login</a>
```

and two sections in `main`, using the file's existing `section.doc` / `pre.block` components:

```html
    <section class="doc" id="terminal">
      <h2>Terminal</h2>
      <p>The desktop app embeds a real terminal. Open it with the <b>Chat | Terminal</b> tabs at the top of
        the centre column, or press <code class="i">Ctrl</code> + <code class="i">`</code>. It runs your
        default shell in the project folder.</p>
      <p>TermCoder scans your <code class="i">PATH</code> and shows a one-click chip for each coding CLI it
        finds: Claude Code, termcoder, Codex, and Gemini CLI. The shell keeps running while you are on the
        Chat tab.</p>
    </section>
    <section class="doc" id="subscription">
      <h2>Subscription login</h2>
      <p>Instead of an API key, you can sign in with a plan you already have.</p>
      <pre class="block"><span class="p">/login-claude</span>   <span class="c"># Claude Pro or Max</span>
<span class="p">/login-chatgpt</span>  <span class="c"># ChatGPT Plus or Pro</span></pre>
      <p class="note"><b>Experimental.</b> These use the vendors' own login flows. They can break when those
        flows change, and they are not covered by any support agreement.</p>
    </section>
```

  Before pasting, confirm the sidebar group markup and the `section.doc` / `.note` class names against the file — they were read from `docs.html` at plan time, but verify rather than assume.

- [ ] **Step 6: Run the verifier.** `node website/tools/verify.mjs` → `OK — 7 pages verified`. Then with links: `node website/tools/verify.mjs --links` → still OK.

- [ ] **Step 7: Commit.**

```bash
git add website/*.html
git commit -m "feat(website): say what the product actually does"
```

---

### Task 7: Final sweep

**Files:**
- Modify: `website/style.css` (responsive + focus fixes only)

- [ ] **Step 1: Full verifier, including the network.**

```bash
node website/tools/verify.mjs --links
```
Expected: `OK — 7 pages verified`, no dead links.

- [ ] **Step 2: Narrow viewport.** Re-run the Electron shot script with the window at **320×800** (the spec's floor) for all six pages. Confirm: no horizontal scrollbar, the nav collapses (`@media (max-width: 780px)` already hides `.nav-links`), the hero terminal wraps rather than overflows, and `app.png` scales. Assert it, don't eyeball it:

```js
const overflow = await win.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
```
Expected: `false` on every page.

- [ ] **Step 3: Reduced motion.** With `Emulation.setEmulatedMedia` forcing `prefers-reduced-motion: reduce`, the hero shows the full transcript in the first paint.

- [ ] **Step 4: Focus.** Tab through `index.html`; every link and button shows the `:focus-visible` ember outline (already in `style.css:97`). Add rules only if something is missed.

- [ ] **Step 5: Commit and push.**

```bash
git add website/style.css
git commit -m "fix(website): responsive and reduced-motion sweep"
```

Do **not** push without the user's say-so: `website/` deploys to GitHub Pages on push to `main`, which is outward-facing.

---

## Follow-ups (not this plan)

- **Desktop Welcome redesign** — the `Programar` / `Estudar` cards, whose emoji (`💻`, `📚`) are the eyesore. Its own spec.
- **Renderer lazy-load** — `xterm` and CodeMirror are bundled eagerly into a 2.9 MB chunk though neither is needed until the Terminal tab or a file opens.
- **Eval harness for `termcoder/auto`** — there is none, so no routing or prompt change can be proven to help.
