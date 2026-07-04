import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  session,
  Tray,
} from "electron";
import {
  builtinTools,
  connectLspServers,
  connectMcpServers,
  discoverTools,
  loadConfig,
  loadPlugins,
  ToolRegistry,
} from "@termcoder/core";
import { createServer } from "@termcoder/server";

// Set as early as possible (before app is ready) so Windows groups the app
// under our own id and shows our taskbar icon instead of the generic Electron one.
if (process.platform === "win32") app.setAppUserModelId("ai.termcoder.app");

let serverPort = 0;
let cleanup: () => Promise<void> = async () => {};
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

/** Start an in-process termcoder server and capture its port. */
async function startServer(): Promise<void> {
  // Default to Documents — a clean, neutral folder — rather than the install dir
  // (process.cwd() for a packaged app) or the home dir (full of Windows system
  // files/junctions). In dev, pnpm sets INIT_CWD to the project, so that wins.
  let cwd = process.env.INIT_CWD ?? "";
  if (!cwd) {
    try {
      cwd = app.getPath("documents");
    } catch {
      cwd = app.getPath("home");
    }
  }
  const config = loadConfig({ cwd });

  const mcp = await connectMcpServers(config);
  const lsp = await connectLspServers(config, cwd);
  const plugins = await loadPlugins(config.plugins, { config, cwd });
  const custom = await discoverTools({ cwd });
  const registry = new ToolRegistry([
    ...builtinTools,
    ...mcp.tools,
    ...lsp.tools,
    ...plugins.tools,
    ...custom.tools,
  ]);

  // Surface loaded custom tools (and load errors) alongside plugins in the UI.
  const customStatus = [
    ...custom.tools.map((t) => ({ name: `tool: ${t.name}`, ok: true, toolCount: 1 })),
    ...custom.errors.map((e) => ({ name: `tool: ${e.file.split(/[\\/]/).pop()}`, ok: false, toolCount: 0, error: e.error })),
  ];

  const server = createServer({
    config,
    registry,
    cwd,
    status: { mcp: mcp.servers, lsp: lsp.servers, plugins: [...plugins.plugins, ...customStatus] },
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  serverPort = typeof address === "object" && address ? address.port : 0;

  cleanup = async () => {
    await Promise.all([mcp.close(), lsp.close()]);
    server.close();
  };
}

function appIconPath(): string | undefined {
  // Windows taskbar wants an .ico; everything else takes the PNG. build/ holds
  // these in dev (under __dirname/../../build) and resources/ when packaged.
  const names = process.platform === "win32" ? ["icon.ico", "icon.png"] : ["icon.png"];
  for (const name of names) {
    for (const candidate of [
      join(__dirname, "../../build", name),
      join(process.resourcesPath ?? "", name),
    ]) {
      if (candidate && existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function appIconImage(): Electron.NativeImage | undefined {
  const path = appIconPath();
  return path ? nativeImage.createFromPath(path) : undefined;
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
    icon: appIconImage(),
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, "../preload/index.js"),
    },
  });

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  // Re-assert the icon after creation; in dev the taskbar otherwise keeps the
  // generic Electron icon.
  const icon = appIconImage();
  if (icon) win.setIcon(icon);

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

ipcMain.handle("pick-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
  });
  return result.canceled ? [] : result.filePaths;
});

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

