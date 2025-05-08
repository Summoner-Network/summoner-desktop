// 1_2_button_recombine.js
const { ipcRenderer } = require('electron');
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function () {
  const selected = Array.from(
    document.querySelectorAll('#agent-list input:checked')
  ).map(i => i.value);
  if (!selected.length) return alert('Select at least one agent.');

  const apiKey = document.getElementById('api-key').value.trim();
  if (!apiKey) return alert('API key required.');

  showOverlay('Recombining agents…');
  try {
    for (const name of selected) {
      await ipcRenderer.invoke('agent-action', { action: 'recombine', name, apiKey });
    }
    alert('Recombine completed.');
  } catch (err) {
    console.error(err);
    alert('Failed to recombine. Check console.');
  } finally {
    hideOverlay();
  }
};