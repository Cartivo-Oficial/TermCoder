import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules", "@lydell");
const target = join(root, "build", "pty", "node_modules", "@lydell");

const entries = await readdir(source);
if (entries.length === 0) throw new Error(`no pty packages found in ${source}`);

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

for (const entry of entries) {
  await cp(join(source, entry), join(target, entry), {
    recursive: true,
    dereference: true,
    filter: (src) => !src.endsWith(".pdb"),
  });
}

console.log(`staged ${entries.length} pty packages into ${target}`);
