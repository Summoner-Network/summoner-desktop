;(function(){
  const path           = require('path');
  const { renderGrid } = require('../../common/scanner');

  const featuresDir = __dirname;
  const grid        = document.getElementById('feature-grid');

  renderGrid(grid, featuresDir, {
    baseUrl: '../..',
    onDir: (name) => {
      if (name.endsWith('_back')) {
        window.location.href = '../../landing/landing.html';
      } else {
        window.location.href = `${name}/index.html`;
      }
    }
  });
})();
