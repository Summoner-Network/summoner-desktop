/* ─── top of main.js ──────────────────────────────────────────────── */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path      = require('path');
const fs        = require('fs');
const { execSync, spawn } = require('child_process');   // keep both helpers
/* ─────────────────────────────────────────────────────────────────── */


const os   = require('os');
function getWorkspaceDir() {
  const dataRoot = process.env.XDG_DATA_HOME ||
                   path.join(os.homedir(), '.local', 'share');
  return path.join(dataRoot, 'summoner');   // same as $WORKSPACE
}

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

  ipcMain.handle('reset-env', () => {
  return new Promise((resolve, reject) => {
    const starter = path.join(app.getAppPath(), 'start_app.sh');
    const child   = spawn('bash', [starter, 'reset'], { stdio: 'inherit' });

    child.on('exit',   code => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
    child.on('error',  reject);
  });
});

  ipcMain.handle('open-agents-folder', () => {
    const agentsDir = path.join(getWorkspaceDir(), 'agents');

    /* make sure the directory exists */
    fs.mkdirSync(agentsDir, { recursive: true });

    /* reveal it in Finder / Nautilus / Explorer */
    shell.openPath(agentsDir);
  });

    // === Load defaults and tooltips for form-builder.js ===
  ipcMain.handle('load-defaults', () => {
    const root    = app.getAppPath();
    // const dataDir = path.join(root, 'working_space', 'summoner-src', 'desktop_data');
    const dataDir = path.join(getWorkspaceDir(), 'summoner-src', 'desktop_data');
    const cfgPath = path.join(dataDir, 'default_config.json');
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  });

  ipcMain.handle('load-tooltips', () => {
    const root    = app.getAppPath();
    // const dataDir = path.join(root, 'working_space', 'summoner-src', 'desktop_data');
    const dataDir = path.join(getWorkspaceDir(), 'summoner-src', 'desktop_data');
    const tipPath = path.join(dataDir, 'tooltips_short.json');
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
