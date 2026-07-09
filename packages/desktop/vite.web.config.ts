import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
