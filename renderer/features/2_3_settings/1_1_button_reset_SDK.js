const { ipcRenderer } = require('electron');
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function () {
  showOverlay('Reinstalling Summoner…');
  try {
    await ipcRenderer.invoke('reset-env');
  } catch (err) {
    console.error('Failed to reset Summoner:', err);
    alert('Reset failed – see console for details.');
  } finally {
    hideOverlay();
  }
};
