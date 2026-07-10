import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = dirname(dirname(fileURLToPath(import.meta.url)));
const pages = readdirSync(site).filter((f) => f.endsWith(".html"));
const failures = [];
const fail = (msg) => failures.push(msg);

const EMOJI = /\p{Extended_Pictographic}/u;

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
