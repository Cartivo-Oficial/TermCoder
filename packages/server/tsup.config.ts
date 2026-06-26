import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/serve.ts"],
  format: ["esm"],
  dts: { entry: "src/index.ts" },
  clean: true,
  target: "node20",
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
});
