import { app, BrowserWindow, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const APP_URL = process.env.CERTIFICADOS_APP_URL || "https://app-certificados-segex.giovannifeliciano070.chatgpt.site";

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#111d35",
    autoHideMenuBar: true,
    title: "Gerador de Certificados",
    icon: path.join(currentDirectory, "../public/icon-512.png"),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.loadURL(APP_URL);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
