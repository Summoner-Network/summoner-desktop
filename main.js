const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer/login/login.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS behavior: reopen app when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Quit app except on macOS
  if (process.platform !== 'darwin') app.quit();
});

