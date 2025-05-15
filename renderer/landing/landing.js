;(function(){
  const path         = require('path');
  const { renderGrid } = require('../common/scanner');
  
  const featuresDir = path.join(__dirname, '..', 'features');
  const grid        = document.getElementById('feature-grid');
  
  renderGrid(grid, featuresDir, {
    baseUrl: '../features',
    onDir: (name) => {
      if (name.endsWith('_quit')) {
        // “Quit” goes back to login
        window.location.href = '../login/index.html';
      } else {
        // Normal feature: open its index.html
        window.location.href = `../features/${name}/index.html`;
      }
    }
  });
})();
