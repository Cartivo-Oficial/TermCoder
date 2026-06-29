import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
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
    backgroundColor: "#0a0a0b",
    frame: false,
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

ipcMain.handle("list-dir", (_event, dir: string) => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .map((d) => ({ name: d.name, dir: d.isDirectory() }))
      .sort((a, b) =>
        a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1,
      )
      .slice(0, 500);
  } catch {
    return [];
  }
});

ipcMain.handle("read-file", (_event, path: string) => {
  try {
    const content = readFileSync(path, "utf8");
    const max = 200_000;
    return { content: content.length > max ? `${content.slice(0, max)}\n…(truncated)` : content };
  } catch (err) {
    return { content: "", error: String(err) };
  }
});

const WALK_IGNORE = new Set(["node_modules", ".git", "dist", "out", "release", ".next", ".turbo"]);

ipcMain.handle("all-files", (_event, dir: string) => {
  const results: string[] = [];
  const walk = (d: string, rel: string, depth: number) => {
    if (results.length >= 3000 || depth > 8) return;
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = readdirSync(d, { withFileTypes: true }) as Array<{
        name: string;
        isDirectory: () => boolean;
      }>;
    } catch {
      return;
    }
    for (const ent of entries) {
      if (WALK_IGNORE.has(ent.name)) continue;
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(join(d, ent.name), childRel, depth + 1);
      else {
        results.push(childRel);
        if (results.length >= 3000) return;
      }
    }
  };
  walk(dir, "", 0);
  return results;
});

ipcMain.handle("git-diff", (_event, dir: string, path: string) => {
  try {
    const opts = { cwd: dir, encoding: "utf8" as const, maxBuffer: 10_000_000 };
    const pathArgs = path ? ["--", path] : [];
    let diff = spawnSync("git", ["diff", "--no-color", ...pathArgs], opts).stdout ?? "";
    if (!diff.trim()) {
      diff = spawnSync("git", ["diff", "--no-color", "--staged", ...pathArgs], opts).stdout ?? "";
    }
    return { diff };
  } catch {
    return { diff: "" };
  }
});

ipcMain.on("window-minimize", (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on("window-maximize", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) (w.isMaximized() ? w.unmaximize() : w.maximize());
});
ipcMain.on("window-close", (e) => BrowserWindow.fromWebContents(e.sender)?.close());

ipcMain.handle("git-status", (_event, dir: string) => {
  try {
    const out = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" });
    if (out.status !== 0 || !out.stdout) return { map: {}, count: 0 };
    const map: Record<string, string> = {};
    for (const line of out.stdout.split("\n")) {
      if (!line.trim()) continue;
      const index = line[0] ?? " ";
      const work = line[1] ?? " ";
      let path = line.slice(3).trim();
      if (path.includes(" -> ")) path = path.split(" -> ")[1] ?? path;
      map[path] = line.startsWith("??") ? "A" : work !== " " ? work : index;
    }
    return { map, count: Object.keys(map).length };
  } catch {
    return { map: {}, count: 0 };
  }
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
