import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import type { ToolContext } from "../tools/types";
import { ManagedMcpClient, wrapClientTools, type McpClientLike } from "./mcp";
import type { McpServerConfig } from "../config/config";

const ctx: ToolContext = { cwd: "/" };

async function connectInMemoryServer(): Promise<Client> {
  const server = new McpServer({ name: "test", version: "1.0.0" });

  server.registerTool(
    "echo",
    { description: "Echo a message", inputSchema: { msg: z.string() } },
    async ({ msg }) => ({ content: [{ type: "text", text: `echo: ${msg}` }] }),
  );
  server.registerTool(
    "peek",
    { description: "Read-only peek", inputSchema: {}, annotations: { readOnlyHint: true } },
    async () => ({ content: [{ type: "text", text: "peeked" }] }),
  );
  server.registerTool("boom", { description: "Always fails", inputSchema: {} }, async () => ({
    content: [{ type: "text", text: "kaboom" }],
    isError: true,
  }));

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("wrapClientTools", () => {
  it("namespaces tools and classifies read-only via annotations", async () => {
    const client = await connectInMemoryServer();
    const tools = await wrapClientTools("fs", client as unknown as McpClientLike);
    const byName = new Map(tools.map((t) => [t.name, t]));

    expect([...byName.keys()].sort()).toEqual(["fs_boom", "fs_echo", "fs_peek"]);

    const echo = byName.get("fs_echo")!;
    expect(echo.readOnly).toBe(false);
    expect(echo.permissionKind).toBe("mcp");

    const peek = byName.get("fs_peek")!;
    expect(peek.readOnly).toBe(true);
    expect(peek.permissionKind).toBeUndefined();
  });

  it("calls the remote tool and returns its text output", async () => {
    const client = await connectInMemoryServer();
    const tools = await wrapClientTools("fs", client as unknown as McpClientLike);
    const echo = tools.find((t) => t.name === "fs_echo")!;

    const result = await echo.run({ msg: "hi" }, ctx);
    expect(result.output).toBe("echo: hi");
    expect(result.meta?.server).toBe("fs");
  });

  it("surfaces remote tool errors as thrown errors", async () => {
    const client = await connectInMemoryServer();
    const tools = await wrapClientTools("fs", client as unknown as McpClientLike);
    const boom = tools.find((t) => t.name === "fs_boom")!;

    await expect(boom.run({}, ctx)).rejects.toThrow(/kaboom/);
  });
});

const stdioCfg = { type: "stdio", command: "noop", args: [], enabled: true } as McpServerConfig;

function makeEchoServer(): McpServer {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  server.registerTool(
    "echo",
    { description: "Echo a message", inputSchema: { msg: z.string() } },
    async ({ msg }) => ({ content: [{ type: "text", text: `echo: ${msg}` }] }),
  );
  server.registerTool("boom", { description: "Always fails", inputSchema: {} }, async () => ({
    content: [{ type: "text", text: "kaboom" }],
    isError: true,
  }));
  return server;
}

describe("ManagedMcpClient", () => {
  it("reconnects transparently after the transport drops", async () => {
    let connects = 0;
    let currentServer: McpServer | null = null;
    const connectClient = async (client: Client) => {
      connects++;
      const server = makeEchoServer();
      currentServer = server;
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    };
    const managed = new ManagedMcpClient(stdioCfg, () => new Client({ name: "c", version: "1" }), connectClient);

    const first = await managed.callTool({ name: "echo", arguments: { msg: "one" } });
    expect(first.content?.[0]?.text).toBe("echo: one");
    expect(connects).toBe(1);
    expect(managed.connected).toBe(true);
    expect(managed.reconnects).toBe(0);

    await currentServer!.close();
    await new Promise((r) => setTimeout(r, 20));
    expect(managed.connected).toBe(false);

    const second = await managed.callTool({ name: "echo", arguments: { msg: "two" } });
    expect(second.content?.[0]?.text).toBe("echo: two");
    expect(connects).toBe(2);
    expect(managed.reconnects).toBe(1);

    await managed.close();
  });

  it("does not reconnect on a normal tool error", async () => {
    let connects = 0;
    const connectClient = async (client: Client) => {
      connects++;
      const server = makeEchoServer();
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    };
    const managed = new ManagedMcpClient(stdioCfg, () => new Client({ name: "c", version: "1" }), connectClient);

    const wrapped = await wrapClientTools("fs", managed);
    const boom = wrapped.find((t) => t.name === "fs_boom")!;
    await expect(boom.run({}, ctx)).rejects.toThrow(/kaboom/);
    expect(connects).toBe(1);
    expect(managed.reconnects).toBe(0);

    await managed.close();
  });

  it("stops reconnecting once closed", async () => {
    const connectClient = async (client: Client) => {
      const server = makeEchoServer();
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    };
    const managed = new ManagedMcpClient(stdioCfg, () => new Client({ name: "c", version: "1" }), connectClient);
    await managed.callTool({ name: "echo", arguments: { msg: "x" } });
    await managed.close();

    await expect(managed.callTool({ name: "echo", arguments: { msg: "y" } })).rejects.toThrow(/closed/);
  });
});
