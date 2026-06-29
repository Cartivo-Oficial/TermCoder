import { contextBridge, ipcRenderer } from "electron";

const params = new URLSearchParams(location.search);

contextBridge.exposeInMainWorld("api", {
  serverPort: Number(params.get("port") ?? 0),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke("pick-folder"),
});
