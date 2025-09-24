// 1_1_button_generate.js
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function () {
  const selected = Array.from(
    document.querySelectorAll('#agent-list input:checked')
  ).map(i => i.value);
  if (!selected.length) return showAlert('Select at least one agent.');

  showOverlay('Generating agents…');
  try {
    for (const name of selected) {
      await window.summoner.agentAction({ action: 'generate', name });
    }
    showAlert('Generate completed.');
  } catch (err) {
    console.error(err);
    showAlert('Failed to generate. Check console.');
  } finally {
    hideOverlay();
  }
};