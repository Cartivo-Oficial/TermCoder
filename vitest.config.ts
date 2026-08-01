import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: {
      "@termcoder/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./app/src", import.meta.url)),
    },
  },
  test: {
    include: [
      "packages/*/src/**/*.{test,spec}.{ts,tsx}",
      "app/src/**/*.{test,spec}.{ts,tsx}",
      "website/auth/**/*.test.mjs",
    ],
    environment: "node",
  },
});
