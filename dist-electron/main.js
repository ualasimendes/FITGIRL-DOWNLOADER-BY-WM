// electron/main.ts
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { autoUpdater } from "electron-updater";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var mainWindow = null;
var isDev = !app.isPackaged || process.env.NODE_ENV === "development";
async function startExpressServer() {
  if (!isDev) {
    try {
      console.log("Starting production Express server...");
      const serverPath = path.join(app.getAppPath(), "dist", "server.cjs");
      await import(serverPath);
      console.log("Production Express server started successfully.");
    } catch (error) {
      console.error("Failed to start production Express server:", error);
    }
  }
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "FitGirl Desktop Extractor",
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  mainWindow.loadURL("http://localhost:3000");
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for update...");
  });
  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Atualiza\xE7\xE3o Dispon\xEDvel",
        message: `Uma nova vers\xE3o (${info.version}) est\xE1 dispon\xEDvel. O download foi iniciado em segundo plano!`,
        buttons: ["OK"]
      });
      mainWindow.webContents.send("update-available", info);
    }
  });
  autoUpdater.on("update-not-available", (info) => {
    console.log("Update not available.");
  });
  autoUpdater.on("error", (err) => {
    console.error("Error in auto-updater:", err);
  });
  autoUpdater.on("download-progress", (progressObj) => {
    let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
    logMessage = `${logMessage} - Downloaded ${progressObj.percent}%`;
    logMessage = `${logMessage} (${progressObj.transferred}/${progressObj.total})`;
    console.log(logMessage);
    if (mainWindow) {
      mainWindow.webContents.send("download-progress", progressObj.percent);
    }
  });
  autoUpdater.on("update-downloaded", (info) => {
    console.log("Update downloaded");
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: "question",
        title: "Atualiza\xE7\xE3o Pronta",
        message: "Uma nova vers\xE3o foi baixada. Deseja reiniciar o aplicativo agora para aplicar a atualiza\xE7\xE3o?",
        buttons: ["Reiniciar Agora", "Mais Tarde"]
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });
  app.on("ready", () => {
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.error("Failed to check for updates:", err);
      });
    }
  });
}
app.whenReady().then(async () => {
  await startExpressServer();
  createWindow();
  setupAutoUpdater();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});
ipcMain.handle("check-for-updates", () => {
  if (!isDev) {
    return autoUpdater.checkForUpdatesAndNotify();
  }
  return { message: "Auto-updater is disabled in development mode." };
});
