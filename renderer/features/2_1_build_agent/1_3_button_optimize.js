// 1_3_button_optimize.js
const { ipcRenderer } = require('electron');
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function () {
  const selected = Array.from(
    document.querySelectorAll('#agent-list input:checked')
  ).map(i => i.value);
  if (!selected.length) return alert('Select at least one agent.');

  const apiKey = document.getElementById('api-key').value.trim();
  if (!apiKey) return alert('API key required.');

  showOverlay('Optimizing agents…');
  try {
    for (const name of selected) {
      await ipcRenderer.invoke('agent-action', { action: 'optimize', name, apiKey });
    }
    alert('Optimize completed.');
  } catch (err) {
    console.error(err);
    alert('Failed to optimize. Check console.');
  } finally {
    hideOverlay();
  }
};