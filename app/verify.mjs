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

for (const p of ["index", "features", "study", "install", "download", "docs", "pricing", "login", "dashboard", "viewer", "changelog"])
  check(existsSync(join(dist, `${p}.html`)), `missing page: ${p}.html`);

for (const f of ["auth.js", "config.js", "callback.html"])
  check(existsSync(join(dist, f)), `missing OAuth file: ${f}`);
if (existsSync(join(dist, "callback.html"))) {
  const cb = readFileSync(join(dist, "callback.html"), "utf8");
  check(cb.includes("config.js"), "callback.html no longer loads config.js");
  check(cb.includes("auth.js"), "callback.html no longer loads auth.js");
  check(cb.includes("handleCallback"), "callback.html no longer calls handleCallback");
}

for (const p of ["dashboard", "pricing", "login"]) {
  const file = join(dist, `${p}.html`);
  if (existsSync(file)) {
    const html = readFileSync(file, "utf8");
    check(/<script[^>]+src="[^"]*config\.js/.test(html), `${p}.html does not load config.js`);
  }
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
      check(existsSync(resolve(dist, path)), `${page}: ${url} resolves to nothing on disk`);
    }
  }

  if (page !== "callback.html")
    check(new RegExp(`${BASE}assets/`).test(html), `${page}: references no ${BASE}assets/ bundle`);
}

// ── redesign invariants ────────────────────────────────────────────────
// Files still carrying the old dark/orange identity. Each redesign phase
// deletes entries here; the guard fails while any listed file has been
// migrated in appearance but not in fact.
// Empty, and it stays empty: every .ts/.tsx/.css file under src/ is scanned.
// Known blind spots, deliberate rather than forgotten: index.html, .mjs/.js,
// inline style={{}} objects, and arbitrary shadow-[] values (screenshot.tsx
// legitimately ships a neutral black one). Widen this before trusting it
// with a class of value it does not currently see.
const NOT_YET_MIGRATED = [];

// Regexes, not substrings: "text-primary" is a prefix of the perfectly
// legitimate "text-primary-foreground", and a plain includes() would ban
// every solid button in the kit.
const BANNED = [
  /ff7a45/i, /31d0b4/i, /\btext-study\b/, /\btext-primary\b(?!-)/,
  /shadow-primary/, /build-soft/, /study-soft/, /Funnel Display/, /<Dither/,
  /bg-\[#/, /text-\[#/, /border-\[#/, /ring-\[#/,
  /bg-white\//, /text-white\//, /border-white\//, /ring-white\//,
  /bg-black\//, /text-black\//, /border-black\//, /ring-black\//,
  // Tailwind's own palette is how the retired orange and teal would walk back
  // in without ever naming a hex. The site's colour comes from tokens only.
  /(?:bg|text|border|ring|from|via|to|decoration|fill|stroke|shadow|outline|divide|accent|caret)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)-\d{2,3}/,
  // Non-hex colour notations that the bracket rules above would miss.
  /(?:bg|text|border|ring|from|via|to|decoration|fill|stroke)-\[(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/,
  // Faded body text fails WCAG AA. muted-foreground is already the quiet
  // colour; dropping it to 60% opacity on 11px text lands around 2.4:1.
  /text-muted-foreground\/[0-9]/,
];

// The one chromatic value on the site. It is a token, declared once per ramp
// in index.css and reached everywhere else as `accent-link`. Hardcoding the
// literal anywhere but index.css is how a token quietly becomes a theme, so
// the hex is banned outside the ramps. This permits the accent and nothing
// else: `ff7a45`, the old identity orange, stays banned everywhere, including
// index.css — a different value doing a different job.
const ACCENT_HEX = [/b84d18/i, /ff8a5c/i];

const srcDir = join(root, "src");
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

for (const file of walk(srcDir)) {
  if (!/\.(tsx?|css)$/.test(file)) continue;
  const rel = file.slice(srcDir.length + 1).replace(/\\/g, "/");
  if (NOT_YET_MIGRATED.includes(rel)) continue;
  const body = readFileSync(file, "utf8");
  for (const re of BANNED)
    check(!re.test(body), `${rel} still matches ${re}`);
  if (rel !== "index.css")
    for (const re of ACCENT_HEX)
      check(!re.test(body), `${rel} hardcodes the accent ${re} — use the accent-link token`);
}

// The accent has to exist in both ramps, or `accent-link` silently renders as
// nothing in one theme.
const css = readFileSync(join(srcDir, "index.css"), "utf8");
check(/--color-accent-link:\s*var\(--accent-link\)/.test(css), "index.css does not register --color-accent-link in @theme inline");
check((css.match(/^\s*--accent-link:/gm) ?? []).length === 2, "index.css does not declare --accent-link in both ramps");

// The pre-paint theme script must sit in the built HTML, or a dark-theme
// visitor gets a white flash on every navigation.
for (const p of ["index", "features", "docs"]) {
  const html = join(dist, `${p}.html`);
  if (!existsSync(html)) continue;
  const body = readFileSync(html, "utf8");
  check(body.includes("__termcoder_theme"), `${p}.html has no pre-paint theme script`);
  check(!body.includes('<html lang="en" class="dark">'), `${p}.html still hardcodes the dark class`);
}

if (fail.length) {
  console.error(`verify: ${fail.length} problem(s)\n` + fail.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(`verify: ${pages.length} pages, every asset URL resolves, OAuth files intact.`);
