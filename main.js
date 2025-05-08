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

// main.js
function createWindow() {
  // pick a comfortable width
  const width = 1000;

  // √2 ≈ 1.4142, so height = width / √2
  const height = Math.round(width / Math.SQRT2);

  const win = new BrowserWindow({
    width,
    height,
    resizable: true,
    minimizable: true,
    maximizable: true,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.loadFile(path.join(__dirname, 'renderer/login/login.html'));
}


app.whenReady().then(() => {
  createWindow();

  // === IPC handler ===

  ipcMain.handle('import-from-github', async (_, config) => {
    const { user, repo, path: subpath = '', branch = 'main', name } = config;
    const script = path.join(app.getAppPath(), 'handle_agent.sh');

    // build download command
    const args = ['download', '--user', user, '--repo', repo];
    if (subpath) args.push('--path', subpath);
    if (branch)  args.push('--branch', branch);
    if (name)    args.push('--name', name);

    const cmd = `bash "${script}" ${args.map(arg => `"${arg}"`).join(' ')}`;
    try {
      execSync(cmd, { stdio: 'inherit' });
      // Open the agents folder after import completes
      const agentsDir = path.join(getWorkspaceDir(), 'agents');
      shell.openPath(agentsDir);
      return { success: true };
    } catch (err) {
      console.error('import-from-github failed:', err);
      throw err;
    }
  });

  // === Agent actions (generate, recombine, optimize, launch) ===
  ipcMain.handle('agent-action', async (_, { action, name, apiKey }) => {
    const script     = path.join(app.getAppPath(), 'handle_agent.sh');
    const args       = [];
    // Map action to CLI verb
    switch (action) {
      case 'generate': args.push('install', '--name', name); break;
      case 'launch':    args.push('launch', '--name', name); break;
      case 'recombine': args.push('recombine', '--name', name); break;
      case 'optimize':  args.push('optimize', '--name', name); break;
      default:
        throw new Error(`Unknown agent action: ${action}`);
    }
    // Prefix API key if provided
    let cmd = `bash "${script}" ${args.map(a => `"${a}"`).join(' ')}`;
    if (apiKey) cmd = `API_KEY="${apiKey}" ` + cmd;
    // Execute
    execSync(cmd, { stdio: 'inherit' });
    return { success: true };
  });



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
    fs.mkdirSync(agentsDir, { recursive: true });
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
