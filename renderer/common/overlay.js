const overlayId = 'busy-overlay';

function showOverlay(text = 'Please wait…') {
  if (document.getElementById(overlayId)) return;          // already visible
  const div = document.createElement('div');
  div.id = overlayId;
  div.innerHTML = `
      <div class="spinner"></div>
      <p>${text}</p>`;
  document.body.appendChild(div);
}

function hideOverlay() {
  const div = document.getElementById(overlayId);
  if (div) div.remove();
}

module.exports = { showOverlay, hideOverlay };
