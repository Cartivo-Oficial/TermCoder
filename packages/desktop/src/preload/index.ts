import { contextBridge, ipcRenderer } from "electron";

const params = new URLSearchParams(location.search);

contextBridge.exposeInMainWorld("api", {
  serverPort: Number(params.get("port") ?? 0),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke("pick-folder"),
  pickFile: (): Promise<string[]> => ipcRenderer.invoke("pick-file"),
  readImage: (path: string): Promise<{ dataUrl: string; mediaType: string } | null> =>
    ipcRenderer.invoke("read-image", path),
  listDir: (dir: string): Promise<Array<{ name: string; dir: boolean }>> =>
    ipcRenderer.invoke("list-dir", dir),
  allFiles: (dir: string): Promise<string[]> => ipcRenderer.invoke("all-files", dir),
  readFile: (path: string): Promise<{ content: string; error?: string }> =>
    ipcRenderer.invoke("read-file", path),
  writeFile: (path: string, content: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("write-file", path, content),
  saveFile: (defaultName: string, content: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke("save-file", defaultName, content),
  gitStatus: (dir: string, base?: string): Promise<{ map: Record<string, string>; count: number }> =>
    ipcRenderer.invoke("git-status", dir, base),
  gitDiff: (dir: string, path: string, base?: string): Promise<{ diff: string }> =>
    ipcRenderer.invoke("git-diff", dir, path, base),
  gitBranches: (dir: string): Promise<{ branches: string[]; current: string }> =>
    ipcRenderer.invoke("git-branches", dir),
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  notify: (title: string, body: string) => ipcRenderer.send("notify", title, body),
  checkUpdate: (): Promise<{ current: string; latest: string; hasUpdate: boolean }> =>
    ipcRenderer.invoke("check-update"),
  getLoginItem: (): Promise<boolean> => ipcRenderer.invoke("get-login-item"),
  setLoginItem: (open: boolean) => ipcRenderer.send("set-login-item", open),
  gitCommit: (dir: string, message: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke("git-commit", dir, message),
  setTray: (enabled: boolean) => ipcRenderer.send("set-tray", enabled),
  setGlobalShortcut: (enabled: boolean, accelerator: string) =>
    ipcRenderer.send("set-global-shortcut", enabled, accelerator),
  pty: {
    available: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("pty:available"),
    tools: (): Promise<Array<{ id: string; label: string; command: string }>> =>
      ipcRenderer.invoke("pty:tools"),
    start: (
      id: number,
      options: { cwd: string | null; cols: number; rows: number },
    ): Promise<{ ok: true; pid: number } | { ok: false; error: string }> =>
      ipcRenderer.invoke("pty:start", { id, ...options }),
    write: (id: number, data: string) => ipcRenderer.send("pty:input", { id, data }),
    resize: (id: number, cols: number, rows: number) => ipcRenderer.send("pty:resize", { id, cols, rows }),
    kill: (id: number) => ipcRenderer.send("pty:kill", { id }),
    onData: (id: number, cb: (data: string) => void) => {
      const handler = (_e: unknown, payload: { id: number; data: string }) => {
        if (payload.id === id) cb(payload.data);
      };
      ipcRenderer.on("pty:data", handler);
      return () => ipcRenderer.off("pty:data", handler);
    },
    onExit: (id: number, cb: (code: number) => void) => {
      const handler = (_e: unknown, payload: { id: number; code: number }) => {
        if (payload.id === id) cb(payload.code);
      };
      ipcRenderer.on("pty:exit", handler);
      return () => ipcRenderer.off("pty:exit", handler);
    },
  },
});
