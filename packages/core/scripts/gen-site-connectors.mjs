import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogUrl = new URL("../src/mcp/catalog.ts", import.meta.url);

export function isOfferableOnWeb(connector) {
  const inputs = connector.inputs ?? [];
  const required = inputs.filter((i) => i.required);
  return required.every((i) => i.kind === "arg" && !i.secret);
}

export function toSiteConnector(connector) {
  const inputs = (connector.inputs ?? [])
    .filter((i) => i.kind === "arg" && !i.secret)
    .map((i) => ({
      key: i.key,
      label: i.label,
      placeholder: i.placeholder ?? "",
      required: !!i.required,
    }));
  return {
    id: connector.id,
    name: connector.name,
    description: connector.description,
    inputs,
  };
}

export async function buildSiteConnectors() {
  const { listConnectors } = await import(catalogUrl);
  return listConnectors()
    .filter(isOfferableOnWeb)
    .map(toSiteConnector)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function main() {
  const siteConnectors = await buildSiteConnectors();
  const outPath = join(scriptDir, "..", "..", "..", "app", "src", "generated", "connectors.json");
  writeFileSync(outPath, JSON.stringify(siteConnectors, null, 2) + "\n", "utf8");
  process.stdout.write(`Wrote ${siteConnectors.length} connector(s) to ${outPath}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
