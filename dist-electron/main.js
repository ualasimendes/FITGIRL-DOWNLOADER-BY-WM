// electron/main.ts
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import pkg from "electron-updater";
import net from "net";
var { autoUpdater } = pkg;
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var mainWindow = null;
var isDev = !app.isPackaged || process.env.NODE_ENV === "development";
if (!isDev) {
  process.env.NODE_ENV = "production";
}
var activePort = 3e3;
function findFreePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      resolve(findFreePort(startPort + 1));
    });
    server.listen(startPort, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => {
        resolve(port);
      });
    });
  });
}
function waitForServer(port, retries = 30, delay = 100) {
  return new Promise((resolve) => {
    let attempt = 0;
    const check = () => {
      attempt++;
      const socket = net.connect(port, "127.0.0.1", () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => {
        if (attempt >= retries) {
          resolve(false);
        } else {
          setTimeout(check, delay);
        }
      });
    };
    check();
  });
}
async function startExpressServer() {
  if (!isDev) {
    try {
      activePort = await findFreePort(3e3);
      process.env.PORT = activePort.toString();
      console.log(`Starting production Express server on port ${activePort}...`);
      const serverPath = path.join(app.getAppPath(), "dist", "server.cjs");
      const serverUrl = pathToFileURL(serverPath).href;
      await import(serverUrl);
      console.log("Production Express server started successfully.");
    } catch (error) {
      console.error("Failed to start production Express server:", error);
    }
  } else {
    process.env.PORT = "3000";
    activePort = 3e3;
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
  mainWindow.loadURL(`http://localhost:${activePort}`);
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
  const isServerReady = await waitForServer(activePort);
  if (!isServerReady) {
    console.warn(`[Warning] Express server on port ${activePort} is taking too long to respond. Loading window anyway...`);
  } else {
    console.log(`[Success] Express server verified healthy on port ${activePort}`);
  }
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
