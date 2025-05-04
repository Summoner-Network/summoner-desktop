;(function(){
  const fs   = require('fs');
  const path = require('path');

  const featuresDir = __dirname;
  const grid        = document.getElementById('feature-grid');
  const entries     = fs.readdirSync(featuresDir, { withFileTypes: true });

  // parse entries…
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
    .filter(x => x);

  grid.style.gridTemplateColumns = `repeat(${Math.max(...positioned.map(p=>p.col),0)}, auto)`;

  positioned.forEach(({ dirent, row, col, baseName, isDir, isJS }) => {
    const btn = document.createElement('button');
    btn.textContent = baseName
    .replace(/^button_/, '')    // strip off “button_”
    .replace(/_/g, ' ');        // turn underscores into spaces

    if (isDir && dirent.name.endsWith('_back')) {
      btn.addEventListener('click', () => window.location.href = '../../landing/landing.html');
    }
    else if (isDir) {
      btn.addEventListener('click', () => window.location.href = `${dirent.name}/index.html`);
    }
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

    btn.style.gridRowStart    = row;
    btn.style.gridColumnStart = col;
    grid.appendChild(btn);
  });

  // intro/no-intro styling
  if (document.querySelector('.page-intro')) {
    document.body.classList.add('has-intro');
  } else {
    document.body.classList.add('no-intro');
  }
})();
