import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { defaultShell, detectQuickTools, terminalEnv, type QuickTool } from "./shell";

interface Pty {
  pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (event: { exitCode: number }) => void): void;
}

interface PtyModule {
  spawn(
    file: string,
    args: string[],
    options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> },
  ): Pty;
}

const requireNative = createRequire(__filename);
const sessions = new Map<number, Pty>();

let cached: PtyModule | null = null;
let loadError = "";

function ptyEntry(): string {
  if (!app.isPackaged) return "@lydell/node-pty";
  return join(process.resourcesPath, "pty", "node_modules", "@lydell", "node-pty");
}

function loadPty(): PtyModule | null {
  if (cached || loadError) return cached;
  try {
    cached = requireNative(ptyEntry()) as PtyModule;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }
  return cached;
}

function safeCwd(cwd: string | null | undefined): string {
  if (cwd && existsSync(cwd)) return cwd;
  return app.getPath("home");
}

export function disposePty(webContentsId: number): void {
  const pty = sessions.get(webContentsId);
  if (!pty) return;
  sessions.delete(webContentsId);
  try {
    pty.kill();
  } catch {
  }
}

export function registerPtyIpc(): void {
  ipcMain.handle("pty:available", () => {
    const mod = loadPty();
    return mod ? { ok: true } : { ok: false, error: loadError };
  });

  ipcMain.handle("pty:tools", (): QuickTool[] => detectQuickTools(process.env, process.platform));

  ipcMain.handle(
    "pty:start",
    (event, options: { cwd: string | null; cols: number; rows: number }) => {
      const mod = loadPty();
      if (!mod) return { ok: false as const, error: loadError };
      const id = event.sender.id;
      disposePty(id);
      const shell = defaultShell(process.platform, process.env);
      try {
        const pty = mod.spawn(shell.file, shell.args, {
          name: "xterm-256color",
          cols: Math.max(2, options.cols),
          rows: Math.max(1, options.rows),
          cwd: safeCwd(options.cwd),
          env: terminalEnv(process.env),
        });
        sessions.set(id, pty);
        pty.onData((data) => {
          if (sessions.get(id) === pty && !event.sender.isDestroyed()) {
            event.sender.send("pty:data", data);
          }
        });
        pty.onExit(({ exitCode }) => {
          if (sessions.get(id) === pty) sessions.delete(id);
          if (!event.sender.isDestroyed()) event.sender.send("pty:exit", exitCode);
        });
        return { ok: true as const, pid: pty.pid };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ipcMain.on("pty:input", (event, data: string) => sessions.get(event.sender.id)?.write(data));

  ipcMain.on("pty:resize", (event, cols: number, rows: number) => {
    try {
      sessions.get(event.sender.id)?.resize(Math.max(2, cols), Math.max(1, rows));
    } catch {
    }
  });

  ipcMain.on("pty:kill", (event) => disposePty(event.sender.id));

  app.on("browser-window-created", (_e, win: BrowserWindow) => {
    const id = win.webContents.id;
    win.on("closed", () => disposePty(id));
  });
}
