// 01_01_open_agents_folder.js
// Invokes the main‑process channel `open-agents-folder` and shows
// a transient overlay while the path is created / opened.

/* ------------------------------------------------------------- */
/* adjust the relative path to overlay.js to match your tree     */
/* e.g. '../../common/overlay' if this file sits two levels deep */
/* ------------------------------------------------------------- */
const { showOverlay, hideOverlay } = require('../../common/overlay');

module.exports = async function () {
  showOverlay('Opening agents folder…');

  try {
    await window.summoner.openAgentsFolder();  // no payload
  } catch (err) {
    console.error('Failed to open agents folder:', err);
    showAlert('Could not open the agents folder. If the problem persists, open an issue on our GitHub.');
  } finally {
    hideOverlay();
  }
};
