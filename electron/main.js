const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");

let autoUpdater = null;
try {
  ({ autoUpdater } = require("electron-updater"));
} catch (error) {
  autoUpdater = null;
}

const APP_TITLE = "PulseDeck Freelab";
const SOURCE_EXTENSIONS = new Set([".html", ".css", ".js", ".json"]);

function isTrustedOrigin(origin) {
  return !origin || origin.startsWith("file://");
}

function formatPortLabel(port, index) {
  const primary = port.displayName || port.portName || `Serial Port ${index + 1}`;
  const extra = [port.serialNumber, port.vendorId, port.productId]
    .filter(Boolean)
    .join(" / ");

  return extra ? `${primary} (${extra})` : primary;
}

async function handleSerialPortSelection(event, portList, webContents, callback) {
  event.preventDefault();

  if (!Array.isArray(portList) || portList.length === 0) {
    callback("");
    return;
  }

  if (portList.length === 1) {
    callback(portList[0].portId);
    return;
  }

  const ownerWindow = BrowserWindow.fromWebContents(webContents);
  const portLabels = portList.map(formatPortLabel);
  const cancelIndex = portLabels.length;

  const { response } = await dialog.showMessageBox(ownerWindow, {
    type: "question",
    title: "选择串口",
    message: "检测到多个串口，请选择要连接的设备。",
    detail: portLabels.map((label, index) => `${index + 1}. ${label}`).join("\n"),
    buttons: [...portLabels, "取消"],
    defaultId: 0,
    cancelId: cancelIndex,
    noLink: true
  });

  if (response === cancelIndex) {
    callback("");
    return;
  }

  callback(portList[response].portId);
}

function registerSerialPermissions() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (permission === "serial") {
      return isTrustedOrigin(requestingOrigin);
    }

    return false;
  });

  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission === "serial") {
      callback(isTrustedOrigin(details?.requestingOrigin));
      return;
    }

    callback(false);
  });

  defaultSession.setDevicePermissionHandler((details) => {
    return details.deviceType === "serial" && isTrustedOrigin(details.origin);
  });

  defaultSession.on("select-serial-port", (event, portList, webContents, callback) => {
    handleSerialPortSelection(event, portList, webContents, callback).catch((error) => {
      console.error("select-serial-port failed", error);
      callback("");
    });
  });
}

function getExternalAppCandidates() {
  const candidates = [];

  if (process.env.PULSEDECK_APP_DIR) {
    candidates.push(process.env.PULSEDECK_APP_DIR);
  }

  if (app.isPackaged) {
    const executableDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
    candidates.push(path.join(executableDir, "app"));
    candidates.push(path.join(process.resourcesPath, "app"));
  }

  return candidates;
}

function getAppContentRoot() {
  const bundledRoot = path.join(__dirname, "..");

  for (const candidate of getExternalAppCandidates()) {
    const indexPath = path.join(candidate, "index.html");

    if (fs.existsSync(indexPath)) {
      return {
        root: candidate,
        external: true
      };
    }
  }

  return {
    root: bundledRoot,
    external: false
  };
}

function watchExternalApp(root, window) {
  let reloadTimer = null;

  const watcher = fs.watch(root, { recursive: true }, (eventType, filename) => {
    if (!filename || !SOURCE_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
      return;
    }

    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (!window.isDestroyed()) {
        window.webContents.reloadIgnoringCache();
      }
    }, 200);
  });

  window.on("closed", () => {
    clearTimeout(reloadTimer);
    watcher.close();
  });
}

function createWindow() {
  const content = getAppContentRoot();
  const window = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    title: APP_TITLE,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#06131d",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.once("ready-to-show", () => window.show());
  window.loadFile(path.join(content.root, "index.html"));

  if (content.external) {
    watchExternalApp(content.root, window);
  }

  return window;
}

function registerAutoUpdates(window) {
  if (!app.isPackaged || !autoUpdater) {
    return;
  }

  autoUpdater.autoDownload = true;

  autoUpdater.on("update-downloaded", async () => {
    const { response } = await dialog.showMessageBox(window, {
      type: "info",
      title: "发现新版本",
      message: "新版本已下载完成，是否现在重启并安装？",
      buttons: ["现在安装", "稍后"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", (error) => {
    console.error("auto update failed", error);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error("check for updates failed", error);
  });
}

app.whenReady().then(() => {
  registerSerialPermissions();

  ipcMain.handle("app:new-window", () => {
    createWindow();
    return true;
  });

  const mainWindow = createWindow();
  registerAutoUpdates(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const mainWindow = createWindow();
      registerAutoUpdates(mainWindow);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
