const fs = require('fs');
const path = require('path');

const featuresDir = __dirname;
const grid       = document.getElementById('feature-grid');
const entries    = fs.readdirSync(featuresDir, { withFileTypes: true });

// 1) parse every entry that matches "row_col_rest(.js)?"
const positioned = entries
  .map(dirent => {
    const m = dirent.name.match(
      /^(\d+)_(\d+)_(.+?)(?:\.js)?$/   // row_col_base[.js]
    );
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

// 2) compute how many columns we need
const maxCols = Math.max(...positioned.map(p => p.col), 0);

// 3) set up the grid
grid.style.gridTemplateColumns = `repeat(${maxCols}, auto)`;

// 4) create buttons in any order (CSS-Grid will place them)
positioned.forEach(({ dirent, row, col, baseName, isDir, isJS }) => {
  const btn = document.createElement('button');
  btn.textContent = baseName.replace(/^button_/, '')    // strip off “button_”
                            .replace(/\.js$/, '')       // strip off “.js”
                            .replace(/_/g, ' ');

  // special back-folder case
  if (isDir && dirent.name.endsWith('_back')) {
    btn.addEventListener('click', () => {
      window.location.href = '../../landing/landing.html';
    });
  }
  // directory → load index.html
  else if (isDir) {
    btn.addEventListener('click', () => {
      window.location.href = `${dirent.name}/index.html`;
    });
  }
  // js file → require() it
  else if (isJS) {
    btn.addEventListener('click', () => {
      try {
        require(path.join(featuresDir, dirent.name))();
      } catch (e) {
        console.error('Error executing', dirent.name, e);
        alert('Failed to run ' + dirent.name);
      }
    });
  }

  // place it in the grid
  btn.style.gridRowStart    = row;
  btn.style.gridColumnStart = col;
  grid.appendChild(btn);
});
