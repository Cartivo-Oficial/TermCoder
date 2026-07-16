// Static-site generation for the Vite + React app.
// The client build emits dist/index.html (the shell); the SSR build emits a
// render(path) we call once per route, writing a real, crawlable HTML file for
// each one. No framework — just Vite's two build modes.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const template = readFileSync(join(dist, "index.html"), "utf8");

const { render, routes } = await import(pathToFileURL(join(root, "dist-ssr", "entry-server.js")).href);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

for (const route of routes) {
  const { html, title, description } = render(route);
  const page = template
    .replace("<!--app-html-->", html)
    .replace("<!--app-title-->", esc(title))
    .replace("<!--app-description-->", esc(description));
  const out = resolve(dist, `.${route}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page);
  console.log(`prerendered ${route.padEnd(24)} ${(page.length / 1024).toFixed(1)}kB`);
}

// Any unknown path falls back to the landing so a deep link never 404s.
writeFileSync(join(dist, "404.html"), readFileSync(join(dist, "index.html")));
rmSync(join(root, "dist-ssr"), { recursive: true, force: true });
console.log(`\n${routes.length} route(s) prerendered.`);
