// renderer/common/scanner.js
// Common utility to render a CSS Grid of buttons based on folder/file names.

const fs   = require('fs');
const path = require('path');

/**
 * Render a feature grid into a container element.
 * @param {HTMLElement} container - The DOM element to fill with buttons.
 * @param {string} featuresDir - Absolute path to a directory of features.
 * @param {Object} options
 * @param {string} options.baseUrl - URL prefix for navigating into subfolders (e.g. '../features').
 * @param {Function} [options.onFile] - Handler for JS files: (fullPath, name) => void
 * @param {Function} [options.onDir]  - Handler for subfolders: (subfolderName) => void
 */
function renderGrid(container, featuresDir, { baseUrl = '', onFile, onDir } = {}) {
  // Read directory entries
  const entries = fs.readdirSync(featuresDir, { withFileTypes: true });

  // Parse entries matching pattern n_m_label(.js)?
  const positioned = entries
    .map(dirent => {
      const m = dirent.name.match(/^(\d+)_(\d+)_(.+?)(?:\.js)?$/);
      if (!m) return null;
      return {
        dirent,
        row      : +m[1],
        col      : +m[2],
        baseName : m[3],
        isDir    : dirent.isDirectory(),
        isJS     : dirent.isFile() && dirent.name.endsWith('.js')
      };
    })
    .filter(x => x !== null);

  // Configure CSS grid columns
  const maxCols = Math.max(0, ...positioned.map(p => p.col));
  container.style.gridTemplateColumns = `repeat(${maxCols}, auto)`;

  // Create buttons
  positioned.forEach(({ dirent, row, col, baseName, isDir, isJS }) => {
    const btn = document.createElement('button');
    btn.textContent = baseName    
    .replace(/^button_/, '')    // strip off “button_”
    .replace(/_/g, ' ');        // turn underscores into spaces

    if (isDir) {
      btn.addEventListener('click', () => {
        if (onDir) return onDir(dirent.name);
        // default: navigate into folder
        window.location.href = `${baseUrl}/${dirent.name}/index.html`;
      });
    } else if (isJS) {
      btn.addEventListener('click', () => {
        if (onFile) return onFile(path.join(featuresDir, dirent.name), dirent.name);
        // default: require and execute module
        require(path.join(featuresDir, dirent.name))();
      });
    }

    btn.style.gridRowStart    = row;
    btn.style.gridColumnStart = col;
    container.appendChild(btn);
  });

  // Intro vs no-intro styling
  if (document.querySelector('.page-intro')) {
    document.body.classList.add('has-intro');
  } else {
    document.body.classList.add('no-intro');
  }
  
}

module.exports = { renderGrid };
