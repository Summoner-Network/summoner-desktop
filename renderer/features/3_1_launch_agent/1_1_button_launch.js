// 1_1_button_launch.js
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function launchAgents() {
  const selected = Array.from(
    document.querySelectorAll('#agent-list input:checked')
  ).map(i => i.value);
  if (!selected.length) return showAlert('Select at least one agent.');

  showOverlay('Launching agents…');
  try {
    for (const name of selected) {
      await window.summoner.agentAction({ action: 'launch', name });
    }
    showAlert('Agents launched successfully.');
  } catch (err) {
    console.error('Launch error:', err);
    showAlert('Launch failed. Make sure you\'ve generated your agents first in <b>Build Agent</b> or you\'ve provided your <b>Summoner API key</b> for remote/cloud agents.');
  } finally {
    hideOverlay();
  }
};