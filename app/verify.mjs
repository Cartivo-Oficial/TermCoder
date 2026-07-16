// Guards the built site before it is published.
//
// This exists because the site once shipped completely unstyled: the build
// emitted root-absolute asset URLs while Pages serves the repo from
// /TermCoder/, so every stylesheet 404'd. Grepping the HTML for the reference
// was not enough — the reference was there, it just pointed nowhere. So this
// resolves every URL to a file on disk and fails if one is missing.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const BASE = "/TermCoder/";

const fail = [];
const check = (cond, msg) => { if (!cond) fail.push(msg); };

check(existsSync(dist), "dist/ does not exist — did the build run?");
if (fail.length) { console.error("verify: " + fail[0]); process.exit(1); }

const pages = readdirSync(dist).filter((f) => f.endsWith(".html"));
check(pages.length >= 11, `expected at least 11 pages, found ${pages.length}`);

// Every route the app claims to have must exist as a real file.
for (const p of ["index", "features", "study", "install", "download", "docs", "pricing", "login", "dashboard", "viewer", "changelog"])
  check(existsSync(join(dist, `${p}.html`)), `missing page: ${p}.html`);

// The OAuth flow must survive the build untouched.
for (const f of ["auth.js", "config.js", "callback.html"])
  check(existsSync(join(dist, f)), `missing OAuth file: ${f}`);
if (existsSync(join(dist, "callback.html"))) {
  const cb = readFileSync(join(dist, "callback.html"), "utf8");
  check(cb.includes("config.js"), "callback.html no longer loads config.js");
  check(cb.includes("auth.js"), "callback.html no longer loads auth.js");
  check(cb.includes("handleCallback"), "callback.html no longer calls handleCallback");
}

const URLS = /(?:src|href)="([^"]+)"/g;

for (const page of pages) {
  const html = readFileSync(join(dist, page), "utf8");
  let m;
  while ((m = URLS.exec(html))) {
    const url = m[1];
    if (/^(https?:|mailto:|data:|#)/.test(url)) continue;

    const [path] = url.split(/[?#]/);
    if (!path) continue;

    if (path.startsWith("/")) {
      check(path.startsWith(BASE), `${page}: root-absolute URL outside the base — ${url}`);
      const onDisk = resolve(dist, "." + path.slice(BASE.length - 1));
      check(existsSync(onDisk), `${page}: ${url} resolves to nothing on disk`);
    } else {
      // Relative to the page, which sits at the dist root.
      check(existsSync(resolve(dist, path)), `${page}: ${url} resolves to nothing on disk`);
    }
  }

  // A page with no hashed bundle is a page that will render unstyled — except
  // callback.html, which is deliberately standalone with its own inline CSS.
  if (page !== "callback.html")
    check(new RegExp(`${BASE}assets/`).test(html), `${page}: references no ${BASE}assets/ bundle`);
}

if (fail.length) {
  console.error(`verify: ${fail.length} problem(s)\n` + fail.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(`verify: ${pages.length} pages, every asset URL resolves, OAuth files intact.`);
