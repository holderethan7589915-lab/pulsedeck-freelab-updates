const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopShell", {
  isElectron: true,
  platform: process.platform,
  openNewWindow: () => ipcRenderer.invoke("app:new-window")
});
