// 1_1_button_use_github.js
const { ipcRenderer }       = require('electron');
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function importFromGithub() {
  const user    = document.getElementById('github-user').value.trim();
  const repo    = document.getElementById('github-repo').value.trim();
  const branch  = document.getElementById('github-branch').value.trim() || 'main';
  const subpath = document.getElementById('github-path').value.trim();
  const name    = document.getElementById('github-name').value.trim();

  if (!user || !repo) {
    return showAlert('Please provide both GitHub user and repository.');
  }

  showOverlay('Importing from GitHub…');
  try {
    await ipcRenderer.invoke('import-from-github', {
      user,
      repo,
      branch,
      path: subpath,
      name
    });
    showAlert('Agent imported successfully.');
  } catch (err) {
    console.error('Failed to import agent:', err);
    showAlert('Import failed. See console for details.');
  } finally {
    hideOverlay();
  }
};