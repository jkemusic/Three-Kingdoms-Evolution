const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("sgsConnect", {
  last: () => ipcRenderer.invoke("sgs:last"),
  go: url => ipcRenderer.invoke("sgs:connect", url),
  cancel: () => ipcRenderer.send("sgs:cancel"),
});
