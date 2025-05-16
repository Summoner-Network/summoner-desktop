const { ipcRenderer } = require('electron');
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function () {
  showOverlay('Reinstalling Summoner…');
  try {
    await ipcRenderer.invoke('reset-env');
  } catch (err) {
    console.error('Failed to reset Summoner:', err);
    showAlert('Reset failed. If the problem persists, open an issue on our GitHub.');
  } finally {
    hideOverlay();
  }
};
