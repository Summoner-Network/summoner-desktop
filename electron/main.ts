import { app, BrowserWindow, session } from "electron";
import fs from "node:fs";
import path from "node:path";
import { registerIpc } from "./ipc";
import { TcpManager } from "./tcp/TcpManager";

const isDev = !!process.env.ELECTRON_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let hasShownIntro = false;
const SPLASH_ANIMATION_MS = 2400;

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
    const splashCsp = [
      "default-src 'none'",
      "img-src data:",
      "style-src 'unsafe-inline'"
    ].join("; ");
    const isSplashDataPage = details.url.startsWith("data:text/html");
    headers["Content-Security-Policy"] = [isSplashDataPage ? splashCsp : isDev ? cspDev : cspProd];
    callback({ responseHeaders: headers });
  });
}

function getSplashLogoPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", "summoner-logo-mark-gold-type.png");
  }
  return path.join(app.getAppPath(), "assets", "originals", "summoner-logo-mark-gold-type.png");
}

function getSplashLogoDataUrl() {
  try {
    const logoBytes = fs.readFileSync(getSplashLogoPath());
    return `data:image/png;base64,${logoBytes.toString("base64")}`;
  } catch {
    return "";
  }
}

function createSplashWindow(bounds: Electron.Rectangle) {
  if (splashWindow && !splashWindow.isDestroyed()) return splashWindow;

  const logoUrl = getSplashLogoDataUrl();
  const appVersion = app.getVersion();
  const splashHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        --bg: #f7f6f1;
        --text: #3a3221;
      }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        background: radial-gradient(circle at 50% 28%, #ffffff 0%, var(--bg) 72%);
      }
      body {
        display: grid;
        place-items: center;
        overflow: hidden;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }
      .stage {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        display: grid;
        place-items: center;
        overflow: hidden;
      }
      .sweep {
        position: absolute;
        inset: -12%;
        background:
          radial-gradient(ellipse at center, rgba(255, 235, 184, 0.34) 0%, rgba(255, 240, 204, 0.12) 34%, rgba(255, 255, 255, 0) 65%),
          linear-gradient(110deg, rgba(255, 255, 255, 0) 20%, rgba(255, 241, 210, 0.42) 50%, rgba(255, 255, 255, 0) 80%);
        filter: blur(12px);
        opacity: 0;
        transform: translateX(-38%) translateY(4%);
        animation: sweep ${SPLASH_ANIMATION_MS}ms ease-in-out forwards;
      }
      .wrap {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1;
        display: grid;
        place-items: center;
        grid-auto-rows: max-content;
        gap: 18px;
        width: min(92vw, 980px);
        opacity: 0;
        animation: intro ${SPLASH_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .logo {
        width: min(72vw, 640px);
        max-width: 78%;
        max-height: 42vh;
        object-fit: contain;
        filter: drop-shadow(0 14px 38px rgba(147, 113, 46, 0.14));
        animation: bob 1800ms ease-in-out infinite;
      }
      .subtitle {
        letter-spacing: 0.12em;
        font-size: 12px;
        color: color-mix(in srgb, var(--text) 78%, white);
      }
      .version {
        margin-top: -6px;
        letter-spacing: 0.08em;
        font-size: 11px;
        color: color-mix(in srgb, var(--text) 58%, white);
      }
      @keyframes intro {
        0% { opacity: 0; }
        24% { opacity: 1; }
        72% { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes bob {
        0% { transform: translateY(0) translateX(0); }
        25% { transform: translateY(-3px) translateX(1px); }
        50% { transform: translateY(-6px) translateX(0); }
        75% { transform: translateY(-3px) translateX(-1px); }
        100% { transform: translateY(0) translateX(0); }
      }
      @keyframes sweep {
        0% { opacity: 0; transform: translateX(-38%) translateY(4%); }
        18% { opacity: 0; transform: translateX(-34%) translateY(3%); }
        38% { opacity: 0.82; transform: translateX(0%) translateY(0%); }
        78% { opacity: 0.62; transform: translateX(18%) translateY(-2%); }
        100% { opacity: 0; transform: translateX(34%) translateY(-4%); }
      }
    </style>
  </head>
  <body>
    <div class="stage" aria-label="Summoner loading screen">
      <div class="sweep" aria-hidden="true"></div>
      <div class="wrap">
        <img class="logo" src="${logoUrl}" alt="Summoner" />
        <div class="subtitle">DESKTOP CLIENT</div>
        <div class="version">v${appVersion}</div>
      </div>
    </div>
  </body>
</html>`;

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    movable: true,
    fullscreenable: false,
    show: false,
    backgroundColor: "#f7f6f1",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(splashHtml)}`);
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (splashWindow === win) splashWindow = null;
  });
  splashWindow = win;
  return win;
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    center: true,
    show: false,
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

async function showIntroThenMain() {
  const win = createWindow();
  const showMain = () => {
    if (!win.isDestroyed()) win.show();
  };

  if (isDev || hasShownIntro) {
    if (win.webContents.isLoadingMainFrame()) {
      win.once("ready-to-show", showMain);
    } else {
      showMain();
    }
    return;
  }

  hasShownIntro = true;
  const splash = createSplashWindow(win.getBounds());

  const mainReady = new Promise<void>((resolve) => {
    if (win.webContents.isLoadingMainFrame()) {
      win.webContents.once("did-finish-load", () => resolve());
      return;
    }
    resolve();
  });
  const introDelay = new Promise<void>((resolve) => setTimeout(resolve, SPLASH_ANIMATION_MS));

  await Promise.all([mainReady, introDelay]);

  if (splash && !splash.isDestroyed()) splash.close();
  showMain();
}

app.whenReady().then(async () => {
  installCsp();
  await showIntroThenMain();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void showIntroThenMain();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
