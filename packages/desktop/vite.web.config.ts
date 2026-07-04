import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds the renderer as a plain web app (no Electron), served by
// `termcoder serve`. It talks to the same origin, so we relax the renderer's
// Content-Security-Policy to allow same-origin connections (incl. over the LAN),
// while the Electron build keeps its stricter localhost-only policy.
const WEB_CSP =
  "default-src 'self'; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; img-src 'self' data:;";

export default defineConfig({
  root: resolve(__dirname, "src/renderer"),
  base: "./",
  plugins: [
    react(),
    {
      name: "termcoder-web-csp",
      transformIndexHtml(html: string) {
        return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="${WEB_CSP}" />`);
      },
    },
  ],
  build: {
    outDir: resolve(__dirname, "dist-web"),
    emptyOutDir: true,
    rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") },
  },
});
