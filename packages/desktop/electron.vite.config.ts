import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

// The main process bundles @termcoder/core + @termcoder/server (and their deps)
// so the packaged app is self-contained; only electron stays external.
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main/index.ts") },
        // ws's optional native deps — leave them as runtime requires so ws falls
        // back to its pure-JS implementation when they're absent.
        external: ["bufferutil", "utf-8-validate"],
      },
    },
  },
  preload: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "src/preload/index.ts") } },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "src/renderer/index.html") } },
    },
    plugins: [react()],
  },
});
