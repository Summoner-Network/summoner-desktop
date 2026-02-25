import { app, BrowserWindow, session } from "electron";
import path from "node:path";
import { registerIpc } from "./ipc";
import { TcpManager } from "./tcp/TcpManager";

const isDev = !!process.env.ELECTRON_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;

function installCsp() {
  const devUrl = process.env.ELECTRON_RENDERER_URL ?? "";
  const devOrigin = devUrl ? new URL(devUrl).origin : "";

  // In dev we must allow Vite dev server scripts.
  // In prod we lock down to self.
  const cspProd = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self'",
    "script-src 'self'",
    "connect-src 'self'"
  ].join("; ");

  const cspDev = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'", // Vite injects styles in dev
    // Vite + React Refresh use inline module scripts in dev.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${devOrigin}`,
    // Renderer shouldn't need network for TCP (handled in main), but Vite HMR uses websockets.
    `connect-src 'self' ${devOrigin} ws:`
  ].join("; ");

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders ?? {};
    headers["Content-Security-Policy"] = [isDev ? cspDev : cspProd];
    callback({ responseHeaders: headers });
  });
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL as string);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // renderer build output: dist/renderer/index.html
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  const tcp = new TcpManager();
  registerIpc(win, tcp);

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  mainWindow = win;

  return win;
}

app.whenReady().then(() => {
  installCsp();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
