// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => import_electron.ipcRenderer.invoke("get-app-version"),
  checkForUpdates: () => import_electron.ipcRenderer.invoke("check-for-updates"),
  onUpdateAvailable: (callback) => {
    const listener = (_event, info) => callback(info);
    import_electron.ipcRenderer.on("update-available", listener);
    return () => import_electron.ipcRenderer.removeListener("update-available", listener);
  },
  onDownloadProgress: (callback) => {
    const listener = (_event, percent) => callback(percent);
    import_electron.ipcRenderer.on("download-progress", listener);
    return () => import_electron.ipcRenderer.removeListener("download-progress", listener);
  }
});
