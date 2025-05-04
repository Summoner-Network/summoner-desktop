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

  // === end IPC handler ===

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
