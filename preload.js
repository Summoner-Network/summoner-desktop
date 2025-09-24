// preload.js
const { contextBridge, ipcRenderer } = require('electron');
// --- add near the top of preload.js ---
const path = require('path');

// Require your CommonJS scanner from preload (Node is available here)
const { renderGrid } = require(path.join(__dirname, 'renderer', 'common', 'scanner'));


contextBridge.exposeInMainWorld('summoner', {
  // 1: setup & reset
  runSetup:      () => ipcRenderer.invoke('run-setup'),
  resetEnv:      () => ipcRenderer.invoke('reset-env'),

  // 2: github import & agent actions
  importFromGithub: (cfg) => ipcRenderer.invoke('import-from-github', cfg),
  agentAction:      (payload) => ipcRenderer.invoke('agent-action', payload),

  // 3: generate & run
  generateAndRun: (cfg) => ipcRenderer.invoke('generate-and-run', cfg),

  // 4: filesystem helpers
  openAgentsFolder: () => ipcRenderer.invoke('open-agents-folder'),
  loadDefaults:     () => ipcRenderer.invoke('load-defaults'),
  loadTooltips:     () => ipcRenderer.invoke('load-tooltips'),

  // 5: router opener (moved from renderer, runs ping in main)
  openRouter:       () => ipcRenderer.invoke('open-router'),

  // --- inside your contextBridge.exposeInMainWorld({...}) object, add: ---
  renderLandingGrid: (opts = {}) => {
    // Find the target element in the landing page DOM
    const grid = document.getElementById('feature-grid');
    if (!grid) return;

    // Point to the features directory in your packaged app
    const featuresDir = path.join(__dirname, 'renderer', 'features');

    // Default options; keep your baseUrl convention
    const options = { baseUrl: '..', ...opts };

    // Call your existing renderer/common/scanner.renderGrid
    renderGrid(grid, featuresDir, options);
  },
});
