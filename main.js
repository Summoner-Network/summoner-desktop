'use strict';

// main.js - Electron entry point for Summoner app

// Core modules
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

// Logging utility for consistent prefixes
function log(...args) {
  console.log('[main]', ...args);
}

// Constants for paths and UI
const WORKSPACE_SUBDIR = 'summoner';
const SCRIPTS_SUBDIR = 'scripts';
const AGENTS_DIRNAME = 'agents';
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = Math.round(DEFAULT_WIDTH / Math.SQRT2);

// Determine the user's data directory (XDG_DATA_HOME or ~/.local/share)
function getWorkspaceDir() {
  const dataRoot = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const workspace = path.join(dataRoot, WORKSPACE_SUBDIR);
  log('Workspace directory set to', workspace);
  return workspace;
}

// Locate a shell script, whether in development or packaged mode
function resolveScript(scriptName) {
  const baseDir = app.isPackaged
    ? path.join(process.resourcesPath, SCRIPTS_SUBDIR)
    : path.join(__dirname, SCRIPTS_SUBDIR);
  const fullPath = path.join(baseDir, scriptName);
  log(`Resolving script: ${scriptName} -> ${fullPath}`);
  if (!fs.existsSync(fullPath)) {
    const errMsg = `Script not found: ${fullPath}`;
    log(errMsg);
    throw new Error(errMsg);
  }
  return fullPath;
}

// Spawn a bash process to execute the given script with arguments
function runScript(scriptName, args = [], opts = {}) {
  const scriptPath = resolveScript(scriptName);
  const cwd = opts.cwd || process.cwd();
  const env = opts.env || process.env;

  log('Running script:', 'bash', scriptPath, ...args);
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath, ...args], { stdio: 'inherit', cwd, env });

    child.on('exit', code => {
      if (code === 0) {
        log(`${scriptName} completed successfully (code 0)`);
        resolve();
      } else {
        const err = new Error(`${scriptName} exited with code ${code}`);
        log(err.message);
        reject(err);
      }
    });

    child.on('error', err => {
      log(`Error spawning ${scriptName}:`, err);
      reject(err);
    });
  });
}

// Map high-level agent actions to script verbs
const ACTION_VERBS = {
  generate:  'install',
  launch:    'launch',
  recombine: 'recombine',
  optimize:  'optimize'
};

function mapActionToVerb(action) {
  const verb = ACTION_VERBS[action];
  if (!verb) {
    throw new Error(`Unknown action: ${action}`);
  }
  return verb;
}

// Create the main application window
function createWindow() {
  log('Creating main window with size', DEFAULT_WIDTH, 'x', DEFAULT_HEIGHT);
  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    resizable: true,
    minimizable: true,
    maximizable: true,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'login', 'index.html'));
}

// Register IPC handlers for renderer-main communication
function setupIPCHandlers() {
  ipcMain.handle('run-setup', async () => {
    log('IPC: run-setup');
    const workspace = getWorkspaceDir();
    fs.mkdirSync(workspace, { recursive: true });
    try {
      await runScript('start_app.sh', ['setup'], { cwd: workspace });
      return { success: true };
    } catch (err) {
      dialog.showErrorBox('Setup Error', err.message);
      throw err;
    }
  });

  ipcMain.handle('import-from-github', async (_, cfg) => {
    log('IPC: import-from-github', cfg);
    const args = ['download', '--user', cfg.user, '--repo', cfg.repo];
    if (cfg.path)   args.push('--path',   cfg.path);
    if (cfg.branch) args.push('--branch', cfg.branch);
    if (cfg.name)   args.push('--name',   cfg.name);

    await runScript('handle_agent.sh', args);
    const agentsDir = path.join(getWorkspaceDir(), AGENTS_DIRNAME);
    shell.openPath(agentsDir);
    return { success: true };
  });

  ipcMain.handle('agent-action', async (_, { action, name, apiKey }) => {
    log('IPC: agent-action', action, name);
    const verb = mapActionToVerb(action);
    const env = apiKey ? { ...process.env, API_KEY: apiKey } : process.env;
    await runScript('handle_agent.sh', [verb, '--name', name], { env });
    return { success: true };
  });

  ipcMain.handle('generate-and-run', async (_, cfg) => {
    log('IPC: generate-and-run', cfg);
    const payload = JSON.stringify(cfg);
    await runScript('start_app.sh', ['run', payload], { cwd: getWorkspaceDir() });
    return { success: true };
  });

  ipcMain.handle('reset-env', async () => {
    log('IPC: reset-env');
    await runScript('start_app.sh', ['reset'], { cwd: getWorkspaceDir() });
    return { success: true };
  });

  ipcMain.handle('open-agents-folder', () => {
    log('IPC: open-agents-folder');
    const dir = path.join(getWorkspaceDir(), AGENTS_DIRNAME);
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  ipcMain.handle('load-defaults', () => {
    log('IPC: load-defaults');
    const file = path.join(getWorkspaceDir(), 'summoner-src', 'desktop_data', 'default_config.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  });

  ipcMain.handle('load-tooltips', () => {
    log('IPC: load-tooltips');
    const file = path.join(getWorkspaceDir(), 'summoner-src', 'desktop_data', 'tooltips_short.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  });
}

// Application lifecycle
app.whenReady()
  .then(() => {
    createWindow();
    setupIPCHandlers();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch(err => {
    log('Error initializing app:', err);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    log('All windows closed. Quitting app.');
    app.quit();
  }
});
