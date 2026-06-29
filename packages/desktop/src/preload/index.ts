import { contextBridge, ipcRenderer } from "electron";

const params = new URLSearchParams(location.search);

contextBridge.exposeInMainWorld("api", {
  serverPort: Number(params.get("port") ?? 0),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke("pick-folder"),
  listDir: (dir: string): Promise<Array<{ name: string; dir: boolean }>> =>
    ipcRenderer.invoke("list-dir", dir),
});
