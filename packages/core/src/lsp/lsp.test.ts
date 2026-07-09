import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import {
  createMessageConnection,
  NullLogger,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/node.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LspClient, LspManager } from "./lsp";

function makeFakeServer(): { clientConn: MessageConnection; dispose: () => void } {
  const toServer = new PassThrough();
  const toClient = new PassThrough();

  const clientConn = createMessageConnection(
    new StreamMessageReader(toClient),
    new StreamMessageWriter(toServer),
    NullLogger,
  );
  const serverConn = createMessageConnection(
    new StreamMessageReader(toServer),
    new StreamMessageWriter(toClient),
    NullLogger,
  );

  serverConn.onRequest("initialize", () => ({ capabilities: {} }));
  serverConn.onNotification("initialized", () => undefined);
  serverConn.onNotification("textDocument/didOpen", (params: unknown) => {
    const p = params as { textDocument: { uri: string } };
    void serverConn.sendNotification("textDocument/publishDiagnostics", {
      uri: p.textDocument.uri,
      diagnostics: [
        {
          range: { start: { line: 2, character: 4 }, end: { line: 2, character: 9 } },
          severity: 1,
          message: "Unexpected token",
          source: "fake-ts",
        },
      ],
    });
  });
  serverConn.listen();

  return { clientConn, dispose: () => serverConn.dispose() };
}

describe("LspClient", () => {
  it("initializes and surfaces pushed diagnostics for an opened document", async () => {
    const { clientConn, dispose } = makeFakeServer();
    const client = new LspClient(clientConn);
    await client.initialize("file:///root");

    const diags = await client.diagnostics("file:///root/a.ts", "typescript", "const x =", 1000);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toBe("Unexpected token");
    expect(diags[0]?.severity).toBe(1);

    client.dispose();
    dispose();
  });
});

describe("LspManager", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tc-lsp-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("formats diagnostics for a file using the server matched by extension", async () => {
    writeFileSync(join(dir, "a.ts"), "const x =\n");
    const { clientConn, dispose } = makeFakeServer();
    const client = new LspClient(clientConn);
    await client.initialize("file:///root");
    const manager = new LspManager([{ name: "ts", client, extensions: [".ts"] }], dir);

    const out = await manager.diagnostics("a.ts");
    expect(out).toMatch(/a\.ts:3:5 error: Unexpected token \[fake-ts\]/);

    await manager.close();
    dispose();
  });

  it("reports when no server handles the file's extension", async () => {
    const manager = new LspManager([], dir);
    expect(await manager.diagnostics("script.py")).toMatch(/No LSP server configured for "\.py"/);
  });
});
