// 1_3_button_optimize.js
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function () {
  const selected = Array.from(
    document.querySelectorAll('#agent-list input:checked')
  ).map(i => i.value);
  if (!selected.length) return showAlert('Select at least one agent.');

  const apiKey = document.getElementById('api-key').value.trim();
  if (!apiKey) return showAlert('API key required.');

  showOverlay('Optimizing agents…');
  try {
    for (const name of selected) {
      await window.summoner.agentAction({ action: 'optimize', name, apiKey });
    }
    showAlert('Optimize completed.');
  } catch (err) {
    console.error(err);
    showAlert('Failed to optimize. Check console.');
  } finally {
    hideOverlay();
  }
};