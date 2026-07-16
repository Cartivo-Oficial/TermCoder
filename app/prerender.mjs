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

for (const { path, scripts } of routes) {
  const { html, title, description } = render(path);
  // Relative src, so the same file works under /TermCoder/preview/ and at the root.
  const tags = scripts.map((s) => `<script src="${s}"></script>`).join("\n    ");
  const page = template
    .replace("<!--app-html-->", html)
    .replace("<!--app-title-->", esc(title))
    .replace("<!--app-description-->", esc(description))
    .replace("</body>", tags ? `  ${tags}\n  </body>` : "</body>");
  const out = resolve(dist, `.${path}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page);
  console.log(`prerendered ${path.padEnd(24)} ${(page.length / 1024).toFixed(1)}kB${tags ? " +scripts" : ""}`);
}

// Any unknown path falls back to the landing so a deep link never 404s.
writeFileSync(join(dist, "404.html"), readFileSync(join(dist, "index.html")));
rmSync(join(root, "dist-ssr"), { recursive: true, force: true });
console.log(`\n${routes.length} route(s) prerendered.`);
