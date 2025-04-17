const fs = require('fs');
const path = require('path');

console.log('Landing page loaded');

const featuresDir = path.join(__dirname, '..', 'features');
const grid = document.getElementById('feature-grid');

if (!grid) {
  console.error('Feature grid container not found');
}

try {
  const features = fs.readdirSync(featuresDir, { withFileTypes: true });
  console.log('Found features:', features.map(f => f.name));

  features
    .filter(dirent => dirent.isDirectory())
    .forEach(dirent => {
      const button = document.createElement('button');
      button.textContent = dirent.name;

      if (dirent.name === 'quit') {
        button.addEventListener('click', () => {
          window.location.href = '../login/login.html';
        });
      } else {
        button.addEventListener('click', () => {
          window.location.href = `../features/${dirent.name}/index.html`;
        });
      }

      grid.appendChild(button);
    });

} catch (err) {
  console.error('Failed to load features:', err);
}
