// 1_1_button_generate.js
const { ipcRenderer } = require('electron');
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function () {
  const selected = Array.from(
    document.querySelectorAll('#agent-list input:checked')
  ).map(i => i.value);
  if (!selected.length) return alert('Select at least one agent.');

  showOverlay('Generating agents…');
  try {
    for (const name of selected) {
      await ipcRenderer.invoke('agent-action', { action: 'generate', name });
    }
    alert('Generate completed.');
  } catch (err) {
    console.error(err);
    alert('Failed to generate. Check console.');
  } finally {
    hideOverlay();
  }
};