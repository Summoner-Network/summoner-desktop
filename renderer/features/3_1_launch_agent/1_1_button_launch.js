// 1_1_button_launch.js
const { ipcRenderer }       = require('electron');
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function launchAgents() {
  const selected = Array.from(
    document.querySelectorAll('#agent-list input:checked')
  ).map(i => i.value);
  if (!selected.length) return alert('Select at least one agent.');

  showOverlay('Launching agents…');
  try {
    for (const name of selected) {
      await ipcRenderer.invoke('agent-action', { action: 'launch', name });
    }
    alert('Agents launched successfully.');
  } catch (err) {
    console.error('Launch error:', err);
    alert('Launch failed. Make sure you\'ve generated your agents first in <b>Build Agent</b> or you\'ve provided your <b>Summoner API key</b> for remote/cloud agents.');
  } finally {
    hideOverlay();
  }
};