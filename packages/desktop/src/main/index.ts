import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import {
  builtinTools,
  connectLspServers,
  connectMcpServers,
  loadConfig,
  loadPlugins,
  ToolRegistry,
} from "@termcoder/core";
import { createServer } from "@termcoder/server";

let serverPort = 0;
let cleanup: () => Promise<void> = async () => {};

/** Start an in-process termcoder server and capture its port. */
async function startServer(): Promise<void> {
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const config = loadConfig({ cwd });

  const mcp = await connectMcpServers(config);
  const lsp = await connectLspServers(config, cwd);
  const plugins = await loadPlugins(config.plugins, { config, cwd });
  const registry = new ToolRegistry([
    ...builtinTools,
    ...mcp.tools,
    ...lsp.tools,
    ...plugins.tools,
  ]);

  const server = createServer({ config, registry, cwd });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  serverPort = typeof address === "object" && address ? address.port : 0;

  cleanup = async () => {
    await Promise.all([mcp.close(), lsp.close()]);
    server.close();
  };
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1040,
    height: 740,
    minWidth: 640,
    minHeight: 480,
    title: "termcoder",
    backgroundColor: "#0d1117",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void win.loadURL(`${devUrl}?port=${serverPort}`);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"), {
      search: `port=${serverPort}`,
    });
  }
}

ipcMain.handle("pick-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
});

app.whenReady().then(async () => {
  await startServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  void cleanup().finally(() => {
    if (process.platform !== "darwin") app.quit();
  });
});
