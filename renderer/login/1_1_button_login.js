const { ipcRenderer } = require('electron');
const { showOverlay, hideOverlay } = require('../common/overlay');

module.exports = async function () {
  showOverlay('Setting up Summoner…');
  try {

    const userInput = document.getElementById('username');
    const passInput = document.getElementById('password');

    const username = userInput.value.trim();
    const password = passInput.value.trim();

    // Basic validation
    if (!username || !password) {
      showAlert('Please enter both username and password.');
      return;
    }

    await ipcRenderer.invoke('run-setup');
    window.location.href = '../landing/landing.html';
    
  } catch (err) {
    console.error('Setup failed:', err);
    showAlert('Setup failed. If the problem persists, open an issue on our GitHub.');
  } finally {
    hideOverlay();
  }
};
