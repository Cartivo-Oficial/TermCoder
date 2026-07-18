import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { listConnectors } from "./catalog";

function isOfferableOnWeb(connector: ReturnType<typeof listConnectors>[number]): boolean {
  const inputs = connector.inputs ?? [];
  const required = inputs.filter((i) => i.required);
  return required.every((i) => i.kind === "arg" && !i.secret);
}

function toSiteConnector(connector: ReturnType<typeof listConnectors>[number]) {
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

describe("site connectors", () => {
  it("matches the committed app/src/generated/connectors.json", () => {
    const expected = listConnectors()
      .filter(isOfferableOnWeb)
      .map(toSiteConnector)
      .sort((a, b) => a.id.localeCompare(b.id));

    const committedPath = fileURLToPath(
      new URL("../../../../app/src/generated/connectors.json", import.meta.url),
    );
    const committed = JSON.parse(readFileSync(committedPath, "utf8"));

    expect(
      committed,
      "app/src/generated/connectors.json is stale — rerun `node packages/core/scripts/gen-site-connectors.mjs` from the repo root and commit the result.",
    ).toEqual(expected);
  });
});
