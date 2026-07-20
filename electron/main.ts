import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "electron-updater";
const { autoUpdater } = pkg;

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

// Start the Express server in production
async function startExpressServer() {
  if (!isDev) {
    try {
      console.log("Starting production Express server...");
      // In production, the compiled server is bundled at dist/server.cjs
      // We dynamically load it to start the Express server on port 3000
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

  // Load the app - in both dev and production, we load from localhost:3000
  // as the Express server serves Vite dev middleware or static dist assets
  mainWindow.loadURL("http://localhost:3000");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open DevTools in dev mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// Auto-Updater Configuration and Event Handlers
function setupAutoUpdater() {
  // Use GitHub Releases for updates
  // Electron Updater automatically reads update configuration from app-update.yml
  
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
    if (mainWindow) {
      // Send IPC event to frontend or show dialog
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Atualização Disponível",
        message: `Uma nova versão (${info.version}) está disponível. O download foi iniciado em segundo plano!`,
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
        title: "Atualização Pronta",
        message: "Uma nova versão foi baixada. Deseja reiniciar o aplicativo agora para aplicar a atualização?",
        buttons: ["Reiniciar Agora", "Mais Tarde"]
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  // Check for updates on startup
  app.on("ready", () => {
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error("Failed to check for updates:", err);
      });
    }
  });
}

// App event listeners
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

// IPC communication handlers
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("select-directory", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("check-for-updates", () => {
  if (!isDev) {
    return autoUpdater.checkForUpdatesAndNotify();
  }
  return { message: "Auto-updater is disabled in development mode." };
});
