import { describe, expect, it } from "vitest";
import { McpServerSchema } from "../config/config";
import {
  listConnectors,
  getConnector,
  connectorToServerConfig,
  missingRequiredInputs,
  resolveConnector,
} from "./catalog";
import type { ConnectorRef } from "./catalog";

describe("connector catalog", () => {
  it("lists connectors and fetches one by id", () => {
    const all = listConnectors();
    expect(all.length).toBeGreaterThan(0);
    expect(getConnector("filesystem")?.transport).toBe("stdio");
    expect(getConnector("github")?.transport).toBe("http");
    expect(getConnector("nope")).toBeUndefined();
  });

  it("every connector produces a config that satisfies the schema", () => {
    for (const c of listConnectors()) {
      const values: Record<string, string> = {};
      for (const input of c.inputs ?? []) values[input.key] = "x-value";
      const cfg = connectorToServerConfig(c, values);
      expect(() => McpServerSchema.parse(cfg)).not.toThrow();
    }
  });
});

describe("connectorToServerConfig", () => {
  it("appends arg inputs to the stdio command in order", () => {
    const fs = getConnector("filesystem")!;
    const cfg = connectorToServerConfig(fs, { root: "/home/me/proj" });
    expect(cfg).toMatchObject({ type: "stdio", command: "npx" });
    if (cfg.type === "stdio") {
      expect(cfg.args[cfg.args.length - 1]).toBe("/home/me/proj");
      expect(cfg.args).toContain("@modelcontextprotocol/server-filesystem");
    }
  });

  it("sets env inputs as environment variables", () => {
    const brave = getConnector("brave-search")!;
    const cfg = connectorToServerConfig(brave, { BRAVE_API_KEY: "secret123" });
    if (cfg.type === "stdio") {
      expect(cfg.env?.BRAVE_API_KEY).toBe("secret123");
    } else {
      throw new Error("expected stdio");
    }
  });

  it("builds an auth header for a hosted http connector", () => {
    const gh = getConnector("github")!;
    const cfg = connectorToServerConfig(gh, { Authorization: "ghp_abc" });
    if (cfg.type === "http") {
      expect(cfg.url).toContain("githubcopilot.com");
      expect(cfg.headers?.Authorization).toBe("Bearer ghp_abc");
    } else {
      throw new Error("expected http");
    }
  });

  it("omits empty optional values (no empty env/header keys)", () => {
    const gh = getConnector("github")!;
    const cfg = connectorToServerConfig(gh, {});
    if (cfg.type === "http") expect(cfg.headers).toBeUndefined();
  });
});

describe("missingRequiredInputs", () => {
  it("flags required inputs that are blank", () => {
    const gh = getConnector("github")!;
    expect(missingRequiredInputs(gh, {}).map((i) => i.key)).toEqual(["Authorization"]);
    expect(missingRequiredInputs(gh, { Authorization: "ghp_x" })).toEqual([]);
  });
});

describe("resolveConnector", () => {
  it("resolves a known id with its required inputs, always disabled", () => {
    const server = resolveConnector({ id: "filesystem", inputs: { root: "/home/me/proj" } });
    expect(server).not.toBeNull();
    expect(server?.enabled).toBe(false);
    expect(server).toMatchObject({ type: "stdio", command: "npx" });
  });

  it("returns null for an unknown id", () => {
    expect(resolveConnector({ id: "does-not-exist", inputs: {} })).toBeNull();
  });

  it("returns null when a required input is missing", () => {
    expect(resolveConnector({ id: "filesystem", inputs: {} })).toBeNull();
  });

  it("never lets a forged ref inject its own command, args, or env", () => {
    const sentinel = "INJECTED_RCE_PAYLOAD";
    const forged = {
      id: "filesystem",
      inputs: { root: "/home/me/proj" },
      command: sentinel,
      args: [sentinel],
      env: { EVIL: sentinel },
    } as unknown as ConnectorRef;

    const server = resolveConnector(forged);

    expect(server).not.toBeNull();
    expect(JSON.stringify(server)).not.toContain(sentinel);
  });
});
