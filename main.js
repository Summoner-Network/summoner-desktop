const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    resizable: true,
    minimizable: true,
    maximizable: true,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      // allow your renderer to use require(), fs, etc.
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer/login/login.html'));
}

app.whenReady().then(() => {
  createWindow();

  // === IPC handler ===
    ipcMain.handle('generate-and-run', (_, config) => {
    const root       = app.getAppPath();
    const starter    = path.join(root, 'start_app.sh');
    const payload    = JSON.stringify(config);
    const cmd        = `bash "${starter}" run '${payload}'`;

    // this will clone/reinstall if needed, write myserver.py + config,
    // and pop open a new Terminal window running your server
    execSync(cmd, { stdio: 'inherit' });
  });

    // === Load defaults and tooltips for form-builder.js ===
  ipcMain.handle('load-defaults', () => {
    const root    = app.getAppPath();
    const dataDir = path.join(root, 'working_space', 'summoner-src', 'desktop_data');
    const cfgPath = path.join(dataDir, 'default_config.json');
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  });

  ipcMain.handle('load-tooltips', () => {
    const root    = app.getAppPath();
    const dataDir = path.join(root, 'working_space', 'summoner-src', 'desktop_data');
    const tipPath = path.join(dataDir, 'tooltips.json');
    return JSON.parse(fs.readFileSync(tipPath, 'utf-8'));
  });


  // === end IPC handler ===

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
