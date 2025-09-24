// 1_2_button_recombine.js
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function () {
  const selected = Array.from(
    document.querySelectorAll('#agent-list input:checked')
  ).map(i => i.value);
  if (!selected.length) return showAlert('Select at least one agent.');

  const apiKey = document.getElementById('api-key').value.trim();
  if (!apiKey) return showAlert('API key required.');

  showOverlay('Recombining agents…');
  try {
    for (const name of selected) {
      await window.summoner.agentAction({ action: 'recombine', name, apiKey });
    }
    showAlert('Recombine completed.');
  } catch (err) {
    console.error(err);
    showAlert('Failed to recombine. Check console.');
  } finally {
    hideOverlay();
  }
};