ipcMain.handle("write-file", (_event, path: string, content: string) => {
  try {
    writeFileSync(path, content, "utf8");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle("save-file", async (_event, defaultName: string, content: string) => {
  const result = await dialog.showSaveDialog({ defaultPath: defaultName });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    writeFileSync(result.filePath, content, "utf8");
    return { ok: true, path: result.filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle("read-image", (_event, path: string) => {
  try {
    const ext = path.toLowerCase().split(".").pop() ?? "";
    const mediaType = IMAGE_MIME[ext];
    if (!mediaType) return null;
    const buf = readFileSync(path);
    if (buf.length > 8_000_000) return null; // 8 MB cap
    return { dataUrl: `data:${mediaType};base64,${buf.toString("base64")}`, mediaType };
  } catch {
    return null;
  }
});

const HIDE_NAMES = new Set(["node_modules", "desktop.ini", "thumbs.db", "$recycle.bin"]);

ipcMain.handle("list-dir", (_event, dir: string) => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      // Keep the tree clean, even in the home directory: hide dotfiles/dotfolders
      // (incl. termcoder's own .termcoder), noise dirs, Windows system files
      // (NTUSER.*, desktop.ini…), and reparse-point junctions (My Documents,
      // Cookies, "Ambiente de Rede", …).
      .filter((d) => {
        const n = d.name.toLowerCase();
        if (d.name.startsWith(".")) return false;
        if (n.startsWith("ntuser.")) return false;
        if (HIDE_NAMES.has(n)) return false;
        if (d.isSymbolicLink()) return false;
        return true;
      })
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

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

ipcMain.on("notify", (_e, title: string, body: string) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: title || "termcoder",
    body,
    icon: appIconImage(),
    silent: false,
  });
  notification.on("click", () => showMainWindow());
  notification.show();
});

/** True if `latest` is a higher semver than `current` (major.minor.patch). */
function isNewerVersion(latest: string, current: string): boolean {
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

// Check npm for a newer termcoder release (the renderer shows a banner if so).
ipcMain.handle("check-update", async () => {
  const current = app.getVersion();
  try {
    const res = await fetch("https://registry.npmjs.org/@termcoder/tui/latest", {
      headers: { accept: "application/json" },
    });
    const data = (await res.json()) as { version?: string };
    const latest = typeof data.version === "string" ? data.version : current;
    return { current, latest, hasUpdate: isNewerVersion(latest, current) };
  } catch {
    return { current, latest: current, hasUpdate: false };
  }
});

ipcMain.handle("get-login-item", () => app.getLoginItemSettings().openAtLogin);
ipcMain.on("set-login-item", (_e, open: boolean) => {
  app.setLoginItemSettings({ openAtLogin: open });
});

ipcMain.handle("git-commit", (_e, dir: string, message: string) => {
  try {
    spawnSync("git", ["add", "-A"], { cwd: dir });
    const out = spawnSync("git", ["commit", "-m", message || "termcoder: automated update"], {
      cwd: dir,
      encoding: "utf8",
    });
    const ok = out.status === 0;
    return { ok, message: (out.stdout || out.stderr || "").trim() };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
});

ipcMain.on("set-tray", (_e, enabled: boolean) => {
  if (enabled && !tray) {
    const icon = appIconImage();
    tray = new Tray(icon ?? nativeImage.createEmpty());
    tray.setToolTip("termcoder");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show termcoder", click: () => showMainWindow() },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
      ]),
    );
    tray.on("click", () => showMainWindow());
  } else if (!enabled && tray) {
    tray.destroy();
    tray = null;
  }
});

ipcMain.on("set-global-shortcut", (_e, enabled: boolean, accelerator: string) => {
  globalShortcut.unregisterAll();
  if (enabled && accelerator) {
    try {
      globalShortcut.register(accelerator, () => {
        if (mainWindow?.isVisible() && mainWindow.isFocused()) mainWindow.hide();
        else showMainWindow();
      });
    } catch {
      /* invalid accelerator — ignore */
    }
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
  // Dock icon on macOS (the Windows taskbar id is set at module load above).
  const icon = appIconImage();
  if (icon && process.platform === "darwin" && app.dock) app.dock.setIcon(icon);

  // Allow the renderer to use the microphone (for voice dictation). This is a
  // local, trusted app, so we grant media requests outright.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === "media" || permission === "mediaKeySystem" || permission === "notifications");
  });

  await startServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());

app.on("window-all-closed", () => {
  void cleanup().finally(() => {
    if (process.platform !== "darwin") app.quit();
  });
});
