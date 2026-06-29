import { contextBridge, ipcRenderer } from "electron";

const params = new URLSearchParams(location.search);

contextBridge.exposeInMainWorld("api", {
  serverPort: Number(params.get("port") ?? 0),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke("pick-folder"),
  listDir: (dir: string): Promise<Array<{ name: string; dir: boolean }>> =>
    ipcRenderer.invoke("list-dir", dir),
  allFiles: (dir: string): Promise<string[]> => ipcRenderer.invoke("all-files", dir),
  readFile: (path: string): Promise<{ content: string; error?: string }> =>
    ipcRenderer.invoke("read-file", path),
  gitStatus: (dir: string): Promise<{ map: Record<string, string>; count: number }> =>
    ipcRenderer.invoke("git-status", dir),
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
});
