import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = "./dist";
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".json": "application/json", ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p.startsWith("/TermCoder")) p = p.slice("/TermCoder".length);
    if (p === "" || p.endsWith("/")) p += "index.html";
    let f = join(ROOT, p);
    const s = await stat(f).catch(() => null);
    if (s && s.isDirectory()) f = join(f, "index.html");
    const data = await readFile(f);
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
}).listen(4400, () => console.log("serving out/ at http://localhost:4400/TermCoder/"));
